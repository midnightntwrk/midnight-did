import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TextEncoder } from "node:util";

import { jubjubPointX, jubjubPointY } from "@midnight-ntwrk/compact-runtime";
import * as Rx from "rxjs";
import {
  DockerComposeEnvironment,
  type StartedDockerComposeEnvironment,
  Wait,
} from "testcontainers";
import { expect } from "vitest";

import { StandaloneConfig } from "../../../../api/src/config.js";
import type {
  DeployedMidnightDIDContract,
  MidnightDIDProviders,
  MidnightDIDWalletContext,
} from "../../../../api/src/index.js";
import {
  addVerificationMethod,
  addVerificationMethodRelation,
  buildWallet,
  configureProviders,
  createDID,
  getMidnightNetwork,
  initPrivateState,
  registerForDustGeneration,
  resolve,
  setLogger,
  waitForWalletFunds,
  waitForWalletSync,
} from "../../../../api/src/index.js";
import type { Signer } from "../../../../credentials-birth/src/test/credential-fixtures.js";
import { encodeFieldElement } from "../../../../domain/src/crypto-codecs.js";
import {
  createVerificationMethod,
  CurveType,
  KeyType,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "../../../../domain/src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../../");
const API_DIR = path.resolve(REPO_ROOT, "api");
const COMPOSE_FILE = "standalone.yml";
const GENESIS_MINT_WALLET_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

type Role = "issuer" | "holder" | "verifier";

export interface ProtocolDidProfile {
  readonly role: Role;
  readonly didString: string;
  readonly contractAddress: string;
  readonly contract: DeployedMidnightDIDContract;
  readonly verificationMethodRef: string;
  readonly verificationMethodRefValue: Signer["verificationMethodRef"];
}

export const verifierChallengeForProfile = (
  didString: string,
  purpose: string,
): Uint8Array =>
  new Uint8Array(
    createHash("sha256")
      .update(`midnight:vc:verifier:${didString}:${purpose}`)
      .digest(),
  );

const hexToBytes = (value: string): Uint8Array =>
  Uint8Array.from(Buffer.from(value, "hex"));

const uniqueIntegrationPath = (suffix: string): string =>
  path.resolve(REPO_ROOT, ".midnight-test", "credentials-demo", suffix);

const padText = (value: string, length = 32): Uint8Array => {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length >= length) {
    return bytes.subarray(0, length);
  }
  const padded = new Uint8Array(length);
  padded.set(bytes);
  return padded;
};

const methodJwkFromSigner = (signer: Signer) => ({
  kty: KeyType.EC,
  crv: CurveType.Jubjub,
  x: encodeFieldElement(jubjubPointX(signer.publicKey)),
  y: encodeFieldElement(jubjubPointY(signer.publicKey)),
});

const mapContainerPort = (
  env: StartedDockerComposeEnvironment,
  url: string,
  containerName: string,
): string => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);
  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, "");
};

const createDidWithDustRetry = async (
  providers: MidnightDIDProviders,
  retries = 3,
  delayMs = 8_000,
): Promise<DeployedMidnightDIDContract> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await createDID(providers, await initPrivateState(providers));
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
      await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> =>
  await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);

export class StandaloneProtocolEnvironment {
  private env: StartedDockerComposeEnvironment | undefined;
  private walletCtx: MidnightDIDWalletContext | undefined;
  private providers: MidnightDIDProviders | undefined;
  private readonly projectName = `credentials-demo-${Date.now()}`;
  private readonly fsRoots = [
    uniqueIntegrationPath("standalone-wallet"),
    uniqueIntegrationPath("issuer"),
    uniqueIntegrationPath("holder"),
    uniqueIntegrationPath("verifier"),
  ];

