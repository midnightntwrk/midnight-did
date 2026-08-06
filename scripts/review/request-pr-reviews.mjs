#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_LOCAL_AGENTS = ["claude", "agy"];
const REVIEW_PACKAGE = "@input-output-hk/agent-review/dist/cli/index.js";

function usage() {
  return `Usage: request-pr-reviews.mjs --repo <owner/name> --pr <number> --head-sha <sha> [options]

Requests the configured GitHub-routed reviewer and runs the configured local
review CLIs once for the supplied PR head SHA.

Options:
  --url <url>                 Exact PR URL (defaults to the canonical GitHub URL)
  --reviewers <csv>           Forward reviewers to agent-review (otherwise use its config)
  --skills <csv>              Forward review skills to agent-review
  --local-agents <csv>        Local CLIs (default: claude,agy)
  --timeout-ms <number>       Per-reviewer timeout (default: ${DEFAULT_TIMEOUT_MS})
  --force                     Ignore an existing completed dispatch ledger
  --dry-run                   Print resolved commands without changing state
  -h, --help                  Show this help
`;
}

function parseArgs(argv) {
  const options = {
    localAgents: DEFAULT_LOCAL_AGENTS,
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
    if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
    if (key === "localagents") options.localAgents = csv(value);
    else if (key === "timeoutms") options.timeoutMs = positiveInt(value, "--timeout-ms");
    else if (["repo", "pr", "headsha", "url", "reviewers", "skills"].includes(key)) {
      options[key] = value;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  for (const required of ["repo", "pr", "headsha"]) {
    if (!options[required]) throw new Error(`--${required.replaceAll("headsha", "head-sha")} is required`);
  }
  if (!/^\d+$/.test(options.pr)) throw new Error("--pr must be a positive integer");
  if (!/^[0-9a-f]{7,64}$/i.test(options.headsha)) throw new Error("--head-sha must be a git SHA");
  if (!/^\S+\/\S+$/.test(options.repo)) throw new Error("--repo must be owner/name");
  options.url ??= `https://github.com/${options.repo}/pull/${options.pr}`;
  options.reviewers = options.reviewers ? csv(options.reviewers) : [];
  options.skills = options.skills ? csv(options.skills) : [];
  return options;
}

function csv(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function positiveInt(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
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

async function resolveAgentReviewInvocation(repoRoot) {
  const configured = process.env.AGENT_REVIEW_CLI;
  const candidates = [
    configured,
    path.join(repoRoot, ".pi", "npm", "node_modules", REVIEW_PACKAGE),
    path.join(os.homedir(), ".pi", "agent", "npm", "node_modules", REVIEW_PACKAGE),
    path.join(os.homedir(), ".pi", "npm", "node_modules", REVIEW_PACKAGE),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      if (candidate.endsWith(".js")) return { command: process.execPath, prefix: [candidate] };
      return { command: candidate, prefix: [] };
    }
  }
  return { command: "agent-review", prefix: [] };
}

function run(command, args, { timeoutMs = DEFAULT_TIMEOUT_MS, cwd = process.cwd() } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ command, args, ...result, stdout, stderr });
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish({ ok: false, reason: `timeout after ${timeoutMs}ms`, exitCode: null });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => finish({ ok: false, reason: error.message, errorCode: error.code, exitCode: null }));
    child.on("close", (exitCode, signal) => finish({
      ok: exitCode === 0,
      reason: exitCode === 0 ? null : `exit ${exitCode ?? "unknown"}${signal ? ` (${signal})` : ""}`,
      exitCode,
    }));
  });
}

function commandText(invocation, args) {
  return [invocation.command, ...invocation.prefix, ...args].join(" ");
}

