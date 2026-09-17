#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = { assets: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (value == null) fail("Malformed release-state verification arguments.");
    if (name === "--asset") options.assets.push(value);
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
    options.assets.length === 0
  ) {
    fail("Incomplete release-state verification arguments.");
  }
  return options;
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
        typeof asset.name !== "string",
    )
  ) {
    fail("GitHub Release state is malformed; provider output suppressed.");
  }
  if (release.isDraft) fail("Existing GitHub Release is unexpectedly a draft.");
  if (release.isPrerelease !== (options.prerelease === "true")) {
    fail("Existing GitHub Release prerelease state differs from the request.");
  }
  const expectedBody = fs.readFileSync(options["notes-file"], "utf8");
  if (release.body !== expectedBody) {
    fail(
      "Existing immutable GitHub Release body differs from the reviewed changelog notes.",
    );
  }
  const remoteNames = new Set(release.assets.map(({ name }) => name));
  for (const asset of options.assets) {
    const name = path.basename(asset);
    if (!remoteNames.has(name)) {
      fail(`Existing immutable GitHub Release is missing asset ${name}.`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`verify-github-release-state: ${error.message}`);
  process.exitCode = 1;
}
