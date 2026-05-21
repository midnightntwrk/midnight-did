#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const fixtureRoot = mkdtempSync(path.join(tmpdir(), "did-source-imports-"));
const scriptPath = path.join(repoRoot, "scripts/check-source-imports.mjs");

const runCheck = () =>
  spawnSync(process.execPath, [scriptPath, fixtureRoot], {
    cwd: repoRoot,
    encoding: "utf8",
  });

try {
  writeFileSync(path.join(fixtureRoot, "ok.ts"), "export const ok = true;\n");
  writeFileSync(
    path.join(fixtureRoot, "passes.ts"),
    'import { ok } from "./ok.js";\nexport { ok };\n',
  );

  const pass = runCheck();
  if (pass.status !== 0) {
    throw new Error(`expected valid fixture to pass, got ${pass.status}: ${pass.stderr}`);
  }

  writeFileSync(
    path.join(fixtureRoot, "fails.ts"),
    'import { ok } from "./ok";\nexport { ok };\n',
  );

  const fail = runCheck();
  if (fail.status === 0) {
    throw new Error("expected extensionless relative import fixture to fail");
  }
  if (!fail.stderr.includes('relative import "./ok" must include .js or .json')) {
    throw new Error(`unexpected failure output: ${fail.stderr}`);
  }

  console.log("check-source-imports contract passed");
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}
