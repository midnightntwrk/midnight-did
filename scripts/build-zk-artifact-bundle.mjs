#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { repositoryUrl } from "./did-workspace-catalog.mjs";
import { explainProfile } from "./managed-artifact-catalog.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const parseArgs = () => {
  const options = {
    outDir: "artifacts/zk",
    managedRoot: "packages/contract/dist/managed/did",
  };
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--version":
        options.version = args[++index];
        break;
      case "--out-dir":
        options.outDir = args[++index];
        break;
      case "--managed-root":
        options.managedRoot = args[++index];
        break;
      case "--github-output":
        options.githubOutput = args[++index];
        break;
      case "--help":
        console.log(
          [
            "Usage: build-zk-artifact-bundle.mjs --version <version> [options]",
            "",
            "Options:",
            "  --out-dir <path>       Output directory. Defaults to artifacts/zk.",
            "  --managed-root <path>  DID managed artifact root.",
            "  --github-output <path> Append output paths for GitHub Actions.",
          ].join("\n"),
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
};

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

const sha256 = (filePath) =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const git = (...args) => {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

const compactVersion = () => {
  if (process.env.COMPACT_COMPILER_VERSION) {
    return process.env.COMPACT_COMPILER_VERSION;
  }
  try {
    return execFileSync("compact", ["compile", "--version"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
};

const copyFile = (source, target) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};

const writeGitHubOutput = (outputPath, entries) => {
  if (!outputPath) {
    return;
  }
  const lines = Object.entries(entries).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
};

const requireDirectory = (label, directory) => {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`${label} does not exist: ${directory}`);
  }
};

const options = parseArgs();
const rootPackage = readJson("package.json");
const version = options.version ?? rootPackage.version;
const managedRoot = path.resolve(repoRoot, options.managedRoot);
const keysRoot = path.join(managedRoot, "keys");
const zkirRoot = path.join(managedRoot, "zkir");

requireDirectory("managed root", managedRoot);
requireDirectory("managed keys directory", keysRoot);
requireDirectory("managed zkir directory", zkirRoot);

const circuitIds = fs
  .readdirSync(keysRoot)
  .filter((fileName) => fileName.endsWith(".prover"))
  .map((fileName) => fileName.replace(/\.prover$/u, ""))
  .sort();

if (circuitIds.length === 0) {
  throw new Error(`No prover keys found in ${keysRoot}`);
}

const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "midnight-did-zk-"));
const outDir = path.resolve(repoRoot, options.outDir);
fs.mkdirSync(outDir, { recursive: true });

const sourceManifest = explainProfile("contract").sourceManifest;
const circuits = [];

for (const circuitId of circuitIds) {
  const files = {
    prover: `keys/${circuitId}.prover`,
    verifier: `keys/${circuitId}.verifier`,
    zkir: `zkir/${circuitId}.bzkir`,
  };
  const sourceFiles = {
    prover: path.join(keysRoot, `${circuitId}.prover`),
    verifier: path.join(keysRoot, `${circuitId}.verifier`),
    zkir: path.join(zkirRoot, `${circuitId}.bzkir`),
  };

  for (const [kind, sourcePath] of Object.entries(sourceFiles)) {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`${circuitId}: missing ${kind} artifact ${sourcePath}`);
    }
    copyFile(sourcePath, path.join(stagingRoot, files[kind]));
  }

  circuits.push({
    id: circuitId,
    files,
    sha256: Object.fromEntries(
      Object.entries(sourceFiles).map(([kind, sourcePath]) => [
        kind,
        sha256(sourcePath),
      ]),
    ),
    bytes: Object.fromEntries(
      Object.entries(sourceFiles).map(([kind, sourcePath]) => [
        kind,
        fs.statSync(sourcePath).size,
      ]),
    ),
  });
}

const manifest = {
  schema: "midnight-did-zk-artifacts",
  schemaVersion: 1,
  version,
  packageName: "@midnight-ntwrk/midnight-did-contract",
  repository: repositoryUrl,
  gitSha: process.env.GITHUB_SHA ?? git("rev-parse", "HEAD") ?? "unknown",
  generatedAt: new Date().toISOString(),
  compactCompilerVersion: compactVersion(),
  managedRoot: options.managedRoot,
  providerLayout: {
    proverKey: "keys/{circuitId}.prover",
    verifierKey: "keys/{circuitId}.verifier",
    zkir: "zkir/{circuitId}.bzkir",
  },
  sourceManifest,
  circuits,
  totals: {
    circuitCount: circuits.length,
    bytes: circuits.reduce(
      (total, circuit) =>
        total + circuit.bytes.prover + circuit.bytes.verifier + circuit.bytes.zkir,
      0,
    ),
  },
};

const safeVersion = version.replace(/[^0-9A-Za-z._-]/gu, "_");
const archiveName = `midnight-did-zk-artifacts-${safeVersion}.tar.gz`;
const manifestName = `midnight-did-zk-artifacts-${safeVersion}.manifest.json`;
const archivePath = path.join(outDir, archiveName);
const manifestPath = path.join(outDir, manifestName);
const sha256Path = `${archivePath}.sha256`;

fs.writeFileSync(
  path.join(stagingRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const tar = spawnSync("tar", ["-czf", archivePath, "-C", stagingRoot, "."], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (tar.status !== 0) {
  throw new Error(`tar failed:\n${tar.stdout}${tar.stderr}`);
}

const archiveSha = sha256(archivePath);
fs.writeFileSync(sha256Path, `${archiveSha}  ${archiveName}\n`);

fs.rmSync(stagingRoot, { force: true, recursive: true });

writeGitHubOutput(options.githubOutput, {
  zk_archive: archivePath,
  zk_archive_name: archiveName,
  zk_manifest: manifestPath,
  zk_manifest_name: manifestName,
  zk_sha256: sha256Path,
  zk_archive_digest: archiveSha,
});

console.log(
  `[build-zk-artifact-bundle] ${archiveName}: ${circuits.length} circuits, ${manifest.totals.bytes} bytes before gzip`,
);
console.log(`[build-zk-artifact-bundle] archive sha256 ${archiveSha}`);
