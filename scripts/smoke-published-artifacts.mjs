#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";

import {
  packageManifestCatalog,
  publishWorkspaces,
} from "./did-workspace-catalog.mjs";

const registryDefault = "https://npm.pkg.github.com";
const providerBaseUrl = "https://midnight-did.local";
const ghcrArtifactRepository =
  "ghcr.io/midnightntwrk/midnight-did-zk-artifacts";

const parseArgs = () => {
  const options = {
    npmInstallAttempts: 3,
    npmInstallRetryDelayMs: 10_000,
    githubRepository: "midnightntwrk/midnight-did",
    registry: registryDefault,
    skipNpm: false,
    skipZk: false,
    zkFetchMode: "http",
  };
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--":
        break;
      case "--version":
        options.version = args[++index];
        break;
      case "--registry":
        options.registry = args[++index];
        break;
      case "--oci-ref":
        options.ociRef = args[++index];
        break;
      case "--github-release-tag":
        options.githubReleaseTag = args[++index];
        break;
      case "--github-repository":
        options.githubRepository = args[++index];
        break;
      case "--npm-install-attempts":
        options.npmInstallAttempts = Number(args[++index]);
        break;
      case "--npm-install-retry-delay-ms":
        options.npmInstallRetryDelayMs = Number(args[++index]);
        break;
      case "--zk-archive":
        options.zkArchive = args[++index];
        break;
      case "--zk-fetch-mode":
        options.zkFetchMode = args[++index];
        break;
      case "--skip-npm":
        options.skipNpm = true;
        break;
      case "--skip-zk":
        options.skipZk = true;
        break;
      case "--help":
        console.log(
          [
            "Usage: smoke-published-artifacts.mjs --version <version> [options]",
            "",
            "Options:",
            "  --registry <url>      npm registry URL. Defaults to GitHub Packages.",
            "  --npm-install-attempts <n>",
            "                        Retry npm installs for registry propagation. Defaults to 3.",
            "  --npm-install-retry-delay-ms <ms>",
            "                        Delay between npm install retries. Defaults to 10000.",
            "  --zk-archive <path>   Published ZK artifact tar.gz to verify through FetchZkConfigProvider.",
            "  --zk-fetch-mode <http|injected>",
            "                        Fetch unpacked ZK files through a localhost HTTP server or injected fetch. Defaults to http.",
            "  --oci-ref <ref>       Pull a ZK artifact from an OCI registry with ORAS, then verify it.",
            "  --github-release-tag <tag>",
            "                        Download a ZK artifact from a GitHub Release with gh, then verify it.",
            "  --github-repository <owner/repo>",
            "                        GitHub repository for release downloads. Defaults to midnightntwrk/midnight-did.",
            "  --skip-npm            Skip npm registry install/import smoke test.",
            "  --skip-zk             Skip ZK provider smoke test.",
          ].join("\n"),
        );
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
};

