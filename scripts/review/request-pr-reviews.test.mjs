import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const script = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "request-pr-reviews.mjs",
);
const repoRoot = resolve(dirname(script), "../..");
const expectedHead = "abcdef1234567890";

async function runCli(args, cwd = repoRoot, env = process.env) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...args], {
      cwd,
      env,
      timeout: 10_000,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

async function makeHarness({ heads = [expectedHead], externalExit = 0 } = {}) {
  const root = await mkdtemp(join(tmpdir(), "pr-review-dispatch-"));
  const bin = join(root, "bin");
  await mkdir(join(root, ".github"), { recursive: true });
  await mkdir(join(root, ".pi"), { recursive: true });
  await mkdir(join(root, "docs", "retrospectives"), { recursive: true });
  await mkdir(bin);
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  const policy = {
    version: 1,
    routedReview: { backend: "agent-review", reviewers: ["patextreme"] },
    audit: {
      requiredReviewerLogins: ["patextreme"],
      structuredMarker: "agentflow-pr-review",
      cleanVerdicts: ["approved"],
      findingVerdicts: ["findings"],
      timeoutVerdicts: ["timeout"],
      pageSize: 100,
      maxPages: 10,
    },
  };
  await writeFile(
    join(root, ".github", "review-policy.json"),
    JSON.stringify(policy),
  );
  const recordContent = `# Test retrospective\n\nCanonical tracker: https://github.com/example/repo/issues/426\n\n${"evidence ".repeat(20)}\n`;
  await writeFile(
    join(root, "docs", "retrospectives", "test.md"),
    recordContent,
  );
  await execFileAsync("git", ["add", "--", "docs/retrospectives/test.md"], {
    cwd: root,
  });
  await writeFile(
    join(root, ".pi", "dev-loop-retrospective-checkpoint.json"),
    JSON.stringify({
      state: "complete",
      artifact: {
        kind: "pr",
        repo: "example/repo",
        issue: 426,
        number: 42,
        headSha: expectedHead,
      },
      record: "docs/retrospectives/test.md",
      recordSha256: createHash("sha256").update(recordContent).digest("hex"),
      notes: "Tracked retrospective: docs/retrospectives/test.md",
    }),
  );
  const config = join(root, "agent-peer-review-config.json");
  await writeFile(config, JSON.stringify({ defaultRepo: "example/repo" }));
  const log = join(root, "agent-review.log");
  const external = join(root, "agent-review.cjs");
  await writeFile(
    external,
    `#!/usr/bin/env node\nconst fs = require("node:fs");\nfs.appendFileSync(process.env.REVIEW_TEST_LOG, process.argv.slice(2).join(" ") + "\\n");\nprocess.exit(${externalExit});\n`,
  );
  await chmod(external, 0o755);
  const headCount = join(root, "head-count");
  const github = join(root, "fake-gh.cjs");
  await writeFile(
    github,
    `#!/usr/bin/env node\nconst fs = require("node:fs");\nconst file = process.env.REVIEW_HEAD_COUNT;\nconst count = fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8")) : 0;\nconst heads = JSON.parse(process.env.REVIEW_TEST_HEADS);\nfs.writeFileSync(file, String(count + 1));\nconsole.log(heads[Math.min(count, heads.length - 1)]);\n`,
  );
  await chmod(github, 0o755);
  const env = {
    ...process.env,
    AGENT_REVIEW_CLI: external,
    AGENT_PEER_REVIEW_CONFIG: config,
    GITHUB_CLI: github,
    REVIEW_HEAD_COUNT: headCount,
    REVIEW_TEST_HEADS: JSON.stringify(heads),
    REVIEW_TEST_LOG: log,
    PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
  };
  return { root, bin, env, log, headCount };
}

const baseArgs = [
  "--repo",
  "example/repo",
  "--issue",
  "426",
  "--pr",
  "42",
  "--head-sha",
  expectedHead,
];

test("dry-run has no default local CLIs and records no completion claim", async () => {
  const result = await runCli([
    ...baseArgs,
    "--skills",
    "documentation",
    "--dry-run",
  ]);
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "dry-run");
  assert.equal(payload.headValidation, "not-performed");
  assert.equal(payload.external.commands.length, 2);
  assert.deepEqual(payload.external.reviewers, ["patextreme"]);
  assert.deepEqual(payload.local, []);
  assert.doesNotMatch(result.stdout, /completed/i);
});

