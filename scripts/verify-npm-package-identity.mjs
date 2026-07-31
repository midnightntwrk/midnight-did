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
    if (arg === "--expected") options.expected = args[++index];
    else if (arg === "--actual") options.actual = args[++index];
    else if (arg === "--help") {
      console.log(
        "Usage: verify-npm-package-identity.mjs --expected <tarball> --actual <tarball>",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.expected || !options.actual) {
    throw new Error("Both --expected and --actual are required");
  }
  return options;
};

const sha256 = (filePath) =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const sortedJson = (value) => {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortedJson(child)]),
    );
  }
  return value;
};

const walk = (root, relative = "") => {
  const entries = fs
    .readdirSync(path.join(root, relative), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...walk(root, entryPath));
    else if (entry.isFile()) files.push(entryPath);
    else throw new Error(`Unexpected package entry type: ${entryPath}`);
  }
  return files;
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
  path.join(os.tmpdir(), "midnight-did-npm-identity-"),
);
try {
  const expectedRoot = path.join(temporaryRoot, "expected");
  const actualRoot = path.join(temporaryRoot, "actual");
  extract(options.expected, expectedRoot);
  extract(options.actual, actualRoot);

  const expectedFiles = walk(expectedRoot);
  const actualFiles = walk(actualRoot);
  assert.deepEqual(actualFiles, expectedFiles, "npm package file lists differ");

  for (const relativePath of expectedFiles) {
    const expectedPath = path.join(expectedRoot, relativePath);
    const actualPath = path.join(actualRoot, relativePath);
    if (relativePath === path.join("package", "package.json")) {
      assert.deepEqual(
        sortedJson(JSON.parse(fs.readFileSync(actualPath, "utf8"))),
        sortedJson(JSON.parse(fs.readFileSync(expectedPath, "utf8"))),
        "npm package manifests differ",
      );
    } else {
      assert.equal(
        sha256(actualPath),
        sha256(expectedPath),
        `npm package file differs: ${relativePath}`,
      );
    }
  }
} finally {
  fs.rmSync(temporaryRoot, { force: true, recursive: true });
}

console.log("[verify-npm-package-identity] npm package payloads match");