async function runExternalReview(options, invocation, repoRoot) {
  const bootstrapArgs = ["labels", "bootstrap", "--repo", options.repo];
  const requestArgs = ["request", "--repo", options.repo, "--pr", options.pr];
  if (options.reviewers.length) requestArgs.push("--reviewers", options.reviewers.join(","));
  if (options.skills.length) requestArgs.push("--skills", options.skills.join(","));

  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      commands: [commandText(invocation, bootstrapArgs), commandText(invocation, requestArgs)],
    };
  }

  const bootstrap = await run(invocation.command, [...invocation.prefix, ...bootstrapArgs], { timeoutMs: options.timeoutMs, cwd: repoRoot });
  if (!bootstrap.ok) return { ok: false, step: "labels bootstrap", bootstrap };
  const request = await run(invocation.command, [...invocation.prefix, ...requestArgs], { timeoutMs: options.timeoutMs, cwd: repoRoot });
  return { ok: request.ok, step: "request", bootstrap, request };
}

async function runLocalReview(agent, options, outputPath, repoRoot) {
  const prompt = agent === "claude"
    ? `/review ${options.url}`
    : `Review this pull request: ${options.url}. Focus on correctness, security, tests, docs, and release risk. Return actionable findings with file references.`;
  const result = await run(agent, ["-p", prompt], { timeoutMs: options.timeoutMs, cwd: repoRoot });
  const content = [
    `Command: ${agent} -p ${prompt}`,
    `Exit: ${result.exitCode ?? "unavailable"}`,
    result.reason ? `Result: ${result.reason}` : "Result: completed",
    "",
    result.stdout,
    result.stderr ? `\n[stderr]\n${result.stderr}` : "",
  ].join("\n");
  await writeFile(outputPath, content, "utf8");
  const unavailable = result.errorCode === "ENOENT";
  return {
    agent,
    ok: result.ok,
    available: !unavailable,
    status: unavailable ? "unavailable" : result.ok ? "completed" : "failed",
    outputPath,
    reason: result.reason,
  };
}

function compactProcessResult(result) {
  if (!result) return result;
  return {
    ok: result.ok,
    reason: result.reason,
    errorCode: result.errorCode,
    exitCode: result.exitCode,
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
  if (result.stdout !== undefined || result.stderr !== undefined) return compactProcessResult(result);
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = await resolveRepoRoot();
  const repoSlug = options.repo.replaceAll("/", "-");
  const sha = options.headsha.slice(0, 12);
  const ledgerPath = path.join(repoRoot, "tmp", "peer-reviews", repoSlug, `pr-${options.pr}`, `${options.headsha}.json`);
  if (!options.force && !options.dryRun && await fileExists(ledgerPath)) {
    try {
      const previous = JSON.parse(await readFile(ledgerPath, "utf8"));
      if (previous.ok === true) {
        console.log(JSON.stringify({ ok: true, status: "already-dispatched", ledgerPath, previous }, null, 2));
        return;
      }
    } catch {
      // A corrupt or incomplete ledger must not suppress a retry.
    }
  }

  const invocation = await resolveAgentReviewInvocation(repoRoot);
  const outputDir = path.join(repoRoot, "review");
  const localOutput = options.localAgents.map((agent) => ({
    agent,
    path: path.join(outputDir, `${repoSlug}-${options.pr}.${agent}-${sha}-review.txt`),
  }));
  if (options.dryRun) {
    console.log(JSON.stringify({
      ok: true,
      status: "dry-run",
      external: await runExternalReview(options, invocation, repoRoot),
      local: localOutput.map(({ agent, path: outputPath }) => ({ agent, outputPath, command: `${agent} -p <PR review prompt>` })),
    }, null, 2));
    return;
  }

  await mkdir(outputDir, { recursive: true });
  const externalPromise = runExternalReview(options, invocation, repoRoot);
  const localPromise = Promise.all(localOutput.map(({ agent, path: outputPath }) => runLocalReview(agent, options, outputPath, repoRoot)));
  const [external, local] = await Promise.all([externalPromise, localPromise]);
  const localFailures = local.filter((review) => review.available && !review.ok);
  const localWarnings = local.filter((review) => !review.available);
  const ok = external.ok && localFailures.length === 0;
  const result = {
    ok,
    status: ok ? (localWarnings.length ? "completed-with-warnings" : "completed") : "blocked",
    repo: options.repo,
    pr: Number(options.pr),
    url: options.url,
    headSha: options.headsha,
    external: serializable(external),
    local,
  };
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...result, ledgerPath }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
