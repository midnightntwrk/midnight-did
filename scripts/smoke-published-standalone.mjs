#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  packageManifestCatalog,
  publishWorkspaces,
} from "./did-workspace-catalog.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const registryDefault = "https://npm.pkg.github.com";
const githubRepositoryDefault = "midnightntwrk/midnight-did";
const genesisMintWalletSeed =
  "0000000000000000000000000000000000000000000000000000000000000001";

const usage = [
  "Usage: smoke-published-standalone.mjs --version <version> [options]",
  "",
  "Options:",
  "  --version <version>          Published package and ZK bundle version.",
  "  --registry <url>             npm registry URL. Defaults to GitHub Packages.",
  "  --github-release-tag <tag>   GitHub Release tag to download. Defaults to v<version>.",
  "  --github-repository <repo>   GitHub repository for release assets. Defaults to midnightntwrk/midnight-did.",
  "  --zk-archive <path>          Use an already downloaded ZK artifact archive.",
  "  --compose-file <path>        Docker Compose file for standalone. Defaults to packages/api/standalone.yml.",
  "  --use-existing-standalone    Do not start Docker; use endpoint env vars or standalone defaults.",
  "  --wallet-seed <hex>          Wallet seed. Defaults to standalone genesis mint wallet seed.",
  "  --npm-install-attempts <n>   Retry npm installs for registry propagation. Defaults to 3.",
  "  --npm-install-retry-delay-ms <ms>",
  "                               Delay between npm install retries. Defaults to 10000.",
  "  --keep-temp                  Keep the temporary consumer project and extracted ZK directory.",
  "  --help                       Print this help.",
  "",
  "Endpoint environment variables used with --use-existing-standalone:",
  "  INDEXER_URL, INDEXER_WS_URL, NODE_RPC_URL, PROOF_SERVER_URL",
].join("\n");

const parseArgs = () => {
  const options = {
    composeFile: path.join(repoRoot, "packages", "api", "standalone.yml"),
    githubRepository: githubRepositoryDefault,
    keepTemp: false,
    npmInstallAttempts: 3,
    npmInstallRetryDelayMs: 10_000,
    registry: registryDefault,
    useExistingStandalone: false,
    walletSeed: genesisMintWalletSeed,
  };
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--version":
        options.version = args[++index];
        break;
      case "--registry":
        options.registry = args[++index];
        break;
      case "--github-release-tag":
        options.githubReleaseTag = args[++index];
        break;
      case "--github-repository":
        options.githubRepository = args[++index];
        break;
      case "--zk-archive":
        options.zkArchive = args[++index];
        break;
      case "--compose-file":
        options.composeFile = args[++index];
        break;
      case "--use-existing-standalone":
        options.useExistingStandalone = true;
        break;
      case "--wallet-seed":
        options.walletSeed = args[++index];
        break;
      case "--npm-install-attempts":
        options.npmInstallAttempts = Number(args[++index]);
        break;
      case "--npm-install-retry-delay-ms":
        options.npmInstallRetryDelayMs = Number(args[++index]);
        break;
      case "--keep-temp":
        options.keepTemp = true;
        break;
      case "--help":
        console.log(usage);
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.version) {
    throw new Error("--version is required");
  }
  if (!options.zkArchive && !options.githubReleaseTag) {
    options.githubReleaseTag = `v${options.version}`;
  }
  if (options.zkArchive && options.githubReleaseTag) {
    throw new Error(
      "Use only one ZK artifact source: --zk-archive or --github-release-tag",
    );
  }
  if (
    !Number.isInteger(options.npmInstallAttempts) ||
    options.npmInstallAttempts < 1
  ) {
    throw new Error("--npm-install-attempts must be a positive integer");
  }
  if (
    !Number.isInteger(options.npmInstallRetryDelayMs) ||
    options.npmInstallRetryDelayMs < 0
  ) {
    throw new Error(
      "--npm-install-retry-delay-ms must be a non-negative integer",
    );
  }

  options.composeFile = path.resolve(options.composeFile);
  return options;
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with exit code ${result.status}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result;
};

const tryRun = (command, args, options = {}) =>
  spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });

const publishedPackageNames = () =>
  publishWorkspaces.map((workspace) => {
    const manifest = packageManifestCatalog.get(workspace);
    if (!manifest) {
      throw new Error(`Missing package manifest catalog entry for ${workspace}`);
    }
    return manifest.name;
  });

