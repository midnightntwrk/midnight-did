#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(path.dirname(__filename));

function runRunSh(args, env = {}) {
  const result = spawnSync("./run.sh", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });

  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function assertContains(haystack, expected, label) {
  assert.ok(
    haystack.includes(expected),
    `Expected ${label} to include ${expected}`,
  );
}

function assertNotContains(haystack, expected, label) {
  assert.ok(
    !haystack.includes(expected),
    `Expected ${label} to not include ${expected}`,
  );
}

const helpResult = runRunSh(["--help"]);
assert.equal(helpResult.exitCode, 0, "help should exit successfully");
assertContains(helpResult.stdout, "Usage: ./run.sh", "help output");
assertContains(helpResult.stdout, "--metrics-json", "help output");
assertContains(helpResult.stdout, "clean-artifacts", "help output");
assertContains(helpResult.stdout, "./run-core.sh", "help output");
assertContains(helpResult.stdout, "./run-api.sh", "help output");
assertContains(helpResult.stdout, "./run-docs.sh", "help output");

const shortHelpResult = runRunSh(["-h"]);
assert.equal(shortHelpResult.exitCode, 0, "short help should exit successfully");
assertContains(shortHelpResult.stdout, "Usage: ./run.sh", "short help output");

const targetsResult = runRunSh(["targets"]);
assert.equal(targetsResult.exitCode, 0, "targets should exit successfully");
assertContains(targetsResult.stdout, "Pipeline steps", "targets output");
assertContains(targetsResult.stdout, "./run-core.sh", "targets output");
assertContains(targetsResult.stdout, "./run-docs.sh", "targets output");

const invalidResult = runRunSh(["--unknown-option"]);
assert.notEqual(invalidResult.exitCode, 0, "unknown option should fail");
assertContains(
  invalidResult.stderr,
  "Unknown argument: --unknown-option",
  "unknown option stderr",
);

const invalidTargetResult = runRunSh(["not-a-target"]);
assert.notEqual(invalidTargetResult.exitCode, 0, "unknown target should fail");
assertContains(
  invalidTargetResult.stderr,
  "Unknown target: not-a-target",
  "unknown target stderr",
);

const missingMetricsPathResult = runRunSh(["--metrics-json"]);
assert.notEqual(
  missingMetricsPathResult.exitCode,
  0,
  "metrics-json without path should fail",
);
assertContains(
  missingMetricsPathResult.stderr,
  "--metrics-json requires a file path.",
  "missing metrics path stderr",
);

const metricsFlagAsPathResult = runRunSh(["--metrics-json", "--strict"]);
assert.notEqual(
  metricsFlagAsPathResult.exitCode,
  0,
  "metrics-json followed by another flag should fail",
);
assertContains(
  metricsFlagAsPathResult.stderr,
  "--metrics-json requires a file path.",
  "flag-as-metrics-path stderr",
);

const shortFlagAsPathResult = runRunSh(["--metrics-json", "-h"]);
assert.notEqual(
  shortFlagAsPathResult.exitCode,
  0,
  "metrics-json followed by a short flag should fail",
);
assertContains(
  shortFlagAsPathResult.stderr,
  "--metrics-json requires a file path.",
  "short flag-as-metrics-path stderr",
);

const dryRunResult = runRunSh(["--light", "--strict"], {
  MIDNIGHT_DID_DRY_RUN: "1",
});
assert.equal(dryRunResult.exitCode, 0, "dry run should succeed");
assertContains(dryRunResult.stdout, "Fast mode enabled", "dry-run stdout");
assertContains(dryRunResult.stdout, "DRY-RUN:", "dry-run stdout");
assertContains(dryRunResult.stdout, "./run-core.sh", "dry-run stdout");
assertNotContains(
  dryRunResult.stdout,
  "[core] Turbo-aware core lane",
  "dry-run stdout",
);

const coreDryRunResult = runRunSh(["core", "--light", "--strict"], {
  MIDNIGHT_DID_DRY_RUN: "1",
});
assert.equal(coreDryRunResult.exitCode, 0, "core dry run should succeed");
assertContains(coreDryRunResult.stdout, "./run-core.sh", "core dry-run stdout");
assertNotContains(coreDryRunResult.stdout, "./run-api.sh", "core dry-run stdout");

for (const [target, expectedCommand] of [
  ["api", "./run-api.sh"],
]) {
  const laneDryRunResult = runRunSh([target, "--light", "--strict"], {
    MIDNIGHT_DID_DRY_RUN: "1",
  });
  assert.equal(laneDryRunResult.exitCode, 0, `${target} dry run should succeed`);
  assertContains(laneDryRunResult.stdout, expectedCommand, `${target} dry-run stdout`);
  assertNotContains(laneDryRunResult.stdout, "./run-core.sh", `${target} dry-run stdout`);
}

const docsDryRunResult = runRunSh(["docs", "--metrics"], {
  MIDNIGHT_DID_DRY_RUN: "1",
});
assert.equal(docsDryRunResult.exitCode, 0, "docs dry run should succeed");
assertContains(docsDryRunResult.stdout, "./run-docs.sh", "docs dry-run stdout");
assertNotContains(docsDryRunResult.stdout, "./run-core.sh", "docs dry-run stdout");

const docsUnsupportedFlagsResult = runRunSh(["docs", "--light", "--strict"], {
  MIDNIGHT_DID_DRY_RUN: "1",
});
assert.equal(docsUnsupportedFlagsResult.exitCode, 0, "docs with ignored flags should succeed");
assertContains(
  docsUnsupportedFlagsResult.stderr,
  "Warning: --light is ignored by target 'docs'",
  "docs unsupported flag stderr",
);
assertContains(
  docsUnsupportedFlagsResult.stderr,
  "Warning: --strict is ignored by target 'docs'",
  "docs unsupported flag stderr",
);

const metricsOnlyResult = runRunSh(["--metrics"], {
  MIDNIGHT_DID_DRY_RUN: "1",
});
assert.equal(metricsOnlyResult.exitCode, 0, "metrics dry run should succeed");
assertContains(
  metricsOnlyResult.stdout,
  "Step timing summary",
  "metrics summary stdout",
);

const metricsDir = mkdtempSync(path.join(tmpdir(), "midnight-run-metrics-"));
const metricsPath = path.join(metricsDir, "metrics.json");
const metricsResult = runRunSh(
  ["--light", "--strict", "--skip-coverage", "--metrics-json", metricsPath],
  { MIDNIGHT_DID_DRY_RUN: "1" },
);
assert.equal(metricsResult.exitCode, 0, "metrics dry run should succeed");
assertContains(
  metricsResult.stdout,
  "Metrics JSON written to:",
  "metrics dry-run stdout",
);
assert.ok(existsSync(metricsPath), "metrics JSON should be written");

const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
assert.equal(metrics.script, "run", "metrics script name");
assert.equal(metrics.totalSteps, 2, "metrics step count");
assert.equal(metrics.lightMode, true, "metrics light mode flag");
assert.equal(metrics.strictMode, true, "metrics strict mode flag");
assert.equal(metrics.skipCoverage, true, "metrics skip coverage flag");
assert.deepEqual(
  metrics.steps.map((step) => step.label),
  ["Core pipeline", "API pipeline"],
  "metrics step labels",
);
assert.ok(
  metrics.steps.every((step) => typeof step.durationMs === "number"),
  "metrics durations should be numeric",
);

rmSync(metricsDir, { recursive: true, force: true });

console.log("run.sh contract checks passed.");
