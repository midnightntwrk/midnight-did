#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";

const canonicalProvenanceName = "multiple.intoto.jsonl";

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      value == null ||
      !["--status", "--output-file"].includes(name) ||
      options.has(name)
    ) {
      fail("Malformed release-view classification arguments.");
    }
    options.set(name, value);
  }
  if (
    options.size !== 2 ||
    !/^(?:0|[1-9]\d*)$/u.test(options.get("--status"))
  ) {
    fail("Incomplete release-view classification arguments.");
  }
  return {
    outputFile: options.get("--output-file"),
    status: Number(options.get("--status")),
  };
}

function classify({ outputFile, status }) {
  const output = fs.readFileSync(outputFile);
  if (
    status === 1 &&
    output.equals(Buffer.from("release not found\n", "utf8"))
  ) {
    return "absent";
  }
  if (status !== 0) {
    fail(
      "GitHub Release state could not be confirmed; provider output suppressed.",
    );
  }

  let release;
  try {
    release = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(output),
    );
  } catch {
    fail("GitHub Release state is malformed; provider output suppressed.");
  }
  if (
    release == null ||
    typeof release !== "object" ||
    Array.isArray(release) ||
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

  const provenanceNames = release.assets
    .map(({ name }) => name)
    .filter((name) => name.endsWith(".intoto.jsonl"));
  if (
    provenanceNames.length !== 1 ||
    provenanceNames[0] !== canonicalProvenanceName
  ) {
    fail(
      `Existing GitHub Release must contain exactly ${canonicalProvenanceName}; provider output suppressed.`,
    );
  }
  return "present";
}

try {
  console.log(classify(parseArguments(process.argv.slice(2))));
} catch (error) {
  console.error(`classify-github-release-view: ${error.message}`);
  process.exitCode = 1;
}
