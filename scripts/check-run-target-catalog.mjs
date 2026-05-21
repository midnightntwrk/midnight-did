#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  laneTargets,
  pipelineSteps,
  stepsForTarget,
  targets,
} from "./run-target-catalog.mjs";

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

const hasTrackedPath = (relativePath) => {
  const result = spawnSync("git", ["ls-files", "--", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return result.status === 0 && result.stdout.trim().length > 0;
};

const targetNames = targets.map((target) => target.name);
const duplicateTargetNames = targetNames.filter(
  (name, index) => targetNames.indexOf(name) !== index,
);
const rootPackage = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const readRepoText = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

assert.deepEqual(
  duplicateTargetNames,
  [],
  "runner target catalog must not contain duplicate targets",
);
assert.equal(
  rootPackage.scripts?.ci,
  "./run.sh --light --strict",
  "npm run ci must remain the documented local PR validation contract; update README and PR template if this command changes",
);
assert.equal(
  rootPackage.scripts?.["ci:packages"],
  "npm run lint && npm run build:all && npm run test:all",
  "ci:packages must preserve the legacy package-only lint/build/test lane",
);

const readme = readRepoText("README.md");
assert.ok(
  readme.includes("`./run.sh --light --strict`"),
  "README must document ./run.sh --light --strict as the local PR validation contract",
);
assert.ok(
  readme.includes("`npm run ci`"),
  "README must document npm run ci as the local PR validation alias",
);

const prTemplate = readRepoText(
  ".github/PULL_REQUEST_TEMPLATE/pull_request_template.md",
);
assert.ok(
  prTemplate.includes("`./run.sh --light --strict`"),
  "PR template must require ./run.sh --light --strict as the local PR validation contract",
);
assert.ok(
  prTemplate.includes("`npm run ci`"),
  "PR template must mention npm run ci as the local PR validation alias",
);

for (const step of pipelineSteps) {
  assert.ok(step.label, "pipeline step must have a label");
  assert.ok(step.command, `pipeline step '${step.label}' must have a command`);
  assert.ok(
    existsSync(path.join(repoRoot, step.command)),
    `pipeline step command is missing: ${step.command}`,
  );
}

for (const laneTarget of laneTargets) {
  assert.ok(laneTarget.name, "lane target must have a name");
  assert.ok(
    laneTarget.label,
    `lane target '${laneTarget.name}' must have a label`,
  );
  assert.ok(
    laneTarget.command,
    `lane target '${laneTarget.name}' must have a command`,
  );
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
assert.equal(
  targetsResult.status,
  0,
  "targets command should exit successfully",
);

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
const dryRunResult = run(
  ["--light", "--strict", "--metrics-json", metricsPath],
  {
    MIDNIGHT_DID_DRY_RUN: "1",
  },
);

assert.equal(
  dryRunResult.status,
  0,
  "dry-run validation should exit successfully",
);

const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
assert.deepEqual(
  metrics.steps.map((step) => step.label),
  stepsForTarget("full").map((step) => step.label),
  "run.sh pipeline step labels must match the catalog",
);

rmSync(metricsDir, { recursive: true, force: true });

const logsDir = path.join(repoRoot, "logs");
const createdLogsRoot = !existsSync(logsDir);
const midnightTestDir = path.join(repoRoot, ".midnight-test");
const cleanupTestProbeDir = path.join(
  midnightTestDir,
  "run-target-catalog-probe",
);
const createdMidnightTestRoot = !existsSync(midnightTestDir);
const midnightDbDir = path.join(repoRoot, ".midnight-db");
const cleanupMidnightDbProbeDir = path.join(
  midnightDbDir,
  "run-target-catalog-probe",
);
const createdMidnightDbRoot = !existsSync(midnightDbDir);
const midnightLevelDbDir = path.join(repoRoot, "midnight-level-db");
const cleanupMidnightLevelDbProbeDir = path.join(
  midnightLevelDbDir,
  "run-target-catalog-probe",
);
const createdMidnightLevelDbRoot = !existsSync(midnightLevelDbDir);
const legacyShellDir = path.join(repoRoot, "contract");
const legacyShellSrcDir = path.join(legacyShellDir, "src");
const legacyShellManagedDir = path.join(legacyShellSrcDir, "managed");
const createdLegacyShellRoot = !existsSync(legacyShellDir);
const createdLegacyShellSrcDir = !existsSync(legacyShellSrcDir);
const legacyShellHasTrackedContent = hasTrackedPath("contract");
const skippedLegacyShellDir = path.join(repoRoot, "cli");
const skippedLegacyShellProbe = path.join(
  skippedLegacyShellDir,
  `run-target-catalog-nondisposable-${process.pid}.txt`,
);
const createdSkippedLegacyShellRoot = !existsSync(skippedLegacyShellDir);
const skippedLegacyShellHasTrackedContent = hasTrackedPath("cli");

mkdirSync(logsDir, { recursive: true });
const cleanupProbeDir = mkdtempSync(
  path.join(logsDir, "run-target-catalog-probe-"),
);
mkdirSync(cleanupTestProbeDir, { recursive: true });
mkdirSync(cleanupMidnightDbProbeDir, { recursive: true });
mkdirSync(cleanupMidnightLevelDbProbeDir, { recursive: true });
mkdirSync(legacyShellManagedDir, { recursive: true });
mkdirSync(skippedLegacyShellDir, { recursive: true });
writeFileSync(skippedLegacyShellProbe, "not generated\n");

try {
  const cleanArtifactsDryRun = spawnSync(
    "node",
    ["./scripts/clean-artifacts.mjs", "--dry-run", "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert.equal(
    cleanArtifactsDryRun.status,
    0,
    "clean-artifacts dry-run JSON should exit successfully",
  );

  const cleanArtifactsReport = JSON.parse(cleanArtifactsDryRun.stdout);
  assert.equal(
    cleanArtifactsReport.dryRun,
    true,
    "clean-artifacts dry-run JSON should report dryRun=true",
  );
  assert.ok(
    cleanArtifactsReport.removed.includes("logs"),
    "clean-artifacts dry-run JSON should include root logs cleanup coverage",
  );
  assert.ok(
    cleanArtifactsReport.removed.includes(".midnight-test"),
    "clean-artifacts dry-run JSON should include local midnight test-state cleanup coverage",
  );
  assert.ok(
    cleanArtifactsReport.removed.includes(".midnight-db"),
    "clean-artifacts dry-run JSON should include local midnight database cleanup coverage",
  );
  assert.ok(
    cleanArtifactsReport.removed.includes("midnight-level-db"),
    "clean-artifacts dry-run JSON should include local midnight level database cleanup coverage",
  );
  if (legacyShellHasTrackedContent) {
    assert.ok(
      cleanArtifactsReport.skippedTracked.includes("contract"),
      "clean-artifacts dry-run JSON should preserve tracked historical package shell content",
    );
  } else {
    assert.ok(
      cleanArtifactsReport.removed.includes("contract"),
      "clean-artifacts dry-run JSON should include historical package shell cleanup coverage",
    );
  }

  if (skippedLegacyShellHasTrackedContent) {
    assert.ok(
      cleanArtifactsReport.skippedTracked.includes("cli"),
      "clean-artifacts dry-run JSON should preserve tracked historical package shell candidates",
    );
  } else {
    assert.ok(
      cleanArtifactsReport.skippedDeadShells.includes("cli"),
      "clean-artifacts dry-run JSON should preserve non-disposable historical shell candidates",
    );
  }
  assert.ok(
    !cleanArtifactsReport.skippedTracked.some((relativePath) =>
      relativePath.startsWith("logs"),
    ),
    "clean-artifacts dry-run JSON should not skip the generated log probe",
  );
} finally {
  rmSync(cleanupProbeDir, { recursive: true, force: true });
  if (createdLogsRoot) {
    rmSync(logsDir, { recursive: true, force: true });
  }
  rmSync(cleanupTestProbeDir, { recursive: true, force: true });
  if (createdMidnightTestRoot) {
    rmSync(midnightTestDir, { recursive: true, force: true });
  }
  rmSync(cleanupMidnightDbProbeDir, { recursive: true, force: true });
  if (createdMidnightDbRoot) {
    rmSync(midnightDbDir, { recursive: true, force: true });
  }
  rmSync(cleanupMidnightLevelDbProbeDir, { recursive: true, force: true });
  if (createdMidnightLevelDbRoot) {
    rmSync(midnightLevelDbDir, { recursive: true, force: true });
  }
  rmSync(legacyShellManagedDir, { recursive: true, force: true });
  if (createdLegacyShellSrcDir) {
    rmSync(legacyShellSrcDir, { recursive: true, force: true });
  }
  rmSync(skippedLegacyShellProbe, { force: true });
  if (createdSkippedLegacyShellRoot) {
    rmSync(skippedLegacyShellDir, { recursive: true, force: true });
  }
  if (createdLegacyShellRoot) {
    rmSync(legacyShellDir, { recursive: true, force: true });
  }
}

for (const laneTarget of laneTargets) {
  const laneMetricsDir = mkdtempSync(
    path.join(tmpdir(), "midnight-did-lane-catalog-"),
  );
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

  assert.equal(
    laneResult.status,
    0,
    `${laneTarget.name} dry-run validation should exit successfully`,
  );

  const laneMetrics = JSON.parse(readFileSync(laneMetricsPath, "utf8"));
  assert.deepEqual(
    laneMetrics.steps.map((step) => step.label),
    stepsForTarget(laneTarget.name).map((step) => step.label),
    `run.sh ${laneTarget.name} step labels must match the catalog`,
  );

  rmSync(laneMetricsDir, { recursive: true, force: true });
}

console.log("run target catalog checks passed.");
