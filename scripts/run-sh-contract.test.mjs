#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(path.dirname(__filename));

function runRunSh(args, options = {}) {
  const result = spawnSync("./run.sh", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env,
    },
    shell: false,
  });

  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runDryRun(args) {
  return runRunSh(args, { env: { MIDNIGHT_DID_DRY_RUN: "1" } });
}

function assertContains(haystack, expected, label) {
  assert.ok(
    haystack.includes(expected),
    `Expected output to contain ${label}: ${expected}`,
  );
}

function assertNotContains(haystack, expected, label) {
  assert.ok(
    !haystack.includes(expected),
    `Expected output to not contain ${label}: ${expected}`,
  );
}

const helpResult = runRunSh(["--help"]);
assert.equal(helpResult.exitCode, 0, "help should exit successfully");
assertContains(helpResult.stdout, "Usage: ./run.sh", "usage text");

const invalidResult = runRunSh(["--this-is-unsupported"]);
assert.notEqual(invalidResult.exitCode, 0, "unsupported arg should fail");
assertContains(invalidResult.stderr, "Unknown argument: --this-is-unsupported", "unsupported argument message");

const strictResult = runDryRun(["--strict"]);
assert.equal(strictResult.exitCode, 0, "dry-run strict mode should exit successfully");
assertContains(strictResult.stdout, "DRY-RUN: planned steps:", "dry-run marker");
assertContains(strictResult.stdout, "Lint workspaces", "strict lint step");
assertNotContains(strictResult.stdout, "Lint (fix) workspaces", "strict mode should not include lint:fix");
assertContains(strictResult.stdout, "Coverage contract", "coverage step should be included by default");

const skippedCoverageResult = runDryRun(["--strict", "--skip-coverage"]);
assert.equal(skippedCoverageResult.exitCode, 0, "dry-run strict skip coverage should succeed");
assertNotContains(skippedCoverageResult.stdout, "Coverage contract", "coverage should be skipped");
assertNotContains(skippedCoverageResult.stdout, "Coverage domain", "coverage should be skipped");
assertNotContains(skippedCoverageResult.stdout, "Coverage did", "coverage should be skipped");
assertNotContains(skippedCoverageResult.stdout, "Coverage DID resolver service", "coverage should be skipped");

const nonStrictResult = runDryRun([]);
assert.equal(nonStrictResult.exitCode, 0, "dry-run default mode should succeed");
assertContains(nonStrictResult.stdout, "Lint (fix) workspaces", "default first step");
assertContains(nonStrictResult.stdout, "Lint workspaces", "default second step");

const metricsDir = mkdtempSync(path.join(tmpdir(), "run-sh-metrics-"));
const metricsPath = path.join(metricsDir, "metrics.json");
const metricsResult = runDryRun(["--metrics-json", metricsPath, "--skip-coverage"]);
assert.equal(metricsResult.exitCode, 0, "dry-run with metrics-json should succeed");
assertContains(metricsResult.stdout, "Metrics JSON written to:", "metrics json output");
assert.ok(existsSync(metricsPath), "metrics json file should be created");

const metricsPayload = JSON.parse(readFileSync(metricsPath, "utf8"));
assert.equal(metricsPayload.printMetrics, 0, "metrics payload records printMetrics");
assert.equal(metricsPayload.skipCoverage, 1, "metrics payload records skip-coverage");
assert.ok(Array.isArray(metricsPayload.steps), "metrics payload should include steps array");

rmSync(metricsPath);
rmSync(metricsDir, { recursive: true, force: true });

console.log("run.sh contract mode checks passed.");