  async start(): Promise<MidnightDIDProviders> {
    setLogger({
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    } as never);

    await Promise.all(
      this.fsRoots.map((root) => fs.rm(root, { recursive: true, force: true })),
    );

    const baseConfig = new StandaloneConfig();
    const dockerEnv = new DockerComposeEnvironment(API_DIR, COMPOSE_FILE)
      .withProjectName(this.projectName)
      .withWaitStrategy(
        "did-proof-server",
        Wait.forHttp("/version", 6300).withStartupTimeout(180000),
      )
      .withWaitStrategy(
        "did-indexer",
        Wait.forHealthCheck().withStartupTimeout(180000),
      );

    this.env = await dockerEnv.up();

    const config = Object.assign(baseConfig, {
      indexer: mapContainerPort(this.env, baseConfig.indexer, "did-indexer"),
      indexerWS: mapContainerPort(this.env, baseConfig.indexerWS, "did-indexer"),
      node: mapContainerPort(this.env, baseConfig.node, "did-node"),
      proofServer: mapContainerPort(
        this.env,
        baseConfig.proofServer,
        "did-proof-server",
      ),
      logDir: path.resolve(uniqueIntegrationPath("standalone-wallet"), "logs"),
      midnightDbName: path.resolve(
        uniqueIntegrationPath("standalone-wallet"),
        "wallet-db",
      ),
    });

    console.info("[credentials-demo:integration] compose is up");
    this.walletCtx = await buildWallet(config, GENESIS_MINT_WALLET_SEED);
    console.info("[credentials-demo:integration] waiting for wallet sync");
    await withTimeout(waitForWalletSync(this.walletCtx), 180_000, "wallet sync");
    console.info("[credentials-demo:integration] waiting for wallet funds");
    await withTimeout(
      waitForWalletFunds(this.walletCtx),
      180_000,
      "wallet funds",
    );
    console.info("[credentials-demo:integration] registering dust generation");
    await withTimeout(
      registerForDustGeneration(
        this.walletCtx.wallet,
        this.walletCtx.unshieldedKeystore,
      ),
      300_000,
      "dust generation",
    );
    console.info("[credentials-demo:integration] configuring providers");
    this.providers = await configureProviders(this.walletCtx, config);
    return this.providers;
  }

  async provisionDidProfile(
    role: Role,
    signer: Signer,
  ): Promise<ProtocolDidProfile> {
    if (this.providers === undefined) {
      throw new Error("StandaloneProtocolEnvironment.start() must be called first");
    }

    console.info(`[credentials-demo:integration] deploying ${role} DID`);
    const contract = await createDidWithDustRetry(this.providers);
    console.info(`[credentials-demo:integration] resolving ${role} DID`);
    const resolutionBeforeMethod = await resolve(this.providers, contract);
    const didString = resolutionBeforeMethod?.didDocument.id;
    if (didString === undefined) {
      throw new Error(`Failed to resolve ${role} DID after deployment`);
    }

    const verificationMethodRef = `${didString}#${role}-key-1`;
    console.info(
      `[credentials-demo:integration] publishing verification method for ${role}`,
    );
    await addVerificationMethod(
      contract,
      createVerificationMethod({
        id: verificationMethodRef,
        type: VerificationMethodType.JsonWebKey,
        controller: didString,
        publicKeyJwk: methodJwkFromSigner(signer),
      }),
    );

    await addVerificationMethodRelation(
      contract,
      this.providers,
      role === "issuer"
        ? VerificationMethodRelationType.AssertionMethod
        : VerificationMethodRelationType.Authentication,
      verificationMethodRef,
    );

    console.info(`[credentials-demo:integration] re-resolving ${role} DID`);
    const resolution = await resolve(this.providers, contract);
    expect(resolution).not.toBeNull();
    expect(
      resolution?.didDocument.verificationMethod?.some(
        (method) => method.id === verificationMethodRef,
      ),
    ).toEqual(true);

    return {
      role,
      didString,
      contractAddress: contract.deployTxData.public.contractAddress,
      contract,
      verificationMethodRef,
      verificationMethodRefValue: {
        didContractAddress: { bytes: hexToBytes(contract.deployTxData.public.contractAddress) },
        methodId: padText(verificationMethodRef.slice(didString.length)),
      },
    };
  }

  async waitForWalletSync(): Promise<void> {
    if (this.walletCtx === undefined) return;
    await Rx.firstValueFrom(
      this.walletCtx.wallet.state().pipe(Rx.filter((state) => state.isSynced)),
    );
  }

  async shutdown(): Promise<void> {
    try {
      if (this.walletCtx !== undefined) {
        await this.walletCtx.wallet.stop();
      }
      if (this.env !== undefined) {
        await this.env.down({ removeVolumes: true, timeout: 30 });
      }
    } finally {
      await Promise.all(
        this.fsRoots.map((root) =>
          fs.rm(root, { recursive: true, force: true }),
        ),
      );
    }
  }

  get network(): string {
    return getMidnightNetwork().toString().toLowerCase();
  }
}
