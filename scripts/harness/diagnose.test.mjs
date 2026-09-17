import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  evaluateFullGateHelperReadiness,
  inspectFullGateHelper,
  parseArgs,
  parsePackageSpec,
  probeFullGateHelperRuntime,
  run,
  validateReviewPolicy,
} from "./diagnose.mjs";

const REQUIRED_PR_FIELDS = [
  "number",
  "state",
  "isDraft",
  "headRefOid",
  "mergeable",
  "mergeStateStatus",
  "body",
  "title",
  "closingIssuesReferences",
  "reviews",
  "statusCheckRollup",
  "files",
];

const completeFieldEvidence = (overrides = {}) => ({
  ...Object.fromEntries(REQUIRED_PR_FIELDS.map((field) => [field, true])),
  ...overrides,
});

const COMPLETE_HELP_TEXT = `Usage: upsert-checkpoint-verdict.mjs --repo <owner/name> --pr <number> --head-sha <sha> --verdict <clean|findings_present|blocked> (--findings-summary <text> | --findings-file <path> | --findings-json <path>) --next-action <text> [--gate <draft_gate|pre_approval_gate>]
Required: --repo --pr --head-sha --verdict --findings-summary --findings-file --findings-json --next-action
Optional: --gate --findings-severity-counts --execution-mode <fanout_fanin|inline_single_agent> --inline-reason
`;
const completeHelperSource = `process.stdout.write(${JSON.stringify(COMPLETE_HELP_TEXT)});\n`;

const readyRuntimeProbe = async () => ({
  ok: true,
  status: "ready",
  reason: null,
});

async function createDevLoopsFixture(t, { helperSource, version = "0.9.0" }) {
  const fixtureRoot = await mkdtemp(
    path.join(os.tmpdir(), "midnight-did-dev-loops-fixture-"),
  );
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await writeFile(
    path.join(fixtureRoot, "package.json"),
    `${JSON.stringify({ name: "dev-loops", version })}\n`,
  );
  if (helperSource !== undefined) {
    const helperDirectory = path.join(fixtureRoot, "scripts", "github");
    await mkdir(helperDirectory, { recursive: true });
    await writeFile(
      path.join(helperDirectory, "upsert-checkpoint-verdict.mjs"),
      helperSource,
    );
  }
  return fixtureRoot;
}

async function createExecutableFixture(t, name, source) {
  const fixtureRoot = await mkdtemp(
    path.join(os.tmpdir(), "midnight-did-command-fixture-"),
  );
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const executable = path.join(fixtureRoot, name);
  await writeFile(executable, source, { mode: 0o755 });
  return { fixtureRoot, executable };
}

function registerPidFileCleanup(t, pidFile) {
  t.after(async () => {
    let pid;
    try {
      pid = Number.parseInt(await readFile(pidFile, "utf8"), 10);
    } catch {
      return;
    }
    if (!Number.isSafeInteger(pid)) return;
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  });
}

test("parses pinned scoped and unscoped npm package specifications", () => {
  assert.deepEqual(parsePackageSpec("npm:dev-loops@0.9.0"), {
    spec: "npm:dev-loops@0.9.0",
    name: "dev-loops",
    version: "0.9.0",
  });
  assert.deepEqual(parsePackageSpec("npm:pi-subagents@0.62.0"), {
    spec: "npm:pi-subagents@0.62.0",
    name: "pi-subagents",
    version: "0.62.0",
  });
  assert.deepEqual(
    parsePackageSpec("npm:@input-output-hk/agent-review-pi@0.6.0"),
    {
      spec: "npm:@input-output-hk/agent-review-pi@0.6.0",
      name: "@input-output-hk/agent-review-pi",
      version: "0.6.0",
    },
  );
  assert.equal(parsePackageSpec("github:user/repo"), null);
});

test("requires paired explicit repository and PR targets", () => {
  assert.deepEqual(
    parseArgs([
      "--repo",
      "midnightntwrk/midnight-did",
      "--pr",
      "482",
      "--json",
    ]),
    {
      repoRoot: process.cwd(),
      repo: "midnightntwrk/midnight-did",
      pr: "482",
      json: true,
    },
  );
  assert.throws(
    () => parseArgs(["--repo", "midnightntwrk/midnight-did"]),
    /must be provided together/,
  );
  assert.throws(() => parseArgs(["--pr", "482"]), /must be provided together/);
});

