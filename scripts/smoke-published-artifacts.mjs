#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

const parseArgs = () => {
  const options = {
    npmInstallAttempts: 3,
    npmInstallRetryDelayMs: 10_000,
    registry: registryDefault,
    skipNpm: false,
    skipZk: false,
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
      case "--npm-install-attempts":
        options.npmInstallAttempts = Number(args[++index]);
        break;
      case "--npm-install-retry-delay-ms":
        options.npmInstallRetryDelayMs = Number(args[++index]);
        break;
      case "--zk-archive":
        options.zkArchive = args[++index];
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
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
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

const publishedPackageNames = () =>
  publishWorkspaces.map((workspace) => {
    const manifest = packageManifestCatalog.get(workspace);
    if (!manifest) {
      throw new Error(`Missing package manifest catalog entry for ${workspace}`);
    }
    return manifest.name;
  });

const writeConsumerSmokeScript = (consumerRoot) => {
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
      "for (const specifier of imports) {",
      "  const module = await import(specifier);",
      "  if (Object.keys(module).length === 0) {",
      "    throw new Error(`${specifier} did not expose any exports`);",
      "  }",
      "}",
      "console.log(`[smoke-published-artifacts] imported ${imports.length} package entry points from npm registry`);",
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

    const npmrcLines = [`@midnight-ntwrk:registry=${registry}`];
    if (token) {
      const registryHost = new URL(registry).host;
      npmrcLines.push(`//${registryHost}/:_authToken=${token}`);
    }
    fs.writeFileSync(path.join(consumerRoot, ".npmrc"), `${npmrcLines.join("\n")}\n`);

    const packages = publishedPackageNames().map(
      (packageName) => `${packageName}@${version}`,
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

    writeConsumerSmokeScript(consumerRoot);
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

const fileBackedFetch = (extractRoot) => async (input, init = {}) => {
  const method = init.method ?? "GET";
  if (method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      statusText: "Method Not Allowed",
    });
  }

  const url = new URL(String(input));
  const relativePath = url.pathname.replace(/^\/+/u, "");
  const normalizedPath = path.normalize(relativePath);

  if (
    path.isAbsolute(normalizedPath) ||
    normalizedPath.startsWith(`..${path.sep}`) ||
    normalizedPath === ".." ||
    !/^(keys|zkir)\//u.test(normalizedPath)
  ) {
    return new Response("Bad Request", {
      status: 400,
      statusText: "Bad Request",
    });
  }

  const filePath = path.join(extractRoot, normalizedPath);
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

const smokeZkArchive = async ({ zkArchive }) => {
  if (!zkArchive) {
    throw new Error("--zk-archive is required for ZK provider smoke testing");
  }

  const extractRoot = extractArchive(zkArchive);
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extractRoot, "manifest.json"), "utf8"),
    );
    if (!Array.isArray(manifest.circuits) || manifest.circuits.length === 0) {
      throw new Error("ZK artifact manifest does not contain circuits");
    }

    const provider = new FetchZkConfigProvider(
      providerBaseUrl,
      fileBackedFetch(extractRoot),
    );
    for (const circuit of manifest.circuits) {
      await provider.getProverKey(circuit.id);
      await provider.getVerifierKey(circuit.id);
      await provider.getZKIR(circuit.id);
    }

    console.log(
      `[smoke-published-artifacts] fetched ${manifest.circuits.length} circuits through FetchZkConfigProvider`,
    );
  } finally {
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

if (options.skipNpm && options.skipZk) {
  throw new Error("At least one smoke test must be enabled");
}

if (!options.skipNpm) {
  await smokeNpmPackages(options);
}

if (!options.skipZk) {
  await smokeZkArchive(options);
}