const writeNpmAuthConfig = ({ consumerRoot, registry, token }) => {
  const npmrcLines = ["registry=https://registry.npmjs.org/"];
  if (token) {
    const registryHost = new URL(registry).host;
    npmrcLines.push(`//${registryHost}/:_authToken=${token}`);
    npmrcLines.push("always-auth=true");
  }
  fs.writeFileSync(
    path.join(consumerRoot, ".npmrc"),
    `${npmrcLines.join("\n")}\n`,
  );
};

const packageTarballUrl = ({ consumerRoot, packageName, registry, version }) => {
  try {
    const result = run(
      "npm",
      [
        "view",
        `${packageName}@${version}`,
        "dist.tarball",
        "--registry",
        registry,
      ],
      {
        cwd: consumerRoot,
        env: {
          ...process.env,
          NPM_CONFIG_USERCONFIG: path.join(consumerRoot, ".npmrc"),
        },
      },
    );
    const tarballUrl = result.stdout.trim();
    if (!tarballUrl) {
      throw new Error(
        `Missing published tarball URL for ${packageName}@${version}`,
      );
    }
    return tarballUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      registry === registryDefault &&
      /permission_denied|E403/u.test(message)
    ) {
      throw new Error(
        `${packageName}@${version} could not be read from GitHub Packages. Set NODE_AUTH_TOKEN to a token with read:packages access, or use the MIDNIGHTCI_PACKAGES_READ secret in GitHub Actions.`,
      );
    }
    throw error;
  }
};

const safeArtifactVersion = (version) =>
  version.replace(/[^0-9A-Za-z._-]/gu, "_");

const expectedArchiveName = (version) =>
  `midnight-did-zk-artifacts-${safeArtifactVersion(version)}.tar.gz`;

const selectArchive = (directory, version) => {
  const expectedPath = path.join(directory, expectedArchiveName(version));
  if (fs.existsSync(expectedPath)) {
    return expectedPath;
  }

  const archiveNames = fs
    .readdirSync(directory)
    .filter((fileName) =>
      /^midnight-did-zk-artifacts-.+\.tar\.gz$/u.test(fileName),
    );
  if (archiveNames.length !== 1) {
    throw new Error(
      `Expected exactly one ZK artifact archive in ${directory}; found ${archiveNames.join(", ") || "<none>"}`,
    );
  }
  return path.join(directory, archiveNames[0]);
};

const verifyArchiveSha256 = (archivePath) => {
  const shaPath = `${archivePath}.sha256`;
  if (!fs.existsSync(shaPath)) {
    return;
  }

  const expectedHash = fs.readFileSync(shaPath, "utf8").trim().split(/\s+/u)[0];
  const actualHash = createHash("sha256")
    .update(fs.readFileSync(archivePath))
    .digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `ZK artifact sha256 mismatch for ${path.basename(archivePath)}: expected ${expectedHash}, got ${actualHash}`,
    );
  }
};

const downloadGithubReleaseArchive = ({
  githubReleaseTag,
  githubRepository,
  version,
}) => {
  const downloadRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-zk-release-standalone-"),
  );
  const pattern = `midnight-did-zk-artifacts-${safeArtifactVersion(version)}*`;
  run("gh", [
    "release",
    "download",
    githubReleaseTag,
    "--repo",
    githubRepository,
    "--pattern",
    pattern,
    "--dir",
    downloadRoot,
  ]);
  const archivePath = selectArchive(downloadRoot, version);
  verifyArchiveSha256(archivePath);
  return {
    archivePath,
    cleanup: (keepTemp) => {
      if (!keepTemp) {
        fs.rmSync(downloadRoot, { force: true, recursive: true });
      }
    },
  };
};

const resolveZkArchive = (options) => {
  if (options.zkArchive) {
    const archivePath = path.resolve(options.zkArchive);
    if (!fs.existsSync(archivePath)) {
      throw new Error(`ZK artifact archive does not exist: ${archivePath}`);
    }
    verifyArchiveSha256(archivePath);
    return { archivePath, cleanup: () => undefined };
  }

  return downloadGithubReleaseArchive(options);
};

