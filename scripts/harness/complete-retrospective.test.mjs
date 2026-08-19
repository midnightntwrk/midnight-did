import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { completeRetrospective } from "./complete-retrospective.mjs";

const execFileAsync = promisify(execFile);
const artifact = {
  repo: "example/repo",
  issue: 426,
  pr: 42,
  headSha: "abcdef1234567890",
};

async function makeRecord(root, issue = 426, name = "issue.md") {
  await mkdir(path.join(root, "docs", "retrospectives"), { recursive: true });
  await writeFile(
    path.join(root, "docs", "retrospectives", name),
    `# Retrospective\n\nCanonical tracker: https://github.com/example/repo/issues/${issue}\n\n${"evidence ".repeat(20)}\n`,
  );
  return `docs/retrospectives/${name}`;
}

async function initAndTrack(root, record) {
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["add", "--", record], { cwd: root });
}

test("writes an exact-issue/artifact-bound checkpoint and record digest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "retro-complete-"));
  try {
    const record = await makeRecord(root);
    await initAndTrack(root, record);
    const result = await completeRetrospective({
      repoRoot: root,
      record,
      now: new Date("2026-08-19T13:00:00.000Z"),
      ...artifact,
    });
    const checkpoint = JSON.parse(
      await readFile(result.checkpointPath, "utf8"),
    );
    assert.deepEqual(checkpoint.artifact, {
      kind: "pr",
      repo: artifact.repo,
      issue: artifact.issue,
      number: artifact.pr,
      headSha: artifact.headSha,
    });
    assert.equal(checkpoint.record, record);
    assert.match(checkpoint.recordSha256, /^[0-9a-f]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects prefix-collision, cross-issue reuse, and untracked records", async (t) => {
  await t.test("issue 4260 does not satisfy issue 426", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "retro-prefix-"));
    try {
      const record = await makeRecord(root, 4260);
      await initAndTrack(root, record);
      await assert.rejects(
        completeRetrospective({ repoRoot: root, record, ...artifact }),
        /exact issue #426/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await t.test("issue 426 cannot be reused for issue 427", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "retro-cross-"));
    try {
      const record = await makeRecord(root, 426);
      await initAndTrack(root, record);
      await assert.rejects(
        completeRetrospective({
          repoRoot: root,
          record,
          ...artifact,
          issue: 427,
        }),
        /exact issue #427/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await t.test("record must be Git-tracked", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "retro-untracked-"));
    try {
      const record = await makeRecord(root);
      await execFileAsync("git", ["init", "-q"], { cwd: root });
      await assert.rejects(
        completeRetrospective({ repoRoot: root, record, ...artifact }),
        /not Git-tracked/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
