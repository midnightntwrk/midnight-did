#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { publishWorkspaces } from "./did-workspace-catalog.mjs";

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

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Unable to read ${description} ${filePath}: ${error.message}`);
  }
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

const { assetsDir: rawAssetsDir, version } = parseArgs(process.argv.slice(2));
const assetsDir = path.resolve(rawAssetsDir);

if (JSON.stringify(publishWorkspaces) !== JSON.stringify(canonicalWorkspaces)) {
  fail(
    `Publish catalog must contain exactly the five canonical workspaces in dependency order; received ${JSON.stringify(publishWorkspaces)}`,
  );
}
if (!fs.statSync(assetsDir, { throwIfNoEntry: false })?.isDirectory()) {
  fail(`Packed npm asset directory does not exist: ${assetsDir}`);
}

const actualAssets = fs
  .readdirSync(assetsDir, { withFileTypes: true })
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

const rows = publishWorkspaces.map((workspace, index) => {
  const expectedName = canonicalPackageNames[index];
  const workspaceManifestPath = path.join(workspace, "package.json");
  const workspaceManifest = readJson(
    workspaceManifestPath,
    "workspace manifest",
  );
  if (
    workspaceManifest.name !== expectedName ||
    workspaceManifest.version !== version
  ) {
    fail(
      `Workspace identity mismatch for ${workspace}: expected ${expectedName}@${version}, received ${workspaceManifest.name}@${workspaceManifest.version}`,
    );
  }

  const tarball = path.join(assetsDir, tarballName(expectedName, version));
  const packedManifest = readPackedManifest(tarball);
  if (
    packedManifest.name !== expectedName ||
    packedManifest.version !== version
  ) {
    fail(
      `Packed identity mismatch for ${tarball}: expected ${expectedName}@${version}, received ${packedManifest.name}@${packedManifest.version}`,
    );
  }

  return [workspace, expectedName, version, tarball, sha512(tarball)].join(
    "\t",
  );
});

process.stdout.write(`${rows.join("\n")}\n`);