const extractArchive = (archivePath, version) => {
  const extractRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-zk-standalone-"),
  );
  run("tar", ["-xzf", path.resolve(archivePath), "-C", extractRoot]);

  const manifestPath = path.join(extractRoot, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.version !== version) {
    throw new Error(
      `ZK artifact manifest version ${manifest.version} did not match ${version}`,
    );
  }
  if (!Array.isArray(manifest.circuits) || manifest.circuits.length === 0) {
    throw new Error("ZK artifact manifest does not contain circuits");
  }

  return {
    extractRoot,
    manifest,
    cleanup: (keepTemp) => {
      if (!keepTemp) {
        fs.rmSync(extractRoot, { force: true, recursive: true });
      }
    },
  };
};

const symlinkOrCopyDirectory = (target, linkPath) => {
  fs.rmSync(linkPath, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  try {
    fs.symlinkSync(target, linkPath, "dir");
  } catch {
    fs.cpSync(target, linkPath, { recursive: true });
  }
};

const mountReleaseZkAssetsForPublishedPackage = ({
  consumerRoot,
  extractRoot,
}) => {
  const contractPackageRoot = path.join(
    consumerRoot,
    "node_modules",
    "@midnight-ntwrk",
    "midnight-did-contract",
  );
  if (!fs.existsSync(contractPackageRoot)) {
    throw new Error(
      `Installed contract package not found: ${contractPackageRoot}`,
    );
  }

  // v0.4.0-rc1 resolves this source-layout path inside the installed package.
  // Newer packages can use MIDNIGHT_DID_ZK_CONFIG_PATH directly.
  const legacyExpectedPath = path.join(
    contractPackageRoot,
    "src",
    "managed",
    "did",
  );
  symlinkOrCopyDirectory(extractRoot, legacyExpectedPath);
  return legacyExpectedPath;
};

const writeConsumerStandaloneScript = (consumerRoot) => {
  fs.writeFileSync(
    path.join(consumerRoot, "published-standalone-smoke.mjs"),
    [
      "const requiredEnv = (name) => {",
      "  const value = process.env[name];",
      "  if (!value) throw new Error(`${name} is required`);",
      "  return value;",
      "};",
      "",
      "const DUST_RETRY = /Not enough Dust generated to pay the fee|could not balance dust/i;",
      "const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));",
      "const retryOnDustShortage = async (label, fn, retries = 3, delayMs = 8000) => {",
      "  let lastError;",
      "  for (let attempt = 0; attempt <= retries; attempt += 1) {",
      "    try {",
      "      return await fn();",
      "    } catch (error) {",
      "      lastError = error;",
      "      const message = error instanceof Error ? error.message : String(error);",
      "      if (attempt === retries || !DUST_RETRY.test(message)) throw error;",
      "      console.error(`[published-standalone-smoke] ${label} dust shortage on attempt ${attempt + 1}/${retries + 1}; retrying in ${delayMs}ms`);",
      "      await sleep(delayMs);",
      "    }",
      "  }",
      "  throw lastError instanceof Error ? lastError : new Error(String(lastError));",
      "};",
      "",
      "const expectedVersion = requiredEnv('MIDNIGHT_DID_SMOKE_VERSION');",
      "const api = await import('@midnight-ntwrk/midnight-did-api');",
      "const domain = await import('@midnight-ntwrk/midnight-did-domain');",
      "",
      "if (api.MIDNIGHT_DID_API_VERSION !== expectedVersion) {",
      "  throw new Error(`API package version ${api.MIDNIGHT_DID_API_VERSION} did not match ${expectedVersion}`);",
      "}",
      "",
      "const locations = api.createMidnightDidZkArtifactLocations(expectedVersion);",
      "if (locations.githubRelease && process.env.MIDNIGHT_DID_SMOKE_RELEASE_TAG) {",
      "  if (locations.githubRelease.tag !== process.env.MIDNIGHT_DID_SMOKE_RELEASE_TAG) {",
      "    throw new Error(`API release metadata tag ${locations.githubRelease.tag} did not match ${process.env.MIDNIGHT_DID_SMOKE_RELEASE_TAG}`);",
      "  }",
      "}",
      "",
      "const config = new api.ProfileConfig('standalone', {",
      "  indexer: requiredEnv('INDEXER_URL'),",
      "  indexerWS: requiredEnv('INDEXER_WS_URL'),",
      "  node: requiredEnv('NODE_RPC_URL'),",
      "  proofServer: requiredEnv('PROOF_SERVER_URL'),",
      "});",
      "",
      "const walletContext = await api.buildWalletAndWaitForFunds(",
      "  config,",
      "  requiredEnv('MIDNIGHT_WALLET_SEED'),",
      ");",
      "",
      "try {",
      "  await api.registerForDustGeneration(",
      "    walletContext.wallet,",
      "    walletContext.unshieldedKeystore,",
      "  );",
      "  const providers = await api.configureProviders(walletContext, config);",
      "  const privateState = await api.initPrivateState(providers);",
      "  const contract = await retryOnDustShortage('createDID', () =>",
      "    api.createDID(providers, privateState),",
      "  );",
      "  const before = await api.resolve(providers, contract);",
      "  const did = before?.didDocument?.id;",
      "  if (!did) throw new Error('DID document was not resolved after deployment');",
      "",
      "  const verificationMethod = domain.createVerificationMethod({",
      "    id: '#published-smoke-key',",
      "    type: domain.VerificationMethodType.JsonWebKey,",
      "    controller: did,",
      "    publicKeyJwk: {",
      "      kty: domain.KeyType.OKP,",
      "      crv: domain.CurveType.Ed25519,",
      "      x: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',",
      "    },",
      "  });",
      "  await retryOnDustShortage('addVerificationMethod', () =>",
      "    api.addVerificationMethod(contract, verificationMethod),",
      "  );",
      "  await retryOnDustShortage('addVerificationMethodRelation', () =>",
      "    api.addVerificationMethodRelation(",
      "      contract,",
      "      providers,",
      "      domain.VerificationMethodRelationType.Authentication,",
      "      verificationMethod.id,",
      "    ),",
      "  );",
      "",
      "  const service = domain.createService({",
      "    id: '#published-smoke-service',",
      "    type: 'DIDCommMessaging',",
      "    serviceEndpoint: 'https://example.com/didcomm',",
      "  });",
      "  await retryOnDustShortage('addService', () =>",
      "    api.addService(contract, service),",
      "  );",
      "  await retryOnDustShortage('updateService', () =>",
      "    api.updateService(",
      "      contract,",
      "      domain.createService({",
      "        ...service,",
      "        serviceEndpoint: 'https://example.com/didcomm/v2',",
      "      }),",
      "    ),",
      "  );",
      "",
      "  const after = await api.resolve(providers, contract);",
      "  const didDocument = after?.didDocument;",
      "  if (!didDocument) throw new Error('DID document was not resolved after update');",
      "  const serialized = JSON.stringify(didDocument);",
      "  if (!serialized.includes('#published-smoke-key')) {",
      "    throw new Error('Updated DID document did not contain the smoke verification method');",
      "  }",
      "  if (!serialized.includes('https://example.com/didcomm/v2')) {",
      "    throw new Error('Updated DID document did not contain the updated service endpoint');",
      "  }",
      "",
      "  console.log(JSON.stringify({",
      "    version: expectedVersion,",
      "    did,",
      "    contractAddress: contract.deployTxData.public.contractAddress,",
      "    verificationMethods: didDocument.verificationMethod?.length ?? 0,",
      "    services: didDocument.service?.length ?? 0,",
      "  }, null, 2));",
      "} finally {",
      "  await walletContext.wallet.stop();",
      "}",
      "",
    ].join("\n"),
  );
};

const installPublishedPackages = async ({
  npmInstallAttempts,
  npmInstallRetryDelayMs,
  registry,
  version,
}) => {
  const token = process.env.NODE_AUTH_TOKEN ?? process.env.NPM_TOKEN;
  if (!token && registry === registryDefault) {
    throw new Error(
      "NODE_AUTH_TOKEN or NPM_TOKEN is required for GitHub Packages smoke testing. Use a token with read:packages access.",
    );
  }

  const consumerRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-published-standalone-"),
  );
  fs.writeFileSync(
    path.join(consumerRoot, "package.json"),
    JSON.stringify(
      { name: "did-published-standalone-smoke", private: true, type: "module" },
      null,
      2,
    ) + "\n",
  );
  writeNpmAuthConfig({ consumerRoot, registry, token });

  try {
    const packages = publishedPackageNames().map((packageName) =>
      packageTarballUrl({ consumerRoot, packageName, registry, version }),
    );

    let lastInstallError;
    for (let attempt = 1; attempt <= npmInstallAttempts; attempt += 1) {
      try {
        run(
          "npm",
          [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--prefer-online",
            ...packages,
          ],
          {
            cwd: consumerRoot,
            env: {
              ...process.env,
              NPM_CONFIG_USERCONFIG: path.join(consumerRoot, ".npmrc"),
              npm_config_loglevel: "warn",
            },
          },
        );
        lastInstallError = undefined;
        break;
      } catch (error) {
        lastInstallError = error;
        if (attempt < npmInstallAttempts) {
          console.log(
            `[smoke-published-standalone] npm install attempt ${attempt} failed; retrying in ${npmInstallRetryDelayMs}ms`,
          );
          await delay(npmInstallRetryDelayMs);
        }
      }
    }

    if (lastInstallError) {
      throw lastInstallError;
    }

    writeConsumerStandaloneScript(consumerRoot);
    return consumerRoot;
  } catch (error) {
    fs.rmSync(consumerRoot, { force: true, recursive: true });
    throw error;
  } finally {
    fs.rmSync(path.join(consumerRoot, ".npmrc"), { force: true });
  }
};

