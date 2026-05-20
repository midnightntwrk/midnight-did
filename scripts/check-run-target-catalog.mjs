#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { laneTargets, pipelineSteps, stepsForTarget, targets } from "./run-target-catalog.mjs";

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
const rootPackage = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const readRepoText = (relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8");

assert.deepEqual(duplicateTargetNames, [], "runner target catalog must not contain duplicate targets");
assert.equal(
  rootPackage.scripts?.ci,
  "./run.sh --light --strict",
  "npm run ci must remain the documented local PR validation contract",
);
assert.equal(
  rootPackage.scripts?.["ci:packages"],
  "npm run lint && npm run build:all && npm run test:all",
  "ci:packages must preserve the legacy package-only lint/build/test lane",
);

const readme = readRepoText("README.md");
assert.ok(
  readme.includes("`./run.sh --light --strict`") && readme.includes("`npm run ci`"),
  "README must document the local PR validation contract and npm alias",
);

const prTemplate = readRepoText(".github/PULL_REQUEST_TEMPLATE/pull_request_template.md");
assert.ok(
  prTemplate.includes("`./run.sh --light --strict`") && prTemplate.includes("`npm run ci`"),
  "PR template must require the local PR validation contract",
);

for (const step of pipelineSteps) {
  assert.ok(step.label, "pipeline step must have a label");
  assert.ok(step.command, `pipeline step '${step.label}' must have a command`);
  assert.ok(existsSync(path.join(repoRoot, step.command)), `pipeline step command is missing: ${step.command}`);
}

for (const laneTarget of laneTargets) {
  assert.ok(laneTarget.name, "lane target must have a name");
  assert.ok(laneTarget.label, `lane target '${laneTarget.name}' must have a label`);
  assert.ok(laneTarget.command, `lane target '${laneTarget.name}' must have a command`);
  assert.ok(
    !/\s/u.test(laneTarget.command),
    `lane target command must be one executable path; add args support before using spaces: ${laneTarget.name}`,
  );
  assert.ok(
    existsSync(path.join(repoRoot, laneTarget.command)),
    `lane target command is missing: ${laneTarget.command}`,
  );
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

for (const laneTarget of laneTargets) {
  assert.ok(
    targetsResult.stdout.includes(laneTarget.command),
    `targets output should include lane command '${laneTarget.command}'`,
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
  stepsForTarget("full").map((step) => step.label),
  "run.sh pipeline step labels must match the catalog",
);

rmSync(metricsDir, { recursive: true, force: true });

for (const laneTarget of laneTargets) {
  const laneMetricsDir = mkdtempSync(path.join(tmpdir(), "midnight-did-lane-catalog-"));
  const laneMetricsPath = path.join(laneMetricsDir, "metrics.json");
  const laneArgs = [laneTarget.name];
  if (laneTarget.supportsLight) {
    laneArgs.push("--light");
  }
  if (laneTarget.supportsStrict) {
    laneArgs.push("--strict");
  }
  laneArgs.push("--metrics-json", laneMetricsPath);
  const laneResult = run(laneArgs, {
    MIDNIGHT_DID_DRY_RUN: "1",
  });

  assert.equal(laneResult.status, 0, `${laneTarget.name} dry-run validation should exit successfully`);

  const laneMetrics = JSON.parse(readFileSync(laneMetricsPath, "utf8"));
  assert.deepEqual(
    laneMetrics.steps.map((step) => step.label),
    stepsForTarget(laneTarget.name).map((step) => step.label),
    `run.sh ${laneTarget.name} step labels must match the catalog`,
  );

  rmSync(laneMetricsDir, { recursive: true, force: true });
}

console.log("run target catalog checks passed.");
