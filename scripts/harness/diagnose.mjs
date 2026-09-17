#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants, statSync } from "node:fs";
import { access, mkdtemp, open, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RUNTIME_PATHS = [
  ".pi-subagents/",
  ".pi/subagents/",
  ".pi/runner-coordination/",
  ".pi/dev-loop-retrospective-checkpoint.json",
];
const DEV_LOOPS_PACKAGE_PATH = path.join(
  ".pi",
  "npm",
  "node_modules",
  "dev-loops",
);
const FULL_GATE_HELPER_PATH = path.join(
  "scripts",
  "github",
  "upsert-checkpoint-verdict.mjs",
);
const FULL_GATE_HELPER_REQUIRED_PR_FIELDS = [
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
const FULL_GATE_HELPER_FIELD_EVIDENCE_JQ = `{${FULL_GATE_HELPER_REQUIRED_PR_FIELDS.map(
  (field) => `${JSON.stringify(field)}: has(${JSON.stringify(field)})`,
).join(", ")}}`;
const FULL_GATE_HELPER_REQUIRED_CLI_FLAGS = [
  "--repo",
  "--pr",
  "--head-sha",
  "--verdict",
  "--findings-summary",
  "--findings-file",
  "--findings-json",
  "--next-action",
  "--gate",
  "--findings-severity-counts",
  "--execution-mode",
  "--inline-reason",
];
const GH_CAPABILITY_PROBE_TIMEOUT_MS = 10_000;
const FULL_GATE_HELPER_HELP_TIMEOUT_MS = 5_000;
const MAX_CAPTURED_COMMAND_OUTPUT_BYTES = 16 * 1024;
const COMMAND_SETTLE_TIMEOUT_MS = 250;
const OUTPUT_SIZE_POLL_INTERVAL_MS = 10;

function usage() {
  return "Usage: diagnose.mjs [--repo-root <path>] [--repo <owner/name> --pr <number>] [--json]\n";
}

export function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    repo: null,
    pr: null,
    json: false,
  };
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
    else if (arg === "--repo") options.repo = value;
    else if (arg === "--pr") options.pr = value;
    else throw new Error(`unknown option: ${arg}`);
  }
  if ((options.repo == null) !== (options.pr == null))
    throw new Error("--repo and --pr must be provided together");
  if (options.repo != null && !/^[^/\s]+\/[^/\s]+$/.test(options.repo))
    throw new Error("--repo must use the owner/name form");
  if (options.pr != null && !/^[1-9]\d*$/.test(options.pr))
    throw new Error("--pr must be a positive integer");
  return options;
}

function terminateProcessTree(child) {
  if (child.pid == null) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
      return;
    } catch (error) {
      if (error.code !== "ESRCH") child.kill("SIGKILL");
      return;
    }
  }
  child.kill("SIGKILL");
}

