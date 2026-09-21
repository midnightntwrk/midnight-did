#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runner = path.join(repoRoot, "scripts/run-bounded-command.mjs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "did-bounded-command-"));
  return { output: path.join(root, "output.log"), root };
}

function run(output, timeoutMs, outputLimit, program) {
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    [
      runner,
      "--timeout-ms",
      String(timeoutMs),
      "--output-limit",
      String(outputLimit),
      "--output-file",
      output,
      "--",
      process.execPath,
      "-e",
      program,
    ],
    { cwd: repoRoot, encoding: "utf8", timeout: 5_000 },
  );
  return { elapsedMs: Date.now() - started, result };
}

test("kills a subprocess that never exits at the wall-clock bound", () => {
  const item = fixture();
  try {
    const { elapsedMs, result } = run(
      item.output,
      75,
      1_024,
      "setInterval(() => {}, 1000)",
    );
    assert.equal(result.status, 124, result.stderr);
    assert.ok(elapsedMs < 2_000, `timeout took ${elapsedMs}ms`);
  } finally {
    fs.rmSync(item.root, { force: true, recursive: true });
  }
});

test("kills an unbounded output subprocess before it can exceed the cap", () => {
  const item = fixture();
  try {
    const { elapsedMs, result } = run(
      item.output,
      4_000,
      1_024,
      'const chunk = "x".repeat(65536); setInterval(() => process.stdout.write(chunk), 0)',
    );
    assert.equal(result.status, 74, result.stderr);
    assert.ok(elapsedMs < 2_000, `output limit took ${elapsedMs}ms`);
    assert.ok(fs.statSync(item.output).size <= 1_024);
  } finally {
    fs.rmSync(item.root, { force: true, recursive: true });
  }
});
