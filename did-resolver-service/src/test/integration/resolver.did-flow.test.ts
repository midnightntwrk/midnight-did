import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  createMidnightDIDString,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did";
import * as api from "@midnight-ntwrk/midnight-did-api";
import {
  createService,
  createVerificationMethod,
  CurveType,
  KeyType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import pino from "pino";
import {
  DockerComposeEnvironment,
  type StartedDockerComposeEnvironment,
  Wait,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupComposeProject,
  waitForMappedPort,
} from "./docker-compose-utils.js";

const GENESIS_MINT_WALLET_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

const resolverDir = path.resolve(
  new URL(import.meta.url).pathname,
  "../../../..",
);

let containerRuntimeAvailable = true;
try {
  const { getContainerRuntimeClient } = await import(
    "testcontainers/build/container-runtime/clients/client.js"
  );
  await getContainerRuntimeClient();
} catch {
  containerRuntimeAvailable = false;
}

const describeIntegration = containerRuntimeAvailable
  ? describe
  : describe.skip;
const nodeMajor = Number.parseInt(
  process.versions.node.split(".")[0] ?? "0",
  10,
);
const describeDidFlow = nodeMajor >= 24 ? describeIntegration : describe.skip;

const createDidWithDustRetry = async (
  providers: api.MidnightDIDProviders,
  privateState: api.MidnightDIDPrivateState,
  retries = 2,
  delayMs = 8_000,
): Promise<api.DeployedMidnightDIDContract> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await api.createDID(providers, privateState);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt === retries ||
        !/Not enough Dust generated to pay the fee|could not balance dust/i.test(
          message,
        )
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

describeDidFlow("did-resolver-service e2e DID lifecycle", () => {
  let env: StartedDockerComposeEnvironment;
  let projectName = "";
  let resolverBaseUrl = process.env.RESOLVER_TEST_BASE_URL;
  let walletCtx: api.MidnightDIDWalletContext;
  let providers: api.MidnightDIDProviders;
  let contract: api.DeployedMidnightDIDContract;
  let did: string;

  const printResolverHint = (didValue: string) => {
    const encodedDid = encodeURIComponent(didValue);
    console.info(
      `[resolver-e2e] DID: ${didValue}\n` +
        `[resolver-e2e] UI: ${resolverBaseUrl}/\n` +
        `[resolver-e2e] Resolve URL: ${resolverBaseUrl}/resolve/${encodedDid}`,
    );
  };

  const mapToContainerPort = (input: string, mappedPort: number): string => {
    const mapped = new URL(input);
    mapped.port = String(mappedPort);
    return mapped.toString().replace(/\/+$/, "");
  };

  const dumpComposeDiagnostics = (currentProjectName: string) => {
    try {
      const dockerVersion = spawnSync("docker", ["--version"], {
        encoding: "utf8",
      });
      if (dockerVersion.status !== 0) return;

      const ps = spawnSync(
        "docker",
        ["compose", "-p", currentProjectName, "-f", "compose.e2e.yml", "ps"],
        {
          cwd: resolverDir,
          encoding: "utf8",
        },
      );
      if (ps.status === 0 && ps.stdout) {
        console.info(`[resolver-e2e] compose ps\n${ps.stdout}`);
      }
      const logs = spawnSync(
        "docker",
        [
          "compose",
          "-p",
          currentProjectName,
          "-f",
          "compose.e2e.yml",
          "logs",
          "--no-color",
          "--tail=200",
        ],
        {
          cwd: resolverDir,
          encoding: "utf8",
        },
      );
      if (logs.status === 0 && logs.stdout) {
        console.info(`[resolver-e2e] compose logs\n${logs.stdout}`);
      }
    } catch {
      // Best effort diagnostics only.
    }
  };

  const resolveDid = async (didValue: string) => {
    if (!resolverBaseUrl)
      throw new Error("Resolver base URL is not configured");
    const response = await fetch(
      `${resolverBaseUrl}/resolve/${encodeURIComponent(didValue)}`,
    );
    const body = (await response.json()) as {
      didDocument?: {
        verificationMethod?: Array<{ id: string }>;
        service?: Array<{ id: string }>;
        alsoKnownAs?: string[];
      } | null;
      didDocumentMetadata?: { versionId?: string; deactivated?: boolean };
      didResolutionMetadata?: { error?: string | null };
    };
    return { status: response.status, body };
  };

  const waitForResolve = async (
    didValue: string,
    predicate: (payload: Awaited<ReturnType<typeof resolveDid>>) => boolean,
    timeoutMs = 60_000,
    intervalMs = 2_000,
  ) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const resolved = await resolveDid(didValue);
      if (predicate(resolved)) return resolved;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(
      "Timed out waiting for DID state to be visible via resolver",
    );
  };

  beforeAll(
    async () => {
      api.setLogger(pino({ level: "error" }));
      let startupError: unknown;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        projectName = `did-resolver-e2e-${Date.now()}-${attempt}`;
        const dockerEnv = new DockerComposeEnvironment(
          resolverDir,
          "compose.e2e.yml",
        )
          .withProjectName(projectName)
          .withWaitStrategy(
            "proof-server",
            // Proof server startup time varies by host/image cache state.
            // Wait on compose healthcheck with an explicit long timeout.
            Wait.forHealthCheck().withStartupTimeout(180000),
          )
          .withWaitStrategy(
            "indexer",
            Wait.forHealthCheck().withStartupTimeout(180000),
          )
          .withWaitStrategy("did-resolver", Wait.forHttp("/health", 3001));
        try {
          env = await dockerEnv.up();
          break;
        } catch (error) {
          startupError = error;
          dumpComposeDiagnostics(projectName);
          try {
            await dockerEnv.down({ removeVolumes: true, timeout: 30 });
          } catch {
            // ignore cleanup errors in retry path
          }
        }
      }
      if (env === undefined) {
        throw startupError;
      }

      let resolverPort: number;
      let indexerPort: number;
      let nodePort: number;
      let proofServerPort: number;
      try {
        resolverPort = await waitForMappedPort(env, {
          cwd: resolverDir,
          composeFile: "compose.e2e.yml",
          projectName,
          serviceName: "did-resolver",
          internalPort: 3001,
        });
        indexerPort = await waitForMappedPort(env, {
          cwd: resolverDir,
          composeFile: "compose.e2e.yml",
          projectName,
          serviceName: "indexer",
          internalPort: 8088,
        });
        nodePort = await waitForMappedPort(env, {
          cwd: resolverDir,
          composeFile: "compose.e2e.yml",
          projectName,
          serviceName: "node",
          internalPort: 9944,
        });
        proofServerPort = await waitForMappedPort(env, {
          cwd: resolverDir,
          composeFile: "compose.e2e.yml",
          projectName,
          serviceName: "proof-server",
          internalPort: 6300,
        });
      } catch (error) {
        dumpComposeDiagnostics(projectName);
        throw error;
      }
      if (!resolverBaseUrl) {
        resolverBaseUrl = `http://127.0.0.1:${resolverPort}`;
      }

      const standaloneCfg = new api.StandaloneConfig();
      const cfg = {
        ...standaloneCfg,
        indexer: mapToContainerPort(standaloneCfg.indexer, indexerPort),
        indexerWS: mapToContainerPort(standaloneCfg.indexerWS, indexerPort),
        node: mapToContainerPort(standaloneCfg.node, nodePort),
        proofServer: mapToContainerPort(
          standaloneCfg.proofServer,
          proofServerPort,
        ),
      };
      walletCtx = await api.buildWalletAndWaitForFunds(
        cfg,
        GENESIS_MINT_WALLET_SEED,
      );
      await api.registerForDustGeneration(
        walletCtx.wallet,
        walletCtx.unshieldedKeystore,
      );
      providers = await api.configureProviders(walletCtx, cfg);

      const privateState = await api.initPrivateState(providers);
      contract = await createDidWithDustRetry(providers, privateState);
      const contractAddress = parseContractAddress(
        contract.deployTxData.public.contractAddress,
      );
      did = createMidnightDIDString(contractAddress, api.getMidnightNetwork());
      printResolverHint(did);
    },
    1000 * 60 * 45,
  );

  afterAll(
    async () => {
      try {
        if (walletCtx !== undefined) {
          await walletCtx.wallet.stop();
        }
        if (env !== undefined) {
          await env.down({ removeVolumes: true, timeout: 30 });
        }
      } finally {
        cleanupComposeProject({
          cwd: resolverDir,
          composeFile: "compose.e2e.yml",
          projectName,
        });
      }
    },
    1000 * 60 * 10,
  );

  it(
    "creates, updates, resolves and deactivates DID through resolver REST API",
    async () => {
      const method = createVerificationMethod({
        id: `${did}#key-1`,
        type: VerificationMethodType.JsonWebKey,
        controller: did,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: "Kg",
        },
      });
      await api.addVerificationMethod(contract, method);

      const firstResolved = await waitForResolve(did, (payload) => {
        if (payload.status !== 200) return false;
        const methods = payload.body.didDocument?.verificationMethod ?? [];
        return methods.some((entry) => entry.id.endsWith("#key-1"));
      });

      expect(firstResolved.status).toBe(200);
      const firstVersion = Number(
        firstResolved.body.didDocumentMetadata?.versionId,
      );
      expect(firstVersion).toBeGreaterThan(0);

      const service = createService({
        id: "#svc-1",
        type: "LinkedDomains",
        serviceEndpoint: "https://example.com",
      });
      await api.addService(contract, service);
      await api.addAlsoKnownAs(contract, "https://example.org/alias");

      const secondResolved = await waitForResolve(did, (payload) => {
        if (payload.status !== 200) return false;
        const services = payload.body.didDocument?.service ?? [];
        const aliases = payload.body.didDocument?.alsoKnownAs ?? [];
        return (
          services.some((entry) => entry.id.endsWith("#svc-1")) &&
          aliases.includes("https://example.org/alias")
        );
      });

      expect(secondResolved.status).toBe(200);
      const secondVersion = Number(
        secondResolved.body.didDocumentMetadata?.versionId,
      );
      expect(secondVersion).toBeGreaterThan(firstVersion);

      await api.deactivate(contract);

      const deactivated = await waitForResolve(did, (payload) => {
        if (payload.status !== 200) return false;
        return payload.body.didDocumentMetadata?.deactivated === true;
      });

      expect(deactivated.status).toBe(200);
      expect(deactivated.body.didDocumentMetadata?.deactivated).toBe(true);
      const deactivatedVersion = Number(
        deactivated.body.didDocumentMetadata?.versionId,
      );
      expect(deactivatedVersion).toBeGreaterThan(secondVersion);
    },
    1000 * 60 * 45,
  );
});
