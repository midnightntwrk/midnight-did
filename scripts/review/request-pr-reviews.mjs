#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_KILL_GRACE_MS = 1_000;
const REVIEW_PACKAGE = "@input-output-hk/agent-review/dist/cli/index.js";

function usage() {
  return `Usage: request-pr-reviews.mjs --repo <owner/name> --issue <number> --pr <number> --head-sha <sha> [options]

Requests the policy-configured GitHub-routed reviewer for exactly the supplied
PR head SHA. A successful dispatch is recorded only as requested; review
completion is determined separately by audit-pr-feedback.mjs.

Options:
  --url <url>                 Exact PR URL (defaults to the canonical GitHub URL)
  --skills <csv>              Forward review skills to agent-review
  --local-agents <csv>        Explicitly run these local CLIs as advisory reviews
  --policy <path>             Review policy (default: .github/review-policy.json)
  --timeout-ms <number>       Per-command timeout (default: ${DEFAULT_TIMEOUT_MS})
  --force                     Ignore an existing requested dispatch ledger
  --dry-run                   Print resolved commands without changing state
  -h, --help                  Show this help
`;
}

function parseArgs(argv) {
  const options = {
    localAgents: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2).replaceAll("-", "");
    const value = argv[++i];
    if (!value || value.startsWith("--"))
      throw new Error(`${arg} requires a value`);
    if (key === "localagents") {
      options.localAgents = csv(value);
      if (
        options.localAgents.some((agent) => !/^[A-Za-z0-9_-]+$/.test(agent))
      ) {
        throw new Error(
          "--local-agents entries must be executable names containing only letters, numbers, _ or -",
        );
      }
    } else if (key === "timeoutms") {
      options.timeoutMs = positiveInt(value, "--timeout-ms");
    } else if (key === "issue") {
      options.issue = positiveInt(value, "--issue");
    } else if (
      ["repo", "pr", "headsha", "url", "skills", "policy"].includes(key)
    ) {
      options[key] = value;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  for (const required of ["repo", "issue", "pr", "headsha"]) {
    if (!options[required])
      throw new Error(
        `--${required.replaceAll("headsha", "head-sha")} is required`,
      );
  }
  if (!/^\d+$/.test(options.pr) || Number(options.pr) < 1)
    throw new Error("--pr must be a positive integer");
  if (!/^[0-9a-f]{7,64}$/i.test(options.headsha))
    throw new Error("--head-sha must be a git SHA");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo)) {
    throw new Error("--repo must be owner/name");
  }
  const [owner, repository] = options.repo.split("/");
  if (
    owner === "." ||
    owner === ".." ||
    repository === "." ||
    repository === ".."
  ) {
    throw new Error("--repo must be owner/name");
  }
  options.url ??= `https://github.com/${options.repo}/pull/${options.pr}`;
  options.skills = options.skills ? csv(options.skills) : [];
  return options;
}

function csv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function exactIssuePattern(repo, issue) {
  const escapedRepo = repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:https://github\\.com/${escapedRepo}/issues/|#)${issue}(?!\\d)`,
  );
}