test("keeps the reviewed stable Pi package pins exact", async () => {
  const settings = JSON.parse(
    await readFile(new URL("../../.pi/settings.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(settings.packages, [
    "npm:dev-loops@0.9.0",
    "npm:pi-subagents@0.62.0",
    "npm:@input-output-hk/agent-review-pi@0.6.0",
  ]);
});

test("reports the package-local full gate helper as ready", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: completeHelperSource,
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
    runtimeTarget: { repo: "midnightntwrk/midnight-did", pr: "482" },
    runtimeProbe: readyRuntimeProbe,
  });

  assert.equal(result.status, "full-helper-ready");
  assert.equal(result.reason, null);
  assert.equal(result.runtimeCapability, "ready");
  assert.equal(
    result.helperPath,
    path.join(
      packageRoot,
      "scripts",
      "github",
      "upsert-checkpoint-verdict.mjs",
    ),
  );
});

test("reports package readiness without blocking issue intake on a missing PR", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: completeHelperSource,
  });
  let runtimeProbeCalled = false;

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
    runtimeProbe: async () => {
      runtimeProbeCalled = true;
      return readyRuntimeProbe();
    },
  });

  assert.equal(runtimeProbeCalled, false);
  assert.equal(result.status, "helper-package-ready");
  assert.equal(result.runtimeCapability, "not-probed");
  assert.equal(evaluateFullGateHelperReadiness(result).ok, true);
});

test("reports an unsupported gh runtime surface as fallback only", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: completeHelperSource,
  });
  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
    probeCwd: "/deterministic/repository-fixture",
    runtimeTarget: { repo: "midnightntwrk/midnight-did", pr: "482" },
    runtimeProbe: async ({ cwd, repo, pr }) => {
      assert.equal(cwd, "/deterministic/repository-fixture");
      assert.equal(repo, "midnightntwrk/midnight-did");
      assert.equal(pr, "482");
      return {
        ok: false,
        status: "unsupported",
        reason:
          "gh does not support the pull-request fields required by the full helper",
      };
    },
  });

  assert.equal(result.status, "fallback-only");
  assert.equal(result.runtimeCapability, "unsupported");
  assert.match(result.reason, /does not support/);
  assert.deepEqual(evaluateFullGateHelperReadiness(result), {
    ok: false,
    severity: "error",
    summary: `full helper unavailable; fallback only: ${result.helperPath}`,
  });
});

test("reports unavailable gh runtime capability as fallback only", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: completeHelperSource,
  });
  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
    runtimeTarget: { repo: "midnightntwrk/midnight-did", pr: "482" },
    runtimeProbe: async () => ({
      ok: false,
      status: "unavailable",
      reason: "gh runtime capability probe timed out",
    }),
  });

  assert.equal(result.status, "fallback-only");
  assert.equal(result.runtimeCapability, "unavailable");
  assert.match(result.reason, /timed out/);
  assert.equal(evaluateFullGateHelperReadiness(result).ok, false);
});

test("runtime capability probe requests every helper field and bounded key-presence evidence", async () => {
  let invocation;
  const result = await probeFullGateHelperRuntime({
    cwd: "/deterministic/repository-fixture",
    repo: "midnightntwrk/midnight-did",
    pr: "482",
    runCommand: async (command, args, options) => {
      invocation = { command, args, options };
      return {
        ok: true,
        code: 0,
        stdout: JSON.stringify(completeFieldEvidence()),
        stderr: "",
        timedOut: false,
      };
    },
  });

  assert.equal(invocation.command, "gh");
  assert.deepEqual(invocation.args.slice(0, 7), [
    "pr",
    "view",
    "482",
    "--repo",
    "midnightntwrk/midnight-did",
    "--json",
    REQUIRED_PR_FIELDS.join(","),
  ]);
  assert.equal(invocation.args[7], "--jq");
  for (const field of REQUIRED_PR_FIELDS)
    assert.match(invocation.args[8], new RegExp(`has\\(\\"${field}\\"\\)`));
  assert.equal(invocation.options.cwd, "/deterministic/repository-fixture");
  assert.equal(invocation.options.timeoutMs, 10_000);
  assert.deepEqual(result, { ok: true, status: "ready", reason: null });
});

