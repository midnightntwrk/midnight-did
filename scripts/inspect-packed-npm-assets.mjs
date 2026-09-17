#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  npmPackageRegistry,
  packageManifestCatalog,
  publishWorkspaces,
  repositoryUrl,
} from "./did-workspace-catalog.mjs";

const canonicalWorkspaces = [
  "packages/jubjub-schnorr",
  "packages/contract",
  "packages/domain",
  "packages/did",
  "packages/api",
];
const canonicalPackageNames = [
  "@midnight-ntwrk/midnight-did-jubjub-schnorr",
  "@midnight-ntwrk/midnight-did-contract",
  "@midnight-ntwrk/midnight-did-domain",
  "@midnight-ntwrk/midnight-did",
  "@midnight-ntwrk/midnight-did-api",
];

function fail(message) {
  throw new Error(`[inspect-packed-npm-assets] ${message}`);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--assets-dir") options.assetsDir = args[++index];
    else if (args[index] === "--version") options.version = args[++index];
    else fail(`Unknown argument: ${args[index]}`);
  }
  if (!options.assetsDir || !options.version) {
    fail("--assets-dir and --version are required");
  }
  return options;
}

function readPackedManifest(tarball) {
  const result = spawnSync("tar", ["-xOzf", tarball, "package/package.json"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(
      `Unable to inspect packed manifest in ${tarball}: ${result.stderr.trim()}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`Packed manifest in ${tarball} is malformed: ${error.message}`);
  }
}

function tarballName(packageName, version) {
  return `${packageName.replace(/^@/u, "").replaceAll("/", "-")}-${version}.tgz`;
}

function sha512(filePath) {
  return `sha512-${createHash("sha512").update(fs.readFileSync(filePath)).digest("base64")}`;
}

function validatePackedManifest(manifest, workspace, expectedName, version) {
  if (manifest?.name !== expectedName || manifest?.version !== version) {
    fail(
      `Packed identity mismatch for ${workspace}: expected ${expectedName}@${version}, received ${manifest?.name}@${manifest?.version}`,
    );
  }
  if (
    manifest?.publishConfig?.registry !== npmPackageRegistry ||
    manifest?.publishConfig?.access !== "public"
  ) {
    fail(`Packed npm publish configuration is invalid for ${workspace}`);
  }
  if (
    manifest?.repository?.type !== "git" ||
    manifest?.repository?.url !== repositoryUrl ||
    manifest?.repository?.directory !== workspace
  ) {
    fail(`Packed repository ownership metadata is invalid for ${workspace}`);
  }
}

export function inspectPackedNpmAssets({ assetsDir: rawAssetsDir, version }) {
  if (
    JSON.stringify(publishWorkspaces) !== JSON.stringify(canonicalWorkspaces)
  ) {
    fail(
      `Publish catalog must contain exactly the five canonical workspaces in dependency order; received ${JSON.stringify(publishWorkspaces)}`,
    );
  }
  if (
    JSON.stringify(
      publishWorkspaces.map(
        (workspace) => packageManifestCatalog.get(workspace)?.name,
      ),
    ) !== JSON.stringify(canonicalPackageNames)
  ) {
    fail("Publish catalog package names differ from the canonical inventory");
  }
  if (
    npmPackageRegistry !== "https://registry.npmjs.org/" ||
    repositoryUrl !== "git+https://github.com/midnightntwrk/midnight-did.git"
  ) {
    fail("Canonical npm registry or repository ownership metadata is invalid");
  }

  const assetsDir = path.resolve(rawAssetsDir);
  if (!fs.statSync(assetsDir, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`Packed npm asset directory does not exist: ${assetsDir}`);
  }

  const directoryEntries = fs.readdirSync(assetsDir, { withFileTypes: true });
  if (
    directoryEntries.some(
      (entry) =>
        !entry.isFile() ||
        (entry.name !== "SHA256SUMS" && !entry.name.endsWith(".tgz")),
    )
  ) {
    fail("Packed npm asset directory contains an unexpected entry");
  }
  const actualAssets = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tgz"))
    .map((entry) => entry.name)
    .sort();
  const expectedAssets = canonicalPackageNames
    .map((name) => tarballName(name, version))
    .sort();
  if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
    fail(
      `Packed npm asset inventory differs from the expected five tarballs. expected=${expectedAssets.join(",")} actual=${actualAssets.join(",")}`,
    );
  }

  return publishWorkspaces.map((workspace, index) => {
    const expectedName = canonicalPackageNames[index];
    const tarball = path.join(assetsDir, tarballName(expectedName, version));
    validatePackedManifest(
      readPackedManifest(tarball),
      workspace,
      expectedName,
      version,
    );
    return [workspace, expectedName, version, tarball, sha512(tarball)].join(
      "\t",
    );
  });
}

const isDirectExecution =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const rows = inspectPackedNpmAssets(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${rows.join("\n")}\n`);
}
