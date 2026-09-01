#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RUNTIME_PATHS = [
  ".pi-subagents/",
  ".pi/subagents/",
  ".pi/runner-coordination/",
  ".pi/dev-loop-retrospective-checkpoint.json",
];

function usage() {
  return "Usage: diagnose.mjs [--repo-root <path>] [--json]\n";
}

function parseArgs(argv) {
  const options = { repoRoot: process.cwd(), json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    const value = argv[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`${arg} requires a value`);
    if (arg === "--repo-root") options.repoRoot = path.resolve(value);
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function run(command, args, { cwd, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) =>
      resolve({ ok: false, code: null, stdout, stderr, error: error.message }),
    );
    child.on("close", (code) =>
      resolve({ ok: code === 0, code, stdout, stderr }),
    );
  });
}

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function parsePackageSpec(spec) {
  if (typeof spec !== "string" || !spec.startsWith("npm:")) return null;
  const ref = spec.slice(4);
  const at = ref.startsWith("@") ? ref.indexOf("@", 1) : ref.lastIndexOf("@");
  if (at < 1 || at === ref.length - 1) return null;
  return { spec, name: ref.slice(0, at), version: ref.slice(at + 1) };
}

export function validateReviewPolicy(policy) {
  const routed = policy?.routedReview;
  const audit = policy?.audit;
  const reviewers = Array.isArray(routed?.reviewers) ? routed.reviewers : [];
  const required = Array.isArray(audit?.requiredReviewerLogins)
    ? audit.requiredReviewerLogins
    : [];
  const routedSet = new Set(
    reviewers.map((value) => String(value).toLowerCase()),
  );
  const errors = [];
  if (policy?.version !== 1) errors.push("version must be 1");
  if (routed?.backend !== "agent-review")
    errors.push("routedReview.backend must be agent-review");
  if (reviewers.length === 0)
    errors.push("at least one routed reviewer is required");
  if (required.length === 0)
    errors.push("at least one mandatory audit reviewer is required");
  if (
    required.some((reviewer) => !routedSet.has(String(reviewer).toLowerCase()))
  )
    errors.push("every mandatory audit reviewer must be routed");
  if (audit?.structuredMarker !== "agentflow-pr-review")
    errors.push("structured marker must be agentflow-pr-review");
  return { ok: errors.length === 0, errors };
}

function check(id, ok, summary, details = null, severity = "error") {
  return {
    id,
    ok,
    severity,
    summary,
    ...(details !== null ? { details } : {}),
  };
}

async function packageVersionChecks(repoRoot, settings) {
  const packages = (settings.packages ?? [])
    .map(parsePackageSpec)
    .filter(Boolean);
  const mismatches = [];
  for (const item of packages) {
    const packageJson = path.join(
      repoRoot,
      ".pi",
      "npm",
      "node_modules",
      ...item.name.split("/"),
      "package.json",
    );
    try {
      const installed = JSON.parse(await readFile(packageJson, "utf8"));
      if (installed.version !== item.version)
        mismatches.push(
          `${item.name}: expected ${item.version}, found ${installed.version ?? "unknown"}`,
        );
    } catch {
      mismatches.push(
        `${item.name}: ${item.version} is not installed under .pi/npm`,
      );
    }
  }
  return { packages, mismatches };
}