const run = (command, args, options = {}) => {
  const { stdin, ...spawnOptions } = options;
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input: stdin,
    stdio: ["pipe", "pipe", "pipe"],
    ...spawnOptions,
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

const publishedPackageNames = () =>
  publishWorkspaces.map((workspace) => {
    const manifest = packageManifestCatalog.get(workspace);
    if (!manifest) {
      throw new Error(`Missing package manifest catalog entry for ${workspace}`);
    }
    return manifest.name;
  });

const writeNpmAuthConfig = ({ directory, registry, token }) => {
  const npmrcLines = ["registry=https://registry.npmjs.org/"];
  if (token) {
    const registryHost = new URL(registry).host;
    npmrcLines.push(`//${registryHost}/:_authToken=${token}`);
    npmrcLines.push("always-auth=true");
  }
  fs.writeFileSync(path.join(directory, ".npmrc"), `${npmrcLines.join("\n")}\n`);
};

const packageTarballUrl = ({ consumerRoot, packageName, registry, version }) => {
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
};

const safeArtifactVersion = (version) =>
  version.replace(/[^0-9A-Za-z._-]/gu, "_");

const artifactLocationsForVersion = (version) => {
  if (!version) {
    return undefined;
  }
  if (/^\d+\.\d+\.\d+-snapshot\.[0-9A-Za-z._-]+$/u.test(version)) {
    return {
      ghcr: { reference: `${ghcrArtifactRepository}:${version}` },
      githubRelease: null,
    };
  }
  if (
    /^\d+\.\d+\.\d+-rc[1-9]\d*$/u.test(version) ||
    /^\d+\.\d+\.\d+$/u.test(version)
  ) {
    return {
      ghcr: { reference: `${ghcrArtifactRepository}:${version}` },
      githubRelease: { tag: `v${version}` },
    };
  }
  throw new Error(`Unsupported Midnight DID release version shape: ${version}`);
};

const expectedArchiveName = (version) =>
  `midnight-did-zk-artifacts-${safeArtifactVersion(version)}.tar.gz`;

const selectArchive = (directory, version) => {
  const expectedName = version ? expectedArchiveName(version) : undefined;
  if (expectedName) {
    const expectedPath = path.join(directory, expectedName);
    if (!fs.existsSync(expectedPath)) {
      throw new Error(
        `Expected ZK artifact archive was not downloaded: ${expectedName}`,
      );
    }
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

const loginToOciRegistryIfTokenAvailable = (ociRef) => {
  const [registry] = ociRef.split("/");
  const token =
    process.env.GH_TOKEN ??
    process.env.GITHUB_TOKEN ??
    process.env.NODE_AUTH_TOKEN ??
    process.env.NPM_TOKEN;
  if (registry !== "ghcr.io" || !token) {
    return;
  }

  run(
    "oras",
    [
      "login",
      registry,
      "--username",
      process.env.GITHUB_ACTOR ?? "midnight-did",
      "--password-stdin",
    ],
    { stdin: token },
  );
};

const pullOciArchive = ({ ociRef, version }) => {
  const pullRoot = fs.mkdtempSync(path.join(os.tmpdir(), "did-zk-oci-smoke-"));
  loginToOciRegistryIfTokenAvailable(ociRef);
  run("oras", ["pull", ociRef, "--output", pullRoot]);
  return {
    archivePath: selectArchive(pullRoot, version),
    cleanup: () => fs.rmSync(pullRoot, { force: true, recursive: true }),
  };
};

const downloadGithubReleaseArchive = ({
  githubReleaseTag,
  githubRepository,
  version,
}) => {
  const downloadRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-zk-release-smoke-"),
  );
  const pattern = version
    ? expectedArchiveName(version)
    : "midnight-did-zk-artifacts-*.tar.gz";
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
  return {
    archivePath: selectArchive(downloadRoot, version),
    cleanup: () => fs.rmSync(downloadRoot, { force: true, recursive: true }),
  };
};

const resolveZkArchive = (options) => {
  const sourceCount = [
    options.zkArchive,
    options.ociRef,
    options.githubReleaseTag,
  ].filter(Boolean).length;
  if (sourceCount > 1) {
    throw new Error(
      "Use only one ZK artifact source: --zk-archive, --oci-ref, or --github-release-tag",
    );
  }

  if (options.zkArchive) {
    return { archivePath: options.zkArchive, cleanup: () => undefined };
  }
  if (options.ociRef) {
    return pullOciArchive(options);
  }
  if (options.githubReleaseTag) {
    return downloadGithubReleaseArchive(options);
  }
  return undefined;
};

const writeConsumerSmokeScript = (consumerRoot, version) => {
  const imports = [
    "@midnight-ntwrk/midnight-did-jubjub-schnorr",
    "@midnight-ntwrk/midnight-did-jubjub-schnorr/managed/jubjub-schnorr/contract",
    "@midnight-ntwrk/midnight-did-contract",
    "@midnight-ntwrk/midnight-did-domain",
    "@midnight-ntwrk/midnight-did-domain/midnight",
    "@midnight-ntwrk/midnight-did",
    "@midnight-ntwrk/midnight-did/midnight",
    "@midnight-ntwrk/midnight-did-api",
    "@midnight-ntwrk/midnight-did-api/browser",
  ];

  fs.writeFileSync(
    path.join(consumerRoot, "smoke-imports.mjs"),
    [
      "const imports = " + JSON.stringify(imports, null, 2) + ";",
      "const expectedVersion = " + JSON.stringify(version) + ";",
      "for (const specifier of imports) {",
      "  const module = await import(specifier);",
      "  if (Object.keys(module).length === 0) {",
      "    throw new Error(`${specifier} did not expose any exports`);",
      "  }",
      "}",
      "const api = await import('@midnight-ntwrk/midnight-did-api');",
      "if (api.MIDNIGHT_DID_API_VERSION !== expectedVersion) {",
      "  throw new Error(`api package version metadata ${api.MIDNIGHT_DID_API_VERSION} did not match ${expectedVersion}`);",
      "}",
      "const artifactLocations = api.createMidnightDidZkArtifactLocations(expectedVersion);",
      "if (artifactLocations.ghcr.reference !== `${api.MIDNIGHT_DID_GHCR_ARTIFACT_REPOSITORY}:${expectedVersion}`) {",
      "  throw new Error('api package GHCR artifact metadata did not match package version');",
      "}",
      "console.log('[smoke-published-artifacts] imported ' + imports.length + ' package entry points from npm registry');",
      "",
    ].join("\n"),
  );
};

const smokeNpmPackages = async ({
  npmInstallAttempts,
  npmInstallRetryDelayMs,
  registry,
  version,
}) => {
  if (!version) {
    throw new Error("--version is required for npm registry smoke testing");
  }

  const token = process.env.NODE_AUTH_TOKEN ?? process.env.NPM_TOKEN;
  if (!token && registry === registryDefault) {
    throw new Error(
      "NODE_AUTH_TOKEN or NPM_TOKEN is required for GitHub Packages smoke testing",
    );
  }

  const consumerRoot = fs.mkdtempSync(path.join(os.tmpdir(), "did-npm-smoke-"));
  try {
    fs.writeFileSync(
      path.join(consumerRoot, "package.json"),
      JSON.stringify({ name: "did-npm-smoke", private: true, type: "module" }, null, 2) +
        "\n",
    );

    writeNpmAuthConfig({ directory: consumerRoot, registry, token });

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
            env: { ...process.env, npm_config_loglevel: "warn" },
          },
        );
        lastInstallError = undefined;
        break;
      } catch (error) {
        lastInstallError = error;
        if (attempt < npmInstallAttempts) {
          console.log(
            `[smoke-published-artifacts] npm install attempt ${attempt} failed; retrying in ${npmInstallRetryDelayMs}ms`,
          );
          await setTimeout(npmInstallRetryDelayMs);
        }
      }
    }

    if (lastInstallError) {
      throw lastInstallError;
    }

    writeConsumerSmokeScript(consumerRoot, version);
    run(process.execPath, ["smoke-imports.mjs"], { cwd: consumerRoot });
  } finally {
    fs.rmSync(consumerRoot, { force: true, recursive: true });
  }
};