async function readBoundedFile(file, maxBytes) {
  if (maxBytes === 0) return "";
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function run(
  command,
  args,
  {
    cwd,
    env = process.env,
    timeoutMs = null,
    maxOutputBytes = MAX_CAPTURED_COMMAND_OUTPUT_BYTES,
    settleTimeoutMs = COMMAND_SETTLE_TIMEOUT_MS,
  } = {},
) {
  const outputLimit =
    Number.isInteger(maxOutputBytes) && maxOutputBytes >= 0
      ? maxOutputBytes
      : MAX_CAPTURED_COMMAND_OUTPUT_BYTES;
  const setupFailure = (error) => ({
    ok: false,
    code: null,
    error: error.message,
    stdout: "",
    stderr: "",
    timedOut: false,
    outputLimited: false,
  });
  let outputDirectory;
  try {
    outputDirectory = await mkdtemp(
      path.join(os.tmpdir(), "midnight-did-command-output-"),
    );
  } catch (error) {
    return setupFailure(error);
  }
  const stdoutPath = path.join(outputDirectory, "stdout");
  const stderrPath = path.join(outputDirectory, "stderr");
  let stdoutHandle;
  let stderrHandle;
  try {
    stdoutHandle = await open(stdoutPath, "w", 0o600);
    stderrHandle = await open(stderrPath, "w", 0o600);
  } catch (error) {
    await Promise.allSettled([stdoutHandle?.close(), stderrHandle?.close()]);
    await rm(outputDirectory, { recursive: true, force: true }).catch(() => {});
    return setupFailure(error);
  }
  let child;
  try {
    child = spawn(command, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      stdio: ["ignore", stdoutHandle.fd, stderrHandle.fd],
    });
  } catch (error) {
    await Promise.allSettled([stdoutHandle.close(), stderrHandle.close()]);
    await rm(outputDirectory, { recursive: true, force: true }).catch(() => {});
    return setupFailure(error);
  }

  // The child owns duplicated regular-file descriptors after spawn. Closing the
  // parent's copies immediately means descendant descriptor lifetime cannot hold
  // completion open as inherited pipes can.
  const parentHandlesClosed = Promise.allSettled([
    stdoutHandle.close(),
    stderrHandle.close(),
  ]);

  return new Promise((resolve) => {
    let timedOut = false;
    let outputLimited = false;
    let settled = false;
    let settleTimer = null;
    let timeoutTimer = null;
    let outputTimer = null;

    const outputSize = (file) => {
      try {
        return statSync(file).size;
      } catch {
        return 0;
      }
    };
    const terminate = (reason) => {
      if (settled) return;
      if (reason === "timeout") timedOut = true;
      if (reason === "output-limit") outputLimited = true;
      terminateProcessTree(child);
      if (settleTimer == null) {
        settleTimer = setTimeout(() => {
          child.unref();
          void finish({ code: child.exitCode, signal: child.signalCode });
        }, settleTimeoutMs);
      }
    };
    const finish = async ({ code, signal, error }) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (outputTimer) clearInterval(outputTimer);
      if (settleTimer) clearTimeout(settleTimer);
      const closeResults = await parentHandlesClosed;
      let completionError = error ?? null;
      const closeFailure = closeResults.find(
        ({ status }) => status === "rejected",
      );
      if (completionError == null && closeFailure?.status === "rejected")
        completionError = `failed to close command output: ${closeFailure.reason}`;

      outputLimited =
        outputLimited ||
        outputSize(stdoutPath) > outputLimit ||
        outputSize(stderrPath) > outputLimit;
      let stdout = "";
      let stderr = "";
      try {
        [stdout, stderr] = await Promise.all([
          readBoundedFile(stdoutPath, outputLimit),
          readBoundedFile(stderrPath, outputLimit),
        ]);
      } catch (captureError) {
        completionError ??= `failed to read command output: ${captureError.message}`;
      }
      try {
        await rm(outputDirectory, { recursive: true, force: true });
      } catch (cleanupError) {
        completionError ??= `failed to clean up command output: ${cleanupError.message}`;
      }
      const ok =
        code === 0 &&
        signal == null &&
        completionError == null &&
        !timedOut &&
        !outputLimited;
      resolve({
        ok,
        code,
        ...(signal != null ? { signal } : {}),
        ...(completionError != null ? { error: completionError } : {}),
        stdout,
        stderr,
        timedOut,
        outputLimited,
      });
    };

    child.once(
      "error",
      (error) =>
        void finish({ code: null, signal: null, error: error.message }),
    );
    child.once("exit", (code, signal) => void finish({ code, signal }));

    outputTimer = setInterval(() => {
      if (
        outputSize(stdoutPath) > outputLimit ||
        outputSize(stderrPath) > outputLimit
      )
        terminate("output-limit");
    }, OUTPUT_SIZE_POLL_INTERVAL_MS);
    if (Number.isInteger(timeoutMs) && timeoutMs >= 0) {
      timeoutTimer = setTimeout(() => {
        if (child.exitCode !== null || child.signalCode !== null) {
          void finish({ code: child.exitCode, signal: child.signalCode });
          return;
        }
        terminate("timeout");
      }, timeoutMs);
    }
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

export async function probeFullGateHelperRuntime({
  cwd,
  repo,
  pr,
  env = process.env,
  timeoutMs = GH_CAPABILITY_PROBE_TIMEOUT_MS,
  maxOutputBytes = MAX_CAPTURED_COMMAND_OUTPUT_BYTES,
  runCommand = run,
}) {
  if (!repo || !pr) {
    return {
      ok: false,
      status: "unavailable",
      reason:
        "gh runtime capability probe requires an explicit --repo/--pr target",
    };
  }
  const probe = await runCommand(
    "gh",
    [
      "pr",
      "view",
      String(pr),
      "--repo",
      repo,
      "--json",
      FULL_GATE_HELPER_REQUIRED_PR_FIELDS.join(","),
      "--jq",
      FULL_GATE_HELPER_FIELD_EVIDENCE_JQ,
    ],
    {
      cwd,
      env: {
        ...env,
        GH_PAGER: "cat",
        PAGER: "cat",
        NO_COLOR: "1",
        CLICOLOR: "0",
      },
      timeoutMs,
      maxOutputBytes,
    },
  );
  if (
    !probe.ok ||
    probe.timedOut ||
    probe.outputLimited ||
    probe.error != null ||
    probe.signal != null
  ) {
    if (/unknown json field/i.test(probe.stderr ?? "")) {
      return {
        ok: false,
        status: "unsupported",
        reason:
          "gh does not support the pull-request fields required by the full helper",
      };
    }
    return {
      ok: false,
      status: "unavailable",
      reason: probe.timedOut
        ? "gh runtime capability probe timed out"
        : probe.outputLimited
          ? "gh runtime capability probe exceeded its output limit"
          : "gh runtime capability probe is unavailable for the current pull request",
    };
  }
  try {
    const payload = JSON.parse(probe.stdout);
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !FULL_GATE_HELPER_REQUIRED_PR_FIELDS.every(
        (field) => Object.hasOwn(payload, field) && payload[field] === true,
      )
    ) {
      throw new Error("missing required field evidence");
    }
  } catch {
    return {
      ok: false,
      status: "unavailable",
      reason: "gh runtime capability probe returned an invalid response",
    };
  }
  return { ok: true, status: "ready", reason: null };
}

export function evaluateFullGateHelperReadiness(gateHelper) {
  const fullReady = gateHelper.status === "full-helper-ready";
  const packageReady = gateHelper.status === "helper-package-ready";
  const packageFailure = gateHelper.status === "package-failure";
  return {
    ok: fullReady || packageReady,
    severity: "error",
    summary: fullReady
      ? `full helper ready for the explicit pull request: ${gateHelper.helperPath}`
      : packageReady
        ? `full helper package ready; pull-request runtime capability not yet probed: ${gateHelper.helperPath}`
        : packageFailure
          ? `full helper blocked by a dev-loops package failure: ${gateHelper.helperPath}`
          : `full helper unavailable; fallback only: ${gateHelper.helperPath}`,
  };
}

export async function inspectFullGateHelper({
  packageRoot,
  expectedVersion,
  probeCwd = packageRoot,
  runtimeTarget = null,
  runtimeProbe = probeFullGateHelperRuntime,
  runCommand = run,
  helpProbeTimeoutMs = FULL_GATE_HELPER_HELP_TIMEOUT_MS,
  maxOutputBytes = MAX_CAPTURED_COMMAND_OUTPUT_BYTES,
}) {
  const helperPath = path.join(packageRoot, FULL_GATE_HELPER_PATH);
  const result = {
    status: "package-failure",
    packageRoot,
    helperPath,
    expectedVersion: expectedVersion ?? null,
    installedVersion: null,
    reason: null,
    runtimeCapability: "not-probed",
  };
  if (!expectedVersion) {
    result.reason = "dev-loops is not pinned in .pi/settings.json";
    return result;
  }

  let metadata;
  try {
    metadata = JSON.parse(
      await readFile(path.join(packageRoot, "package.json"), "utf8"),
    );
  } catch {
    result.reason = "dev-loops package metadata is missing or invalid";
    return result;
  }
  result.installedVersion = metadata.version ?? null;
  if (metadata.name !== "dev-loops") {
    result.reason = "installed package metadata does not identify dev-loops";
    return result;
  }
  if (metadata.version !== expectedVersion) {
    result.reason = `dev-loops version mismatch: expected ${expectedVersion}, found ${metadata.version ?? "unknown"}`;
    return result;
  }

  let helperSource;
  try {
    helperSource = await readFile(helperPath, "utf8");
  } catch {
    return {
      ...result,
      status: "fallback-only",
      reason: "full helper is missing from the installed dev-loops package",
    };
  }
  if (helperSource.trim().length === 0) {
    return {
      ...result,
      status: "fallback-only",
      reason: "full helper is empty",
    };
  }
  const syntax = await runCommand(process.execPath, ["--check", helperPath], {
    cwd: packageRoot,
    maxOutputBytes,
  });
  if (!syntax.ok) {
    return {
      ...result,
      status: "fallback-only",
      reason: "full helper failed JavaScript syntax validation",
    };
  }
  const helpProbe = await runCommand(process.execPath, [helperPath, "--help"], {
    cwd: packageRoot,
    timeoutMs: helpProbeTimeoutMs,
    maxOutputBytes,
  });
  const helpContractReady =
    helpProbe.stdout.includes("Usage: upsert-checkpoint-verdict.mjs") &&
    helpProbe.stdout.includes("clean|findings_present|blocked") &&
    helpProbe.stdout.includes("draft_gate|pre_approval_gate") &&
    helpProbe.stdout.includes("fanout_fanin|inline_single_agent") &&
    FULL_GATE_HELPER_REQUIRED_CLI_FLAGS.every((flag) =>
      helpProbe.stdout.includes(flag),
    );
  if (
    !helpProbe.ok ||
    helpProbe.timedOut ||
    helpProbe.outputLimited ||
    helpProbe.error != null ||
    helpProbe.signal != null ||
    !helpContractReady
  ) {
    return {
      ...result,
      status: "fallback-only",
      reason: helpProbe.timedOut
        ? "full helper CLI help probe timed out"
        : helpProbe.outputLimited
          ? "full helper CLI help probe exceeded its output limit"
          : "full helper failed its complete CLI help contract probe",
    };
  }
  if (runtimeTarget == null) {
    return {
      ...result,
      status: "helper-package-ready",
      reason: null,
      runtimeCapability: "not-probed",
    };
  }
  const runtimeCapability = await runtimeProbe({
    cwd: probeCwd,
    repo: runtimeTarget.repo,
    pr: runtimeTarget.pr,
  });
  if (!runtimeCapability.ok) {
    return {
      ...result,
      status: "fallback-only",
      reason: runtimeCapability.reason,
      runtimeCapability: runtimeCapability.status,
    };
  }
  return {
    ...result,
    status: "full-helper-ready",
    reason: null,
    runtimeCapability: "ready",
  };
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

export async function diagnose(
  repoRoot = process.cwd(),
  { repo = null, pr = null } = {},
) {
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
  let versions = { packages: [], mismatches: [] };
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
    versions = await packageVersionChecks(root, settings);
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

  const devLoopsPin = versions.packages.find(
    ({ name }) => name === "dev-loops",
  );
  const gateHelper = await inspectFullGateHelper({
    packageRoot: path.join(root, DEV_LOOPS_PACKAGE_PATH),
    expectedVersion: devLoopsPin?.version,
    probeCwd: root,
    runtimeTarget: repo && pr ? { repo, pr } : null,
  });
  const gateHelperReadiness = evaluateFullGateHelperReadiness(gateHelper);
  checks.push(
    check(
      "full-gate-helper",
      gateHelperReadiness.ok,
      gateHelperReadiness.summary,
      gateHelper,
      gateHelperReadiness.severity,
    ),
  );

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
  const result = await diagnose(options.repoRoot, {
    repo: options.repo,
    pr: options.pr,
  });
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
