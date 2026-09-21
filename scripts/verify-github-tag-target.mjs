#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  if (
    argv.length !== 4 ||
    argv[0] !== "--commit-json" ||
    argv[1].length === 0 ||
    argv[2] !== "--expected-sha" ||
    !/^[0-9a-f]{40}$/u.test(argv[3])
  ) {
    fail("Malformed tag-target verification arguments.");
  }
  return { commitJson: argv[1], expectedSha: argv[3] };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  let commit;
  try {
    commit = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        fs.readFileSync(options.commitJson),
      ),
    );
  } catch {
    fail(
      "Resolved GitHub tag target is malformed; provider output suppressed.",
    );
  }
  if (
    commit == null ||
    typeof commit !== "object" ||
    Array.isArray(commit) ||
    typeof commit.sha !== "string" ||
    !/^[0-9a-f]{40}$/u.test(commit.sha)
  ) {
    fail(
      "Resolved GitHub tag target is malformed; provider output suppressed.",
    );
  }
  if (commit.sha !== options.expectedSha) {
    fail("Resolved GitHub tag target differs from the publication commit.");
  }
}

try {
  main();
} catch (error) {
  console.error(`verify-github-tag-target: ${error.message}`);
  process.exitCode = 1;
}
