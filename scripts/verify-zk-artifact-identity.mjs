#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const parseArgs = () => {
  const options = {};
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--expected-archive") options.expectedArchive = args[++index];
    else if (arg === "--actual-archive") options.actualArchive = args[++index];
    else if (arg === "--expected-manifest")
      options.expectedManifest = args[++index];
    else if (arg === "--actual-manifest")
      options.actualManifest = args[++index];
    else if (arg === "--help") {
      console.log(
        "Usage: verify-zk-artifact-identity.mjs --expected-archive <path> --actual-archive <path> [--expected-manifest <path> --actual-manifest <path>]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.expectedArchive || !options.actualArchive) {
    throw new Error(
      "Both --expected-archive and --actual-archive are required",
    );
  }
  if (Boolean(options.expectedManifest) !== Boolean(options.actualManifest)) {
    throw new Error("Both manifest paths must be provided together");
  }
  return options;
};

const sha256 = (filePath) =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const walk = (root, relative = "") => {
  const entries = fs
    .readdirSync(path.join(root, relative), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...walk(root, entryPath));
    else if (entry.isFile()) files.push(entryPath);
    else throw new Error(`Unexpected archive entry type: ${entryPath}`);
  }
  return files;
};

const comparableManifest = (manifest) => {
  const copy = structuredClone(manifest);
  delete copy.generatedAt;
  delete copy.gitSha;
  return copy;
};

const extract = (archive, destination) => {
  fs.mkdirSync(destination, { recursive: true });
  const result = spawnSync("tar", ["-xzf", archive, "-C", destination], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Unable to extract ${archive}:\n${result.stdout}${result.stderr}`,
    );
  }
};

const options = parseArgs();
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "midnight-did-zk-identity-"),
);
try {
  const expectedRoot = path.join(temporaryRoot, "expected");
  const actualRoot = path.join(temporaryRoot, "actual");
  extract(options.expectedArchive, expectedRoot);
  extract(options.actualArchive, actualRoot);

  const expectedManifest = JSON.parse(
    fs.readFileSync(path.join(expectedRoot, "manifest.json"), "utf8"),
  );
  const actualManifest = JSON.parse(
    fs.readFileSync(path.join(actualRoot, "manifest.json"), "utf8"),
  );
  assert.deepEqual(
    comparableManifest(actualManifest),
    comparableManifest(expectedManifest),
    "ZK bundle manifests differ",
  );

  const expectedFiles = walk(expectedRoot).filter(
    (file) => file !== "manifest.json",
  );
  const actualFiles = walk(actualRoot).filter(
    (file) => file !== "manifest.json",
  );
  assert.deepEqual(actualFiles, expectedFiles, "ZK bundle file lists differ");
  for (const relativePath of expectedFiles) {
    assert.equal(
      sha256(path.join(actualRoot, relativePath)),
      sha256(path.join(expectedRoot, relativePath)),
      `ZK bundle file differs: ${relativePath}`,
    );
  }

  if (options.expectedManifest) {
    const expectedExternal = JSON.parse(
      fs.readFileSync(options.expectedManifest, "utf8"),
    );
    const actualExternal = JSON.parse(
      fs.readFileSync(options.actualManifest, "utf8"),
    );
    assert.deepEqual(
      comparableManifest(actualExternal),
      comparableManifest(expectedExternal),
      "External ZK manifests differ",
    );
    assert.deepEqual(
      comparableManifest(actualExternal),
      comparableManifest(actualManifest),
      "External ZK manifest does not match its archive",
    );
  }
} finally {
  fs.rmSync(temporaryRoot, { force: true, recursive: true });
}

console.log("[verify-zk-artifact-identity] ZK artifact payloads match");
