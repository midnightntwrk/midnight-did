import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const script = resolve(dirname(fileURLToPath(import.meta.url)), "request-pr-reviews.mjs");
const repoRoot = resolve(dirname(script), "../..");

async function runCli(args, cwd = repoRoot) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...args], { cwd });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

test("dry-run resolves both review dispatches without mutating state", async () => {
  const result = await runCli([
    "--repo", "example/repo",
    "--pr", "42",
    "--head-sha", "abcdef1",
    "--skills", "documentation",
    "--dry-run",
  ], dirname(script));
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "dry-run");
  assert.equal(payload.external.commands.length, 2);
  assert.deepEqual(payload.local.map(({ agent }) => agent), ["claude", "agy"]);
});

test("rejects unsafe local agent names", async () => {
  const result = await runCli([
    "--repo", "example/repo",
    "--pr", "42",
    "--head-sha", "abcdef1",
    "--local-agents", "../unexpected",
    "--dry-run",
  ]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /local-agents entries/);
});
