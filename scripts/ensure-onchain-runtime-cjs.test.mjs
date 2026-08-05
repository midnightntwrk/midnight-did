#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const helper = path.join(repoRoot, "scripts/ensure-onchain-runtime-cjs.mjs");
const legacyRuntimeDir = path.join(
  repoRoot,
  "node_modules",
  "@midnight-ntwrk",
  "onchain-runtime",
);

const result = spawnSync(process.execPath, [helper], {
  cwd: repoRoot,
  encoding: "utf8",
});

assert.equal(result.status, 0, result.stderr);
if (!existsSync(legacyRuntimeDir)) {
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
}

console.log("onchain runtime compatibility helper checks passed.");
