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

const formatResult = (result) =>
  [`status=${result.status}`, result.stdout, result.stderr]
    .filter((value) => value)
    .join("\n");

try {
  writeFileSync(path.join(fixtureRoot, "ok.ts"), "export const ok = true;\n");
  writeFileSync(
    path.join(fixtureRoot, "passes.ts"),
    [
      'import { ok } from "./ok.js";',
      'import { strict as assert } from "node:assert";',
      'const dynamic = import("./ok.js");',
      'export * from "./ok.js";',
      'vi.mock("./ok.js", () => ({ ok: true }));',
      "export { ok, assert, dynamic };",
      "",
    ].join("\n"),
  );

  const pass = runCheck();
  if (pass.status !== 0) {
    throw new Error(`expected valid fixture to pass:\n${formatResult(pass)}`);
  }

  writeFileSync(
    path.join(fixtureRoot, "fails.ts"),
    [
      'import { ok } from "./ok";',
      'const dynamic = import("./ok");',
      'export * from "./ok";',
      'vi.mock("./ok", () => ({ ok: true }));',
      "export { ok, dynamic };",
      "",
    ].join("\n"),
  );

  const fail = runCheck();
  if (fail.status === 0) {
    throw new Error("expected extensionless relative import fixture to fail");
  }
  const violationCount = fail.stderr.match(
    /relative import "\.\/ok" must include \.js or \.json/g,
  )?.length;
  if ((violationCount ?? 0) < 4) {
    throw new Error(`unexpected failure output: ${fail.stderr}`);
  }

  console.log("check-source-imports contract passed");
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}