test("runtime capability probe suppresses unsupported-field provider output", async () => {
  const result = await probeFullGateHelperRuntime({
    cwd: "/deterministic/repository-fixture",
    repo: "midnightntwrk/midnight-did",
    pr: "482",
    runCommand: async () => ({
      ok: false,
      code: 1,
      stdout: "provider stdout that must not escape",
      stderr:
        "Unknown JSON field: closingIssuesReferences\\nprovider details that must not escape",
      timedOut: false,
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.doesNotMatch(JSON.stringify(result), /provider/);
});

test("runtime capability probe rejects an internally inconsistent timed-out success", async () => {
  const result = await probeFullGateHelperRuntime({
    cwd: "/deterministic/repository-fixture",
    repo: "midnightntwrk/midnight-did",
    pr: "482",
    runCommand: async () => ({
      ok: true,
      code: 0,
      stdout: JSON.stringify(completeFieldEvidence()),
      stderr: "",
      timedOut: true,
      outputLimited: false,
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    status: "unavailable",
    reason: "gh runtime capability probe timed out",
  });
});

test("runtime capability probe fails closed when a non-closing field is missing", async () => {
  const result = await probeFullGateHelperRuntime({
    cwd: "/deterministic/repository-fixture",
    repo: "midnightntwrk/midnight-did",
    pr: "482",
    runCommand: async () => ({
      ok: true,
      code: 0,
      stdout: JSON.stringify(completeFieldEvidence({ headRefOid: false })),
      stderr: "",
      timedOut: false,
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    status: "unavailable",
    reason: "gh runtime capability probe returned an invalid response",
  });
});

test("runtime capability probe handles an underlying PR payload larger than 16 KiB", async (t) => {
  const { fixtureRoot } = await createExecutableFixture(
    t,
    "gh",
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const fields = args[args.indexOf("--json") + 1].split(",");
const payload = Object.fromEntries(fields.map((field) => [field, null]));
payload.body = "x".repeat(20 * 1024);
if (Buffer.byteLength(JSON.stringify(payload)) <= 16 * 1024) process.exit(2);
if (!args.includes("--jq")) process.stdout.write(JSON.stringify(payload));
else process.stdout.write(JSON.stringify(Object.fromEntries(fields.map((field) => [field, Object.hasOwn(payload, field)]))));
`,
  );

  const result = await probeFullGateHelperRuntime({
    cwd: fixtureRoot,
    repo: "midnightntwrk/midnight-did",
    pr: "482",
    env: {
      ...process.env,
      PATH: `${fixtureRoot}${path.delimiter}${process.env.PATH}`,
    },
    maxOutputBytes: 1024,
  });

  assert.deepEqual(result, { ok: true, status: "ready", reason: null });
});

test(
  "real command runner returns promptly when an exited parent leaves a same-group child on inherited stdio",
  { skip: process.platform === "win32" },
  async (t) => {
    const { fixtureRoot } = await createExecutableFixture(
      t,
      "unused.mjs",
      "process.exit(0);\n",
    );
    const pidFile = path.join(fixtureRoot, "same-group-child.pid");
    registerPidFileCleanup(t, pidFile);
    const parent = path.join(fixtureRoot, "same-group-parent.mjs");
    await writeFile(
      parent,
      `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: ["ignore", "inherit", "inherit"] });
writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
process.stdout.write(String(child.pid) + "\\n");
process.exit(0);
`,
    );
    const startedAt = Date.now();

    const result = await run(process.execPath, [parent], {
      cwd: fixtureRoot,
      timeoutMs: 1_000,
      maxOutputBytes: 128,
    });

    assert.equal(result.ok, true);
    assert.equal(result.timedOut, false);
    assert.equal(result.outputLimited, false);
    assert.ok(Date.now() - startedAt < 750);
    assert.ok(Number.isSafeInteger(Number.parseInt(result.stdout, 10)));
  },
);

test(
  "real command runner returns promptly when an exited parent leaves a detached child on inherited stdio",
  { skip: process.platform === "win32" },
  async (t) => {
    const { fixtureRoot } = await createExecutableFixture(
      t,
      "unused.mjs",
      "process.exit(0);\n",
    );
    const pidFile = path.join(fixtureRoot, "detached-child.pid");
    registerPidFileCleanup(t, pidFile);
    const parent = path.join(fixtureRoot, "detached-parent.mjs");
    await writeFile(
      parent,
      `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: ["ignore", "inherit", "inherit"] });
child.unref();
writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
process.stdout.write(String(child.pid) + "\\n");
`,
    );
    const startedAt = Date.now();

    const result = await run(process.execPath, [parent], {
      cwd: fixtureRoot,
      timeoutMs: 1_000,
      maxOutputBytes: 128,
    });

    assert.equal(result.ok, true);
    assert.equal(result.timedOut, false);
    assert.equal(result.outputLimited, false);
    assert.ok(Date.now() - startedAt < 750);
    assert.ok(Number.isSafeInteger(Number.parseInt(result.stdout, 10)));
  },
);

test(
  "real command runner times out and terminates the descendant process group",
  { skip: process.platform === "win32" },
  async (t) => {
    const { fixtureRoot } = await createExecutableFixture(
      t,
      "descendant.mjs",
      `setInterval(() => process.stdout.write("descendant-alive\\n"), 1_000);\n`,
    );
    const pidFile = path.join(fixtureRoot, "timeout-child.pid");
    registerPidFileCleanup(t, pidFile);
    const parent = path.join(fixtureRoot, "parent.mjs");
    await writeFile(
      parent,
      `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const descendant = spawn(process.execPath, [${JSON.stringify(path.join(fixtureRoot, "descendant.mjs"))}], { stdio: ["ignore", "inherit", "inherit"] });
writeFileSync(${JSON.stringify(pidFile)}, String(descendant.pid));
process.stdout.write(String(descendant.pid) + "\\n");
setInterval(() => {}, 1_000);
`,
    );
    const startedAt = Date.now();

    const result = await run(process.execPath, [parent], {
      cwd: fixtureRoot,
      timeoutMs: 100,
      maxOutputBytes: 128,
    });

    assert.equal(result.timedOut, true);
    assert.equal(result.ok, false);
    assert.equal(result.outputLimited, false);
    assert.equal(result.signal, "SIGKILL");
    assert.ok(Date.now() - startedAt < 1_000);
    assert.ok(Number.isSafeInteger(Number.parseInt(result.stdout, 10)));
  },
);

test("real command runner fails closed and returns promptly on oversized output", async (t) => {
  const { fixtureRoot, executable } = await createExecutableFixture(
    t,
    "oversized.mjs",
    `#!/usr/bin/env node
process.stdout.write("o".repeat(4_096));
process.stderr.write("e".repeat(4_096));
`,
  );
  const startedAt = Date.now();

  const result = await run(executable, [], {
    cwd: fixtureRoot,
    timeoutMs: 1_000,
    maxOutputBytes: 64,
  });

  assert.equal(result.ok, false);
  assert.equal(result.timedOut, false);
  assert.equal(result.outputLimited, true);
  assert.equal(result.stdout, "o".repeat(64));
  assert.equal(result.stderr, "e".repeat(64));
  assert.ok(Date.now() - startedAt < 1_000);
});

test("real command runner fails closed when the direct child is signaled", async (t) => {
  const { fixtureRoot, executable } = await createExecutableFixture(
    t,
    "signaled.mjs",
    `#!/usr/bin/env node
process.kill(process.pid, "SIGTERM");
`,
  );

  const result = await run(executable, [], {
    cwd: fixtureRoot,
    timeoutMs: 1_000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.timedOut, false);
  assert.equal(result.outputLimited, false);
  assert.equal(result.signal, "SIGTERM");
});

test("real command runner reports spawn errors as failure", async (t) => {
  const fixtureRoot = await mkdtemp(
    path.join(os.tmpdir(), "midnight-did-command-error-fixture-"),
  );
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

  const result = await run(path.join(fixtureRoot, "missing-command"), [], {
    cwd: fixtureRoot,
    timeoutMs: 1_000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.outputLimited, false);
  assert.match(result.error, /ENOENT/);
});

test("reports a missing package-local helper as fallback only", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {});

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /missing/);
  assert.equal(evaluateFullGateHelperReadiness(result).ok, false);
  assert.equal(evaluateFullGateHelperReadiness(result).severity, "error");
});

test("reports a malformed package-local helper as fallback only", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: "export const broken = ;\n",
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /syntax validation/);
});

test("rejects a helper fixture that prints only the usage banner", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource:
      'process.stdout.write("Usage: upsert-checkpoint-verdict.mjs\\n");\n',
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /complete CLI help contract/);
});

test("rejects helper help that omits one required contract flag", async (t) => {
  const incompleteHelp = COMPLETE_HELP_TEXT.replaceAll("--head-sha", "");
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: `process.stdout.write(${JSON.stringify(incompleteHelp)});\n`,
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /complete CLI help contract/);
});

test("reports an invalid helper CLI contract as fallback only", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: 'process.stdout.write("not the full helper\\n");\n',
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /CLI help contract probe/);
});

test("times out a hanging package-local helper help probe", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: "setInterval(() => {}, 1_000);\n",
  });
  const startedAt = Date.now();

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
    helpProbeTimeoutMs: 100,
    maxOutputBytes: 128,
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /help probe timed out/);
  assert.ok(Date.now() - startedAt < 2_000);
});

test("distinguishes a package version failure from fallback-only state", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: completeHelperSource,
    version: "0.8.0",
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "package-failure");
  assert.match(result.reason, /expected 0\.9\.0, found 0\.8\.0/);
  assert.deepEqual(evaluateFullGateHelperReadiness(result), {
    ok: false,
    severity: "error",
    summary: `full helper blocked by a dev-loops package failure: ${result.helperPath}`,
  });
});

test("review readiness fails closed when a mandatory reviewer is not routed", () => {
  const valid = {
    version: 1,
    routedReview: { backend: "agent-review", reviewers: ["patextreme"] },
    audit: {
      requiredReviewerLogins: ["patextreme"],
      structuredMarker: "agentflow-pr-review",
    },
  };
  assert.deepEqual(validateReviewPolicy(valid), { ok: true, errors: [] });
  const invalid = structuredClone(valid);
  invalid.audit.requiredReviewerLogins = ["someone-else"];
  const result = validateReviewPolicy(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /must be routed/);
});