const parseMappedPort = (stdout, serviceName, containerPort) => {
  const line = stdout.trim().split(/\r?\n/u).filter(Boolean).at(-1);
  const match = line?.match(/:(\d+)$/u);
  if (!match) {
    throw new Error(
      `Could not resolve mapped port for ${serviceName}:${containerPort}: ${stdout}`,
    );
  }
  return match[1];
};

const waitForHttpHealthy = async ({
  label,
  url,
  timeoutMs = 300_000,
  intervalMs = 5_000,
}) => {
  const endAt = Date.now() + timeoutMs;
  while (Date.now() < endAt) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "*/*" },
      });
      if (response.ok) {
        console.log(`[smoke-published-standalone] ${label} is ready`);
        return;
      }
      console.log(
        `[smoke-published-standalone] ${label} not ready yet (${response.status}); retrying`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        `[smoke-published-standalone] ${label} not reachable yet (${message}); retrying`,
      );
    }

    await delay(intervalMs);
  }

  throw new Error(
    `${label} did not become ready in ${Math.round(timeoutMs / 1000)} seconds`,
  );
};

const dockerCompose = (projectName, composeFile, args, options = {}) =>
  run("docker", ["compose", "-p", projectName, "-f", composeFile, ...args], {
    timeout: 600_000,
    ...options,
  });