async function requireRetrospectiveCheckpoint(repoRoot, options) {
  const checkpointPath = path.join(
    repoRoot,
    ".pi",
    "dev-loop-retrospective-checkpoint.json",
  );
  let checkpoint;
  try {
    checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  } catch {
    throw new Error(
      `retrospective checkpoint is missing or invalid at ${checkpointPath}; run scripts/harness/complete-retrospective.mjs for this PR and head`,
    );
  }
  const artifact = checkpoint?.artifact;
  const identityMatches =
    artifact?.kind === "pr" &&
    artifact.repo === options.repo &&
    artifact.issue === Number(options.issue) &&
    artifact.number === Number(options.pr) &&
    String(artifact.headSha ?? "").toLowerCase() ===
      options.headsha.toLowerCase();
  const complete =
    checkpoint?.state === "complete" &&
    typeof checkpoint.record === "string" &&
    checkpoint.record.startsWith("docs/retrospectives/");
  if (!identityMatches || !complete) {
    throw new Error(
      `retrospective checkpoint at ${checkpointPath} is not a completed record for issue #${options.issue}, PR #${options.pr}, head ${options.headsha}`,
    );
  }
  {
    const recordPath = path.resolve(repoRoot, checkpoint.record);
    const retrospectiveRoot = `${path.resolve(repoRoot, "docs", "retrospectives")}${path.sep}`;
    if (!recordPath.startsWith(retrospectiveRoot))
      throw new Error(
        "retrospective checkpoint record escapes docs/retrospectives/",
      );
    let content;
    try {
      content = await readFile(recordPath, "utf8");
    } catch {
      throw new Error(
        `retrospective checkpoint record is missing: ${checkpoint.record}`,
      );
    }
    if (content.trim().length < 80)
      throw new Error(
        `retrospective checkpoint record is empty or too short: ${checkpoint.record}`,
      );
    if (!exactIssuePattern(options.repo, options.issue).test(content)) {
      throw new Error(
        `retrospective checkpoint record is not bound to exact issue #${options.issue}`,
      );
    }
    try {
      await execFileAsync(
        "git",
        ["ls-files", "--error-unmatch", "--", checkpoint.record],
        { cwd: repoRoot },
      );
    } catch {
      throw new Error(
        `retrospective checkpoint record is not Git-tracked: ${checkpoint.record}`,
      );
    }
    const digest = createHash("sha256").update(content).digest("hex");
    if (checkpoint.recordSha256 !== digest) {
      throw new Error(
        `retrospective checkpoint record digest does not match: ${checkpoint.record}`,
      );
    }
  }
  return {
    checkpointPath,
    state: checkpoint.state,
    record: checkpoint.record ?? null,
    artifact,
  };
}
async function requireGlobalConfiguration() {
  const configPath =
    process.env.AGENT_PEER_REVIEW_CONFIG ??
    path.join(os.homedir(), ".agent-peer-review", "config.json");
  if (!(await fileExists(configPath))) {
    throw new Error(
      `agent-peer-review global configuration is missing at ${configPath}; ask the user to run "node .pi/npm/node_modules/@input-output-hk/agent-review/dist/cli/index.js init --repo <owner/name>" before dispatching reviews`,
    );
  }
  try {
    const config = JSON.parse(await readFile(configPath, "utf8"));
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("configuration is not an object");
    }
  } catch (error) {
    throw new Error(
      `agent-peer-review global configuration at ${configPath} is invalid: ${error.message}`,
    );
  }
}

function positiveInt(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

async function fileExists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveRepoRoot(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    if (await fileExists(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

async function loadPolicy(repoRoot, configuredPath) {
  const policyPath = configuredPath
    ? path.resolve(repoRoot, configuredPath)
    : path.join(repoRoot, ".github", "review-policy.json");
  let policy;
  try {
    policy = JSON.parse(await readFile(policyPath, "utf8"));
  } catch (error) {
    throw new Error(
      `review policy at ${policyPath} is missing or invalid: ${error.message}`,
    );
  }
  const reviewers = policy?.routedReview?.reviewers;
  if (
    policy?.version !== 1 ||
    policy?.routedReview?.backend !== "agent-review" ||
    !Array.isArray(reviewers) ||
    reviewers.length === 0 ||
    reviewers.some(
      (reviewer) =>
        typeof reviewer !== "string" || !/^[A-Za-z0-9_-]+$/.test(reviewer),
    )
  ) {
    throw new Error(
      `review policy at ${policyPath} must define version 1 and a non-empty agent-review reviewer list`,
    );
  }
  return { policy, policyPath };
}

async function resolveAgentReviewInvocation(repoRoot) {
  const configured = process.env.AGENT_REVIEW_CLI;
  if (configured && !configured.includes("/") && !configured.includes("\\")) {
    return { command: configured, prefix: [] };
  }
  if (configured) {
    const configuredPath = path.isAbsolute(configured)
      ? configured
      : path.resolve(repoRoot, configured);
    if (/\.[cm]?js$/i.test(configuredPath))
      return { command: process.execPath, prefix: [configuredPath] };
    return { command: configuredPath, prefix: [] };
  }
  const candidate = path.join(
    repoRoot,
    ".pi",
    "npm",
    "node_modules",
    REVIEW_PACKAGE,
  );
  if (await fileExists(candidate))
    return { command: process.execPath, prefix: [candidate] };
  throw new Error(
    `pinned agent-review CLI is missing at ${candidate}; enter nix develop to provision .pi/settings.json`,
  );
}

function signalProcessTree(child, signal) {
  try {
    if (process.platform !== "win32" && child.pid)
      process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function run(
  command,
  args,
  { timeoutMs = DEFAULT_TIMEOUT_MS, cwd = process.cwd() } = {},
) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let forceTimer;
    const killGraceMs = positiveInt(
      process.env.REVIEW_KILL_GRACE_MS ?? DEFAULT_KILL_GRACE_MS,
      "REVIEW_KILL_GRACE_MS",
    );
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      resolve({ command, args, ...result, stdout, stderr });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      signalProcessTree(child, "SIGTERM");
      forceTimer = setTimeout(() => {
        signalProcessTree(child, "SIGKILL");
        finish({
          ok: false,
          reason: `timeout after ${timeoutMs}ms`,
          exitCode: null,
          timedOut: true,
        });
      }, killGraceMs);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) =>
      finish({
        ok: false,
        reason: error.message,
        errorCode: error.code,
        exitCode: null,
      }),
    );
    child.on("close", (exitCode, signal) => {
      if (timedOut) return;
      finish({
        ok: exitCode === 0,
        reason:
          exitCode === 0
            ? null
            : `exit ${exitCode ?? "unknown"}${signal ? ` (${signal})` : ""}`,
        exitCode,
      });
    });
  });
}

function commandText(invocation, args) {
  return [invocation.command, ...invocation.prefix, ...args].join(" ");
}

async function readHeadSha(options, repoRoot) {
  const invocation = { command: process.env.GITHUB_CLI ?? "gh", prefix: [] };
  const result = await run(
    invocation.command,
    ["api", `repos/${options.repo}/pulls/${options.pr}`, "--jq", ".head.sha"],
    {
      timeoutMs: options.timeoutMs,
      cwd: repoRoot,
    },
  );
  if (!result.ok)
    throw new Error(
      `could not read PR head: ${result.reason}${result.stderr.trim() ? `: ${result.stderr.trim()}` : ""}`,
    );
  const sha = result.stdout.trim();
  if (!/^[0-9a-f]{7,64}$/i.test(sha))
    throw new Error(
      "could not read PR head: GitHub returned an empty or invalid SHA",
    );
  return sha;
}

function assertExactHead(actual, expected, phase) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `${phase} PR head mismatch: expected ${expected}, found ${actual}`,
    );
  }
}