export async function diagnose(repoRoot = process.cwd()) {
  const root = path.resolve(repoRoot);
  const checks = [];
  const top = await run("git", ["rev-parse", "--show-toplevel"], { cwd: root });
  const topLevel = top.stdout.trim();
  checks.push(
    check(
      "project-root",
      top.ok &&
        path.resolve(topLevel) === root &&
        path.resolve(process.cwd()) === root,
      "session originates from the requested repository root",
      { requested: root, gitTopLevel: topLevel || null, cwd: process.cwd() },
    ),
  );

  const gitDirs = await run(
    "git",
    ["rev-parse", "--absolute-git-dir", "--git-common-dir"],
    { cwd: root },
  );
  const [gitDir, commonRaw] = gitDirs.stdout.trim().split("\n");
  const commonDir = commonRaw ? path.resolve(root, commonRaw) : null;
  checks.push(
    check(
      "dedicated-worktree",
      gitDirs.ok &&
        Boolean(gitDir) &&
        Boolean(commonDir) &&
        path.resolve(gitDir) !== commonDir,
      "repository is an isolated Git worktree",
      { gitDir: gitDir || null, commonDir },
    ),
  );

  const status = await run("git", ["status", "--porcelain"], { cwd: root });
  checks.push(
    check(
      "worktree-clean",
      status.ok && status.stdout.trim() === "",
      "tracked worktree and index are clean",
      { changes: status.stdout.trim().split("\n").filter(Boolean) },
    ),
  );

  let settings = null;
  try {
    settings = JSON.parse(
      await readFile(path.join(root, ".pi", "settings.json"), "utf8"),
    );
  } catch {}
  if (!settings)
    checks.push(
      check(
        "pinned-packages",
        false,
        ".pi/settings.json is missing or invalid",
      ),
    );
  else {
    const versions = await packageVersionChecks(root, settings);
    checks.push(
      check(
        "pinned-packages",
        versions.mismatches.length === 0,
        "installed Pi packages match .pi/settings.json",
        {
          expected: versions.packages.map(
            ({ name, version }) => `${name}@${version}`,
          ),
          mismatches: versions.mismatches,
        },
      ),
    );
  }

  let configResult = null;
  try {
    const configModule = path.join(
      root,
      ".pi",
      "npm",
      "node_modules",
      "@dev-loops",
      "core",
      "src",
      "config",
      "config.mjs",
    );
    const { loadDevLoopConfig } = await import(pathToFileURL(configModule));
    configResult = await loadDevLoopConfig({ repoRoot: root });
    checks.push(
      check(
        "devloops-schema",
        configResult.errors.length === 0,
        ".devloops passes the pinned 0.9.0 strict schema",
        { errors: configResult.errors, warnings: configResult.warnings },
      ),
    );
  } catch (error) {
    checks.push(
      check(
        "devloops-schema",
        false,
        "pinned strict config loader is unavailable",
        { error: error.message },
      ),
    );
  }

  let reviewPolicy = null;
  try {
    reviewPolicy = JSON.parse(
      await readFile(path.join(root, ".github", "review-policy.json"), "utf8"),
    );
  } catch {}
  const policyValidation = validateReviewPolicy(reviewPolicy);
  const globalReviewConfig =
    process.env.AGENT_PEER_REVIEW_CONFIG ??
    path.join(os.homedir(), ".agent-peer-review", "config.json");
  let globalConfigValid = false;
  try {
    const value = JSON.parse(await readFile(globalReviewConfig, "utf8"));
    globalConfigValid =
      value && typeof value === "object" && !Array.isArray(value);
  } catch {}
  const reviewCli = path.join(
    root,
    ".pi",
    "npm",
    "node_modules",
    "@input-output-hk",
    "agent-review",
    "dist",
    "cli",
    "index.js",
  );
  const reviewReady =
    policyValidation.ok && globalConfigValid && (await exists(reviewCli));
  checks.push(
    check(
      "review-readiness",
      reviewReady,
      "review policy, user configuration, and pinned routed CLI are ready",
      {
        policyErrors: policyValidation.errors,
        globalConfig: globalReviewConfig,
        globalConfigValid,
        reviewCli,
        reviewCliPresent: await exists(reviewCli),
      },
    ),
  );

  const ignoreFailures = [];
  for (const runtimePath of RUNTIME_PATHS) {
    const ignored = await run(
      "git",
      ["check-ignore", "-q", "--", runtimePath],
      { cwd: root },
    );
    if (!ignored.ok) ignoreFailures.push(runtimePath);
  }
  let checkpointState = "absent";
  const checkpointPath = path.join(
    root,
    ".pi",
    "dev-loop-retrospective-checkpoint.json",
  );
  if (await exists(checkpointPath)) {
    try {
      checkpointState =
        JSON.parse(await readFile(checkpointPath, "utf8")).state ?? "invalid";
    } catch {
      checkpointState = "invalid";
    }
  }
  checks.push(
    check(
      "runtime-paths",
      ignoreFailures.length === 0 && checkpointState !== "invalid",
      "runtime coordination and retrospective paths are ignored and readable",
      { ignoredPaths: RUNTIME_PATHS, ignoreFailures, checkpointState },
    ),
  );

  const doctorCli = path.join(
    root,
    ".pi",
    "npm",
    "node_modules",
    "dev-loops",
    "cli",
    "index.mjs",
  );
  const doctor = await run(process.execPath, [doctorCli, "doctor"], {
    cwd: root,
  });
  checks.push(
    check(
      "upstream-doctor",
      doctor.ok,
      "pinned dev-loops doctor executes without a hard failure",
      {
        exitCode: doctor.code,
        output: doctor.stdout.trim(),
        stderr: doctor.stderr.trim(),
      },
    ),
  );
  const strictSchemaOk =
    checks.find(({ id }) => id === "devloops-schema")?.ok === true;
  checks.push(
    check(
      "known-doctor-gap",
      true,
      "dev-loops 0.9.0 doctor does not validate .devloops; the independent strict-schema check above is authoritative",
      { doctorFalseNegativeDetected: doctor.ok && !strictSchemaOk },
      "warning",
    ),
  );

  const ok = checks
    .filter(({ severity }) => severity === "error")
    .every(({ ok: passed }) => passed);
  return { ok, repoRoot: root, checks };
}

function printHuman(result) {
  process.stdout.write(
    `midnight-did harness diagnostic: ${result.ok ? "ready" : "not ready"}\n`,
  );
  for (const item of result.checks)
    process.stdout.write(
      `${item.ok ? (item.severity === "warning" ? "⚠" : "✓") : "✗"} ${item.id}: ${item.summary}\n`,
    );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const result = await diagnose(options.repoRoot);
  if (options.json)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else printHuman(result);
  if (!result.ok) process.exitCode = 1;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ ok: false, error: error.message })}\n`,
    );
    process.exitCode = 1;
  });
}
