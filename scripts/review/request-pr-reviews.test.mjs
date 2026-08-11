import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const script = resolve(dirname(fileURLToPath(import.meta.url)), "request-pr-reviews.mjs");
const repoRoot = resolve(dirname(script), "../..");

async function runCli(args, cwd = repoRoot, env = process.env) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...args], { cwd, env });
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
  assert.deepEqual(payload.external.reviewers, ["patextreme"]);
  assert.match(payload.external.commands[1], /--reviewers patextreme/);
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

test("rejects malformed repository names", async () => {
  const result = await runCli([
    "--repo", "owner/../repo",
    "--pr", "42",
    "--head-sha", "abcdef1",
    "--dry-run",
  ]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /repo must be owner\/name/);
});

test("requires user-level agent-peer-review configuration before dispatch", async () => {
  const temporaryRepo = await mkdtemp(join(tmpdir(), "pr-review-config-"));
  try {
    await writeFile(join(temporaryRepo, ".git"), "gitdir: test\\n");
    const result = await runCli([
      "--repo", "example/repo",
      "--pr", "42",
      "--head-sha", "abcdef3",
    ], temporaryRepo, {
      ...process.env,
      AGENT_PEER_REVIEW_CONFIG: join(temporaryRepo, "missing-config.json"),
    });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /global configuration is missing/);
    assert.match(result.stderr, /ask the user to run/);
  } finally {
    await rm(temporaryRepo, { recursive: true, force: true });
  }
});

test("reuses only a successful per-head ledger", { skip: process.platform === "win32" }, async () => {
  const temporaryRepo = await mkdtemp(join(tmpdir(), "pr-review-dispatch-"));
  const bin = join(temporaryRepo, "bin");
  await mkdir(bin);
  await writeFile(join(temporaryRepo, ".git"), "gitdir: test\n");
  const log = join(temporaryRepo, "invocations.log");
  const config = join(temporaryRepo, "agent-peer-review-config.json");
  await writeFile(config, JSON.stringify({ defaultRepo: "example/repo" }));
  const external = join(temporaryRepo, "agent-review.cjs");
  await writeFile(external, `#!/usr/bin/env node\nconst fs = require("node:fs");\nfs.appendFileSync(process.env.REVIEW_TEST_LOG, process.argv.slice(2).join(" ") + "\\n");\nconsole.log(JSON.stringify({ ok: true }));\n`);
  await chmod(external, 0o755);
  for (const agent of ["local-one", "local-two"]) {
    const file = join(bin, agent);
    await writeFile(file, `#!/bin/sh\nprintf '%s\\n' "$0" >> "$REVIEW_TEST_LOG"\n`);
    await chmod(file, 0o755);
  }
  const env = {
    ...process.env,
    AGENT_REVIEW_CLI: external,
    AGENT_PEER_REVIEW_CONFIG: config,
    REVIEW_TEST_LOG: log,
    PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
  };
  const args = [
    "--repo", "example/repo",
    "--pr", "42",
    "--head-sha", "abcdef2",
    "--local-agents", "local-one,local-two",
  ];

  try {
    const first = await runCli(args, temporaryRepo, env);
    assert.equal(first.code, 0, `${first.stderr}\n${first.stdout}`);
    assert.equal(JSON.parse(first.stdout).status, "completed");
    assert.equal((await readFile(log, "utf8")).trim().split("\n").length, 4);

    const second = await runCli(args, temporaryRepo, env);
    assert.equal(second.code, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).status, "already-dispatched");
    assert.equal((await readFile(log, "utf8")).trim().split("\n").length, 4);
  } finally {
    await rm(temporaryRepo, { recursive: true, force: true });
  }
});
