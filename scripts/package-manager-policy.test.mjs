#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const workspaceConfigPath = fileURLToPath(
  new URL("../pnpm-workspace.yaml", import.meta.url),
);

const readWorkspaceConfig = () => readFile(workspaceConfigPath, "utf8");

const readTopLevelList = (source, key) => {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line === `${key}:`);
  assert.notEqual(start, -1, `${key} must be configured`);

  const entries = [];
  for (const line of lines.slice(start + 1)) {
    if (line.length > 0 && !line.startsWith(" ")) {
      break;
    }
    const match = line.match(/^  - (\S+)$/);
    if (match) {
      entries.push(match[1]);
    }
  }
  return entries;
};

test("pnpm trust policy stays enabled with version-scoped exceptions", async () => {
  const workspaceConfig = await readWorkspaceConfig();

  assert.match(workspaceConfig, /^trustPolicy: no-downgrade$/m);
  assert.deepEqual(readTopLevelList(workspaceConfig, "trustPolicyExclude"), [
    "tinyexec@1.2.2",
    "pino@9.14.0",
  ]);
});