const startStandalone = async (options) => {
  if (options.useExistingStandalone) {
    const indexer =
      process.env.INDEXER_URL ?? "http://127.0.0.1:8088/api/v3/graphql";
    return {
      cleanup: () => undefined,
      endpoints: {
        indexer,
        indexerWS:
          process.env.INDEXER_WS_URL ??
          indexer
            .replace(/^http/u, "ws")
            .replace(/\/graphql\/?$/u, "/graphql/ws"),
        node: process.env.NODE_RPC_URL ?? "http://127.0.0.1:9944",
        proofServer: process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
      },
    };
  }

  if (!fs.existsSync(options.composeFile)) {
    throw new Error(
      `Standalone compose file does not exist: ${options.composeFile}`,
    );
  }

  const projectName = `did-published-smoke-${Date.now()}`;
  const upResult = tryRun(
    "docker",
    [
      "compose",
      "-p",
      projectName,
      "-f",
      options.composeFile,
      "up",
      "-d",
      "--wait",
    ],
    { encoding: "utf8", timeout: 600_000 },
  );

  if (upResult.status !== 0) {
    const output = `${upResult.stdout}\n${upResult.stderr}`;
    if (!/unknown flag|unknown shorthand flag|no such option/u.test(output)) {
      console.log(
        `[smoke-published-standalone] docker compose up -d --wait exited with ${upResult.status}; continuing with manual readiness checks`,
      );
      console.debug(output);
    }
    dockerCompose(projectName, options.composeFile, ["up", "-d"]);
  }

  const proofPort = parseMappedPort(
    dockerCompose(projectName, options.composeFile, [
      "port",
      "proof-server",
      "6300",
    ]).stdout,
    "proof-server",
    6300,
  );
  const indexerPort = parseMappedPort(
    dockerCompose(projectName, options.composeFile, [
      "port",
      "indexer",
      "8088",
    ]).stdout,
    "indexer",
    8088,
  );
  const nodePort = parseMappedPort(
    dockerCompose(projectName, options.composeFile, ["port", "node", "9944"])
      .stdout,
    "node",
    9944,
  );
  const proofServerEndpoint = `http://127.0.0.1:${proofPort}/version`;
  const nodeEndpoint = `http://127.0.0.1:${nodePort}/health`;

  await waitForHttpHealthy({
    label: "Node RPC",
    url: nodeEndpoint,
    timeoutMs: 240_000,
    intervalMs: 2_000,
  });
  await waitForHttpHealthy({
    label: "Proof server",
    url: proofServerEndpoint,
    timeoutMs: 900_000,
    intervalMs: 5_000,
  });

  return {
    cleanup: () => {
      const result = tryRun(
        "docker",
        [
          "compose",
          "-p",
          projectName,
          "-f",
          options.composeFile,
          "down",
          "--volumes",
          "--remove-orphans",
        ],
        { encoding: "utf8", timeout: 60_000 },
      );
      if (result.status !== 0) {
        console.warn(
          `[smoke-published-standalone] docker cleanup failed:\n${result.stdout}${result.stderr}`,
        );
      }
    },
    endpoints: {
      indexer: `http://127.0.0.1:${indexerPort}/api/v3/graphql`,
      indexerWS: `ws://127.0.0.1:${indexerPort}/api/v3/graphql/ws`,
      node: `http://127.0.0.1:${nodePort}`,
      proofServer: `http://127.0.0.1:${proofPort}`,
    },
  };
};

