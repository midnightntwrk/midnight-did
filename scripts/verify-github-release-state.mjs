#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

import { readCanonicalReleaseNotes } from "./validate-release-notes.mjs";

const canonicalProvenanceName = "multiple.intoto.jsonl";

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = { assetNames: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (value == null) fail("Malformed release-state verification arguments.");
    if (name === "--asset") options.assetNames.push(path.basename(value));
    else if (name === "--asset-name") options.assetNames.push(value);
    else if (
      ["--release-json", "--notes-file", "--prerelease"].includes(name) &&
      options[name.slice(2)] == null
    ) {
      options[name.slice(2)] = value;
    } else fail("Malformed release-state verification arguments.");
  }
  if (
    options["release-json"] == null ||
    options["notes-file"] == null ||
    !["true", "false"].includes(options.prerelease) ||
    options.assetNames.length === 0
  ) {
    fail("Incomplete release-state verification arguments.");
  }
  if (
    options.assetNames.some(
      (name) =>
        name.length === 0 ||
        path.basename(name) !== name ||
        name === "." ||
        name === "..",
    )
  ) {
    fail("Expected release asset names must be non-empty basenames.");
  }
  const expectedNames = new Set(options.assetNames);
  if (expectedNames.size !== options.assetNames.length) {
    fail("Expected release asset names contain a duplicate.");
  }
  if (
    !expectedNames.has(canonicalProvenanceName) ||
    [...expectedNames].filter((name) => name.endsWith(".intoto.jsonl"))
      .length !== 1
  ) {
    fail(
      `Expected release assets must include exactly ${canonicalProvenanceName}.`,
    );
  }
  return { ...options, expectedNames };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  let release;
  try {
    release = JSON.parse(fs.readFileSync(options["release-json"], "utf8"));
  } catch {
    fail("GitHub Release state is malformed; provider output suppressed.");
  }
  if (
    release == null ||
    typeof release !== "object" ||
    Array.isArray(release) ||
    typeof release.isDraft !== "boolean" ||
    typeof release.isPrerelease !== "boolean" ||
    typeof release.body !== "string" ||
    !Array.isArray(release.assets) ||
    release.assets.some(
      (asset) =>
        asset == null ||
        typeof asset !== "object" ||
        Array.isArray(asset) ||
        typeof asset.name !== "string" ||
        asset.name.length === 0,
    )
  ) {
    fail("GitHub Release state is malformed; provider output suppressed.");
  }
  if (release.isDraft) fail("Existing GitHub Release is unexpectedly a draft.");
  if (release.isPrerelease !== (options.prerelease === "true")) {
    fail("Existing GitHub Release prerelease state differs from the request.");
  }
  const expectedBody = readCanonicalReleaseNotes(options["notes-file"]);
  if (release.body !== expectedBody) {
    fail(
      "Existing immutable GitHub Release body differs byte-for-byte from the reviewed changelog notes.",
    );
  }

  const remoteNameList = release.assets.map(({ name }) => name);
  const remoteNames = new Set(remoteNameList);
  if (remoteNames.size !== remoteNameList.length) {
    fail("Existing immutable GitHub Release contains duplicate asset names.");
  }
  const missing = [...options.expectedNames]
    .filter((name) => !remoteNames.has(name))
    .sort();
  const extra = [...remoteNames]
    .filter((name) => !options.expectedNames.has(name))
    .sort();
  if (missing.length > 0 || extra.length > 0) {
    fail("Existing immutable GitHub Release asset multiset is not canonical.");
  }
}

try {
  main();
} catch (error) {
  console.error(`verify-github-release-state: ${error.message}`);
  process.exitCode = 1;
}