async function runExternalReview(options, invocation, repoRoot, reviewers) {
  const bootstrapArgs = ["labels", "bootstrap", "--repo", options.repo];
  const requestArgs = [
    "request",
    "--repo",
    options.repo,
    "--pr",
    options.pr,
    "--reviewers",
    reviewers.join(","),
  ];
  if (options.skills.length)
    requestArgs.push("--skills", options.skills.join(","));

  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      reviewers,
      commands: [
        commandText(invocation, bootstrapArgs),
        commandText(invocation, requestArgs),
      ],
    };
  }

  const bootstrap = await run(
    invocation.command,
    [...invocation.prefix, ...bootstrapArgs],
    { timeoutMs: options.timeoutMs, cwd: repoRoot },
  );
  if (!bootstrap.ok) return { ok: false, step: "labels bootstrap", bootstrap };
  const request = await run(
    invocation.command,
    [...invocation.prefix, ...requestArgs],
    { timeoutMs: options.timeoutMs, cwd: repoRoot },
  );
  return { ok: request.ok, step: "request", bootstrap, request };
}

async function runLocalReview(agent, options, outputPath, repoRoot) {
  const prompt =
    agent === "claude"
      ? `/review ${options.url}`
      : `Review this pull request: ${options.url}. Focus on correctness, security, tests, docs, and release risk. Return actionable findings with file references.`;
  const result = await run(agent, ["-p", prompt], {
    timeoutMs: options.timeoutMs,
    cwd: repoRoot,
  });
  const empty = result.ok && result.stdout.trim().length === 0;
  const content = [
    `Command: ${agent} -p ${prompt}`,
    `Exit: ${result.exitCode ?? "unavailable"}`,
    result.reason
      ? `Result: ${result.reason}`
      : empty
        ? "Result: empty output"
        : "Result: reported",
    "",
    result.stdout,
    result.stderr ? `\n[stderr]\n${result.stderr}` : "",
  ].join("\n");
  await writeFile(outputPath, content, "utf8");
  const unavailable = result.errorCode === "ENOENT";
  return {
    agent,
    ok: result.ok && !empty,
    advisory: true,
    available: !unavailable,
    status: unavailable
      ? "unavailable"
      : result.timedOut
        ? "timeout"
        : !result.ok
          ? "failed"
          : empty
            ? "empty"
            : "reported",
    outputPath,
    reason: empty ? "local reviewer returned empty output" : result.reason,
  };
}

