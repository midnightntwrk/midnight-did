#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const fixtureRoot = mkdtempSync(path.join(tmpdir(), "did-engine-imports-"));
const scriptPath = path.join(repoRoot, "scripts/check-engine-agnostic-imports.mjs");

const runCheck = (...sourceRoots) =>
  spawnSync(process.execPath, [scriptPath, ...sourceRoots], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const formatResult = (result) =>
  [`status=${result.status}`, result.stdout, result.stderr]
    .filter((value) => value)
    .join("\n");

try {
  mkdirSync(path.join(fixtureRoot, "test"));
  writeFileSync(
    path.join(fixtureRoot, "passes.ts"),
    [
      'type NodeCrypto = typeof import("node:crypto");',
      'const crypto = await import("node:crypto");',
      "export type { NodeCrypto };",
      "export { crypto };",
      "",
    ].join("\n"),
  );
  writeFileSync(
    path.join(fixtureRoot, "test", "node-test-import.ts"),
    'import { strict as assert } from "node:assert";\nexport { assert };\n',
  );

  const pass = runCheck(fixtureRoot);
  if (pass.status !== 0) {
    throw new Error(`expected valid fixture to pass:\n${formatResult(pass)}`);
  }

  writeFileSync(
    path.join(fixtureRoot, "file-root-pass.ts"),
    'export const value = "browser-safe";\n',
  );
  const fileRootPass = runCheck(path.join(fixtureRoot, "file-root-pass.ts"));
  if (fileRootPass.status !== 0) {
    throw new Error(
      `expected valid file root to pass:\n${formatResult(fileRootPass)}`,
    );
  }

  writeFileSync(
    path.join(fixtureRoot, "fails.ts"),
    [
      'import { createHash } from "node:crypto";',
      'export { readFile } from "node:fs/promises";',
      "export { createHash };",
      "",
    ].join("\n"),
  );

  const fail = runCheck(fixtureRoot);
  if (fail.status === 0) {
    throw new Error("expected static node import fixture to fail");
  }
  if (!fail.stderr.includes("static node:crypto import")) {
    throw new Error(`missing node:crypto violation:\n${formatResult(fail)}`);
  }
  if (!fail.stderr.includes("static node:fs/promises import")) {
    throw new Error(`missing node:fs violation:\n${formatResult(fail)}`);
  }

  console.log("check-engine-agnostic-imports contract passed");
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}