const extractArchive = (archivePath) => {
  const absoluteArchivePath = path.resolve(archivePath);
  if (!fs.existsSync(absoluteArchivePath)) {
    throw new Error(`ZK artifact archive does not exist: ${absoluteArchivePath}`);
  }

  const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), "did-zk-smoke-"));
  run("tar", ["-xzf", absoluteArchivePath, "-C", extractRoot]);
  return extractRoot;
};

const artifactFilePath = (extractRoot, input) => {
  const url = new URL(String(input));
  const relativePath = url.pathname.replace(/^\/+/u, "");
  const normalizedPath = path.posix.normalize(relativePath);

  if (
    normalizedPath.startsWith("../") ||
    normalizedPath === ".." ||
    !/^(keys|zkir)\//u.test(normalizedPath)
  ) {
    return undefined;
  }

  return path.join(extractRoot, ...normalizedPath.split("/"));
};

const fileBackedFetch = (extractRoot) => async (input, init = {}) => {
  const method = init.method ?? "GET";
  if (method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      statusText: "Method Not Allowed",
    });
  }

  const filePath = artifactFilePath(extractRoot, input);
  if (filePath === undefined) {
    return new Response("Bad Request", {
      status: 400,
      statusText: "Bad Request",
    });
  }

  if (!fs.existsSync(filePath)) {
    return new Response("Not Found", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return new Response(fs.readFileSync(filePath), {
    status: 200,
    statusText: "OK",
  });
};

const serveExtractedArchive = async (extractRoot) => {
  const server = http.createServer((request, response) => {
    if (request.method !== "GET" || request.url === undefined) {
      response.writeHead(405).end("Method Not Allowed");
      return;
    }

    const filePath = artifactFilePath(
      extractRoot,
      `http://127.0.0.1${request.url}`,
    );
    if (filePath === undefined) {
      response.writeHead(400).end("Bad Request");
      return;
    }
    if (!fs.existsSync(filePath)) {
      response.writeHead(404).end("Not Found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("ZK artifact HTTP smoke server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};

const fetchProviderForExtractedArchive = async (extractRoot, zkFetchMode) => {
  switch (zkFetchMode) {
    case "http": {
      const server = await serveExtractedArchive(extractRoot);
      return {
        provider: new FetchZkConfigProvider(server.baseUrl),
        close: server.close,
        modeLabel: `runtime HTTP fetch from ${server.baseUrl}`,
      };
    }
    case "injected":
      return {
        provider: new FetchZkConfigProvider(
          providerBaseUrl,
          fileBackedFetch(extractRoot),
        ),
        close: async () => undefined,
        modeLabel: "injected file-backed fetch",
      };
    default:
      throw new Error("--zk-fetch-mode must be one of: http, injected");
  }
};

const smokeZkArchive = async ({ archivePath, version, zkFetchMode }) => {
  if (!archivePath) {
    throw new Error("--zk-archive is required for ZK provider smoke testing");
  }

  const extractRoot = extractArchive(archivePath);
  let providerContext;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extractRoot, "manifest.json"), "utf8"),
    );
    if (!Array.isArray(manifest.circuits) || manifest.circuits.length === 0) {
      throw new Error("ZK artifact manifest does not contain circuits");
    }
    if (version && manifest.version !== version) {
      throw new Error(
        `ZK artifact manifest version ${manifest.version} did not match ${version}`,
      );
    }

    providerContext = await fetchProviderForExtractedArchive(
      extractRoot,
      zkFetchMode,
    );
    for (const circuit of manifest.circuits) {
      await providerContext.provider.getProverKey(circuit.id);
      await providerContext.provider.getVerifierKey(circuit.id);
      await providerContext.provider.getZKIR(circuit.id);
    }

    console.log(
      `[smoke-published-artifacts] fetched ${manifest.circuits.length} circuits through FetchZkConfigProvider using ${providerContext.modeLabel}`,
    );
  } finally {
    await providerContext?.close();
    fs.rmSync(extractRoot, { force: true, recursive: true });
  }
};

const options = parseArgs();

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
  throw new Error("--npm-install-retry-delay-ms must be a non-negative integer");
}