async function writeJsonAtomically(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

function compactProcessResult(result) {
  if (!result) return result;
  return {
    ok: result.ok,
    reason: result.reason,
    errorCode: result.errorCode,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
  };
}

function serializable(result) {
  if (!result) return result;
  if (result.bootstrap || result.request) {
    return {
      ok: result.ok,
      step: result.step,
      bootstrap: compactProcessResult(result.bootstrap),
      request: compactProcessResult(result.request),
    };
  }
  if (result.stdout !== undefined || result.stderr !== undefined)
    return compactProcessResult(result);
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = await resolveRepoRoot();
  const { policy, policyPath } = await loadPolicy(repoRoot, options.policy);
  const reviewers = policy.routedReview.reviewers;
  const repoSlug = options.repo.replaceAll("/", "-");
  const sha = options.headsha.slice(0, 12);
  const ledgerPath = path.join(
    repoRoot,
    "tmp",
    "peer-reviews",
    repoSlug,
    `pr-${options.pr}`,
    `${options.headsha}.json`,
  );
  const invocation = await resolveAgentReviewInvocation(repoRoot);
  const outputDir = path.join(repoRoot, "review");
  const localOutput = options.localAgents.map((agent) => ({
    agent,
    path: path.join(
      outputDir,
      `${repoSlug}-${options.pr}.${agent}-${sha}-review.txt`,
    ),
  }));

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          status: "dry-run",
          headValidation: "not-performed",
          policyPath,
          external: await runExternalReview(
            options,
            invocation,
            repoRoot,
            reviewers,
          ),
          local: localOutput.map(({ agent, path: outputPath }) => ({
            agent,
            advisory: true,
            outputPath,
            command: `${agent} -p <PR review prompt>`,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const preHeadSha = await readHeadSha(options, repoRoot);
  assertExactHead(preHeadSha, options.headsha, "pre-dispatch");
  const retrospective = await requireRetrospectiveCheckpoint(repoRoot, options);

  if (!options.force && (await fileExists(ledgerPath))) {
    try {
      const previous = JSON.parse(await readFile(ledgerPath, "utf8"));
      if (
        previous.ok === true &&
        previous.status === "requested" &&
        previous.headSha?.toLowerCase() === options.headsha.toLowerCase()
      ) {
        const postHeadSha = await readHeadSha(options, repoRoot);
        assertExactHead(postHeadSha, options.headsha, "post-dispatch");
        console.log(
          JSON.stringify(
            {
              ok: true,
              status: "already-requested",
              headSha: options.headsha,
              headValidation: { preHeadSha, postHeadSha },
              ledgerPath,
              previous,
            },
            null,
            2,
          ),
        );
        return;
      }
    } catch (error) {
      if (
        error.message.includes("head mismatch") ||
        error.message.includes("could not read PR head")
      )
        throw error;
      // A corrupt or incomplete ledger must not suppress a retry.
    }
  }

  await requireGlobalConfiguration();
  const external = await runExternalReview(
    options,
    invocation,
    repoRoot,
    reviewers,
  );
  const postHeadSha = await readHeadSha(options, repoRoot);
  assertExactHead(postHeadSha, options.headsha, "post-dispatch");
  if (!external.ok) {
    const result = {
      ok: false,
      status: "blocked",
      repo: options.repo,
      pr: Number(options.pr),
      headSha: options.headsha,
      policyPath,
      headValidation: { preHeadSha, postHeadSha },
      retrospective,
      external: serializable(external),
      local: [],
    };
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    await writeJsonAtomically(ledgerPath, result);
    console.log(JSON.stringify({ ...result, ledgerPath }, null, 2));
    process.exitCode = 1;
    return;
  }

  let local = [];
  if (localOutput.length > 0) {
    await mkdir(outputDir, { recursive: true });
    local = await Promise.all(
      localOutput.map(({ agent, path: outputPath }) =>
        runLocalReview(agent, options, outputPath, repoRoot),
      ),
    );
  }
  const advisoryFailures = local.filter((review) => !review.ok);
  const result = {
    ok: true,
    status: "requested",
    repo: options.repo,
    pr: Number(options.pr),
    url: options.url,
    headSha: options.headsha,
    policyPath,
    headValidation: { preHeadSha, postHeadSha },
    retrospective,
    external: serializable(external),
    local,
    advisoryFailures: advisoryFailures.length,
  };
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeJsonAtomically(ledgerPath, result);
  console.log(JSON.stringify({ ...result, ledgerPath }, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      { ok: false, status: "blocked", error: error.message },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