test("dry-run does not require the pinned routed CLI to be installed", async () => {
  const harness = await makeHarness();
  try {
    const env = { ...harness.env };
    delete env.AGENT_REVIEW_CLI;
    const result = await runCli([...baseArgs, "--dry-run"], harness.root, env);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "dry-run");
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("rejects unsafe local agent names and malformed repository names", async () => {
  const unsafe = await runCli([
    ...baseArgs,
    "--local-agents",
    "../unexpected",
    "--dry-run",
  ]);
  assert.notEqual(unsafe.code, 0);
  assert.match(unsafe.stderr, /local-agents entries/);

  const malformed = await runCli([
    "--repo",
    "owner/../repo",
    "--issue",
    "426",
    "--pr",
    "42",
    "--head-sha",
    expectedHead,
    "--dry-run",
  ]);
  assert.notEqual(malformed.code, 0);
  assert.match(malformed.stderr, /repo must be owner\/name/);
});

test("requires user-level agent-peer-review configuration before dispatch", async () => {
  const harness = await makeHarness();
  try {
    const result = await runCli(baseArgs, harness.root, {
      ...harness.env,
      AGENT_PEER_REVIEW_CONFIG: join(harness.root, "missing-config.json"),
    });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /global configuration is missing/);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("fails closed when a direct workflow has no retrospective checkpoint", async () => {
  const harness = await makeHarness();
  try {
    await rm(
      join(harness.root, ".pi", "dev-loop-retrospective-checkpoint.json"),
    );
    const result = await runCli(baseArgs, harness.root, harness.env);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /retrospective checkpoint is missing/);
    await assert.rejects(readFile(harness.log, "utf8"), /ENOENT/);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("rejects a checkpoint bound to another PR head", async () => {
  const harness = await makeHarness();
  try {
    const checkpointPath = join(
      harness.root,
      ".pi",
      "dev-loop-retrospective-checkpoint.json",
    );
    const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
    checkpoint.artifact.headSha = "1111111111111111";
    await writeFile(checkpointPath, JSON.stringify(checkpoint));
    const result = await runCli(baseArgs, harness.root, harness.env);
    assert.notEqual(result.code, 0);
    assert.match(
      result.stderr,
      /not a completed record for issue #426, PR #42, head/,
    );
    await assert.rejects(readFile(harness.log, "utf8"), /ENOENT/);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("rejects retrospective reuse for another issue", async () => {
  const harness = await makeHarness();
  try {
    const args = [...baseArgs];
    args[args.indexOf("--issue") + 1] = "427";
    const result = await runCli(args, harness.root, harness.env);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /not a completed record for issue #427/);
    await assert.rejects(readFile(harness.log, "utf8"), /ENOENT/);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("rejects issue prefix collisions and an untracked record", async (t) => {
  await t.test("prefix collision", async () => {
    const harness = await makeHarness();
    try {
      const recordPath = join(
        harness.root,
        "docs",
        "retrospectives",
        "test.md",
      );
      const content = (await readFile(recordPath, "utf8")).replace(
        "issues/426",
        "issues/4260",
      );
      await writeFile(recordPath, content);
      const checkpointPath = join(
        harness.root,
        ".pi",
        "dev-loop-retrospective-checkpoint.json",
      );
      const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
      checkpoint.recordSha256 = createHash("sha256")
        .update(content)
        .digest("hex");
      await writeFile(checkpointPath, JSON.stringify(checkpoint));
      const result = await runCli(baseArgs, harness.root, harness.env);
      assert.match(result.stderr, /exact issue #426/);
    } finally {
      await rm(harness.root, { recursive: true, force: true });
    }
  });
  await t.test("untracked", async () => {
    const harness = await makeHarness();
    try {
      await execFileAsync(
        "git",
        ["rm", "--cached", "--", "docs/retrospectives/test.md"],
        { cwd: harness.root },
      );
      const result = await runCli(baseArgs, harness.root, harness.env);
      assert.match(result.stderr, /not Git-tracked/);
    } finally {
      await rm(harness.root, { recursive: true, force: true });
    }
  });
});

test("validates the exact head before dispatch and does not route a stale request", async () => {
  const harness = await makeHarness({ heads: ["1111111111111111"] });
  try {
    const result = await runCli(baseArgs, harness.root, harness.env);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /pre-dispatch PR head mismatch/);
    await assert.rejects(readFile(harness.log, "utf8"), /ENOENT/);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("fails closed when the head changes after dispatch", async () => {
  const harness = await makeHarness({
    heads: [expectedHead, "2222222222222222"],
  });
  try {
    const result = await runCli(baseArgs, harness.root, harness.env);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /post-dispatch PR head mismatch/);
    assert.equal(
      (await readFile(harness.log, "utf8")).trim().split("\n").length,
      2,
    );
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("writes and reuses only a requested per-head ledger", async () => {
  const harness = await makeHarness();
  try {
    const first = await runCli(baseArgs, harness.root, harness.env);
    assert.equal(first.code, 0, `${first.stderr}\n${first.stdout}`);
    const firstPayload = JSON.parse(first.stdout);
    assert.equal(firstPayload.status, "requested");
    assert.deepEqual(firstPayload.local, []);
    assert.doesNotMatch(
      await readFile(firstPayload.ledgerPath, "utf8"),
      /completed/i,
    );
    assert.equal(
      (await readFile(harness.log, "utf8")).trim().split("\n").length,
      2,
    );

    const second = await runCli(baseArgs, harness.root, harness.env);
    assert.equal(second.code, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).status, "already-requested");
    assert.equal(
      (await readFile(harness.log, "utf8")).trim().split("\n").length,
      2,
    );
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("explicit local reviewers are advisory and empty stdout is a failure", async () => {
  const harness = await makeHarness();
  const emptyAgent = join(harness.bin, "empty-reviewer");
  await writeFile(emptyAgent, "#!/bin/sh\nexit 0\n");
  await chmod(emptyAgent, 0o755);
  try {
    const result = await runCli(
      [...baseArgs, "--local-agents", "empty-reviewer"],
      harness.root,
      harness.env,
    );
    assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, "requested");
    assert.equal(payload.advisoryFailures, 1);
    assert.equal(payload.local[0].advisory, true);
    assert.equal(payload.local[0].status, "empty");
    assert.equal(payload.local[0].ok, false);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test(
  "POSIX timeout terminates the local review process group with TERM then KILL",
  { skip: process.platform === "win32" },
  async () => {
    const harness = await makeHarness();
    const agent = join(harness.bin, "hung-reviewer");
    const descendantPid = join(harness.root, "descendant.pid");
    await writeFile(
      agent,
      `#!/bin/sh\ntrap '' TERM\n( trap '' TERM; while :; do sleep 1; done ) &\nprintf '%s' "$!" > "$DESCENDANT_PID"\nwait\n`,
    );
    await chmod(agent, 0o755);
    try {
      const result = await runCli(
        [
          ...baseArgs,
          "--local-agents",
          "hung-reviewer",
          "--timeout-ms",
          "1000",
        ],
        harness.root,
        {
          ...harness.env,
          DESCENDANT_PID: descendantPid,
          REVIEW_KILL_GRACE_MS: "100",
        },
      );
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.local[0].status, "timeout");
      const pid = Number(await readFile(descendantPid, "utf8"));
      assert.throws(
        () => process.kill(pid, 0),
        (error) => error.code === "ESRCH",
      );
    } finally {
      await rm(harness.root, { recursive: true, force: true });
    }
  },
);