if (!["http", "injected"].includes(options.zkFetchMode)) {
  throw new Error("--zk-fetch-mode must be one of: http, injected");
}

if (options.skipNpm && options.skipZk) {
  throw new Error("At least one smoke test must be enabled");
}

const artifactLocations = artifactLocationsForVersion(options.version);
if (artifactLocations && options.ociRef && options.ociRef !== artifactLocations.ghcr.reference) {
  throw new Error(
    `--oci-ref ${options.ociRef} does not match package version metadata ${artifactLocations.ghcr.reference}`,
  );
}
if (
  artifactLocations?.githubRelease &&
  options.githubReleaseTag &&
  options.githubReleaseTag !== artifactLocations.githubRelease.tag
) {
  throw new Error(
    `--github-release-tag ${options.githubReleaseTag} does not match package version metadata ${artifactLocations.githubRelease.tag}`,
  );
}
if (
  options.githubReleaseTag &&
  artifactLocations &&
  !artifactLocations.githubRelease
) {
  throw new Error("GitHub Release ZK artifacts are not published for snapshot versions");
}

if (!options.skipNpm) {
  await smokeNpmPackages(options);
}

if (!options.skipZk) {
  const resolvedArchive = resolveZkArchive(options);
  if (!resolvedArchive) {
    throw new Error(
      "A ZK artifact source is required: --zk-archive, --oci-ref, or --github-release-tag",
    );
  }
  try {
    await smokeZkArchive({
      archivePath: resolvedArchive.archivePath,
      version: options.version,
      zkFetchMode: options.zkFetchMode,
    });
  } finally {
    resolvedArchive.cleanup();
  }
}