const smokeStandalone = ({
  consumerRoot,
  endpoints,
  extractRoot,
  githubReleaseTag,
  version,
  walletSeed,
}) => {
  const legacyZkPath = mountReleaseZkAssetsForPublishedPackage({
    consumerRoot,
    extractRoot,
  });

  console.log(
    `[smoke-published-standalone] mounted release ZK assets at ${legacyZkPath}`,
  );

  run(process.execPath, ["published-standalone-smoke.mjs"], {
    cwd: consumerRoot,
    env: {
      ...process.env,
      INDEXER_URL: endpoints.indexer,
      INDEXER_WS_URL: endpoints.indexerWS,
      MIDNIGHT_DID_SMOKE_RELEASE_TAG: githubReleaseTag ?? "",
      MIDNIGHT_DID_SMOKE_VERSION: version,
      MIDNIGHT_DID_ZK_CONFIG_PATH: extractRoot,
      MIDNIGHT_WALLET_SEED: walletSeed,
      NODE_RPC_URL: endpoints.node,
      PROOF_SERVER_URL: endpoints.proofServer,
    },
    timeout: 60 * 60 * 1000,
  });
};

const options = parseArgs();
let archive;
let extracted;
let consumerRoot;
let standalone;

try {
  console.log(
    `[smoke-published-standalone] resolving ZK artifact for ${options.version}`,
  );
  archive = resolveZkArchive(options);
  extracted = extractArchive(archive.archivePath, options.version);
  console.log(
    `[smoke-published-standalone] extracted ${extracted.manifest.circuits.length} circuits from ${path.basename(archive.archivePath)}`,
  );

  console.log(
    `[smoke-published-standalone] installing @midnight-ntwrk packages ${options.version} from ${options.registry}`,
  );
  consumerRoot = await installPublishedPackages(options);

  console.log("[smoke-published-standalone] starting standalone environment");
  standalone = await startStandalone(options);
  console.log(
    `[smoke-published-standalone] endpoints: indexer=${standalone.endpoints.indexer} node=${standalone.endpoints.node} proof=${standalone.endpoints.proofServer}`,
  );

  smokeStandalone({
    consumerRoot,
    endpoints: standalone.endpoints,
    extractRoot: extracted.extractRoot,
    githubReleaseTag: options.githubReleaseTag,
    version: options.version,
    walletSeed: options.walletSeed,
  });
  console.log(
    "[smoke-published-standalone] published package standalone smoke passed",
  );
} finally {
  try {
    standalone?.cleanup();
  } finally {
    if (consumerRoot && !options.keepTemp) {
      fs.rmSync(consumerRoot, { force: true, recursive: true });
    } else if (consumerRoot) {
      console.log(
        `[smoke-published-standalone] kept consumer root: ${consumerRoot}`,
      );
    }
    extracted?.cleanup(options.keepTemp);
    archive?.cleanup(options.keepTemp);
  }
}
