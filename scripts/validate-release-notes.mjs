#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  throw new Error(message);
}

export function readCanonicalReleaseNotes(notesFile) {
  const status = fs.lstatSync(notesFile, { throwIfNoEntry: false });
  if (status == null || !status.isFile() || status.isSymbolicLink()) {
    fail("Reviewed changelog notes must be a regular non-symlink file.");
  }
  const bytes = fs.readFileSync(notesFile);
  let notes;
  try {
    notes = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("Reviewed changelog notes must be valid UTF-8.");
  }
  if (
    bytes.includes(0x0d) ||
    bytes.length === 0 ||
    bytes.at(-1) !== 0x0a ||
    (bytes.length > 1 && bytes.at(-2) === 0x0a)
  ) {
    fail(
      "Reviewed changelog notes must use LF line endings and exactly one terminal newline.",
    );
  }
  return notes;
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--notes-file" || argv[1].length === 0) {
    fail("Usage: validate-release-notes.mjs --notes-file FILE");
  }
  return argv[1];
}

const isDirectExecution =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    readCanonicalReleaseNotes(parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(`validate-release-notes: ${error.message}`);
    process.exitCode = 1;
  }
}
