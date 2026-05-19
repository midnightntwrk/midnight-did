#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipelineSteps, targets } from "./run-target-catalog.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.dirname(path.dirname(__filename));

const run = (args, env = {}) =>
  spawnSync("./run.sh", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });

const targetNames = targets.map((target) => target.name);
const duplicateTargetNames = targetNames.filter((name, index) => targetNames.indexOf(name) !== index);

assert.deepEqual(duplicateTargetNames, [], "runner target catalog must not contain duplicate targets");

for (const step of pipelineSteps) {
  assert.ok(step.label, "pipeline step must have a label");
  assert.ok(step.command, `pipeline step '${step.label}' must have a command`);
  assert.ok(existsSync(path.join(repoRoot, step.command)), `pipeline step command is missing: ${step.command}`);
}

const targetsResult = run(["targets"]);
assert.equal(targetsResult.status, 0, "targets command should exit successfully");

for (const target of targets) {
  assert.ok(
    targetsResult.stdout.includes(target.name),
    `targets output should include target '${target.name}'`,
  );
}

for (const step of pipelineSteps) {
  assert.ok(
    targetsResult.stdout.includes(step.command),
    `targets output should include step command '${step.command}'`,
  );
}

const metricsDir = mkdtempSync(path.join(tmpdir(), "midnight-did-catalog-"));
const metricsPath = path.join(metricsDir, "metrics.json");
const dryRunResult = run(["--light", "--strict", "--metrics-json", metricsPath], {
  MIDNIGHT_DID_DRY_RUN: "1",
});

assert.equal(dryRunResult.status, 0, "dry-run validation should exit successfully");

const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
assert.deepEqual(
  metrics.steps.map((step) => step.label),
  pipelineSteps.map((step) => step.label),
  "run.sh pipeline step labels must match the catalog",
);

rmSync(metricsDir, { recursive: true, force: true });

console.log("run target catalog checks passed.");
