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

const targetNames = targets.map((target) => target.name);
const duplicateTargetNames = targetNames.filter(
  (name, index) => targetNames.indexOf(name) !== index,
);
const rootPackage = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const readRepoText = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");
const cleanArtifactsScript = path.join(
  repoRoot,
  "scripts",
  "clean-artifacts.mjs",
);

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
const runSh = readRepoText("run.sh");
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

const cleanArtifactsHelp = spawnSync(
  "node",
  [cleanArtifactsScript, "--help"],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
);
assert.equal(
  cleanArtifactsHelp.status,
  0,
  "clean-artifacts help should exit successfully",
);
assert.ok(
  cleanArtifactsHelp.stdout.includes("Usage: node scripts/clean-artifacts.mjs"),
  "clean-artifacts help should print usage",
);
assert.ok(
  cleanArtifactsHelp.stdout.includes("--dry-run"),
  "clean-artifacts help should document --dry-run",
);
assert.ok(
  cleanArtifactsHelp.stdout.includes("--json"),
  "clean-artifacts help should document --json",
);

const cleanArtifactsShortHelp = spawnSync(
  "node",
  [cleanArtifactsScript, "-h"],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
);
assert.equal(
  cleanArtifactsShortHelp.status,
  0,
  "clean-artifacts short help should exit successfully",
);
assert.ok(
  cleanArtifactsShortHelp.stdout.includes(
    "Usage: node scripts/clean-artifacts.mjs",
  ),
  "clean-artifacts short help should print usage",
);

const cleanArtifactsUnknownArg = spawnSync(
  "node",
  [cleanArtifactsScript, "--dryrun"],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
);
assert.notEqual(
  cleanArtifactsUnknownArg.status,
  0,
  "clean-artifacts should reject unknown arguments",
);
assert.ok(
  cleanArtifactsUnknownArg.stderr.includes(
    "Unknown clean-artifacts argument: --dryrun",
  ),
  "clean-artifacts should report the unknown argument",
);

const artifactStatusResult = run(["artifact-status"]);
assert.equal(
  artifactStatusResult.status,
  0,
  "artifact-status target should exit successfully",
);
const artifactStatus = JSON.parse(artifactStatusResult.stdout);
assert.equal(
  artifactStatus.contract.sourceManifest.algorithm,
  "sha256",
  "artifact-status should include the contract source manifest",
);
assert.match(
  artifactStatus["jubjub-schnorr"].sourceManifest.digest,
  /^[0-9a-f]{64}$/u,
  "artifact-status should include the jubjub-schnorr source manifest digest",
);

const checkManagedArtifactsTarget = targets.find(
  (target) => target.name === "check-managed-artifacts",
);
assert.ok(
  checkManagedArtifactsTarget,
  "runner catalog should expose check-managed-artifacts",
);
assert.ok(
  runSh.includes("node ./scripts/managed-artifact-catalog.mjs --check"),
  "run.sh should wire check-managed-artifacts to the managed artifact freshness checker",
);
assert.equal(
  rootPackage.scripts?.["check:managed-artifacts"],
  "node scripts/managed-artifact-catalog.mjs --check",
  "package script should keep the managed artifact freshness checker available after artifact builds",
);

const integrationReportSchemaResult = run(["integration-report-schema"]);
assert.equal(
  integrationReportSchemaResult.status,
  0,
  "integration-report-schema target should exit successfully",
);
const integrationReportSchema = JSON.parse(integrationReportSchemaResult.stdout);
assert.equal(
  integrationReportSchema.id,
  "midnight-did-integration-report",
  "integration-report-schema target should expose the report schema id",
);
assert.equal(
  integrationReportSchema.version,
  1,
  "integration-report-schema target should expose the current report schema version",
);
assert.deepEqual(
  integrationReportSchema.referenceKinds,
  ["matching-file", "stale-file", "external"],
  "integration-report-schema target should expose the reference-kind partition",
);
assert.ok(
  runSh.includes("node ./scripts/report-integration.mjs --schema"),
  "run.sh should wire integration-report-schema to the report schema CLI",
);
assert.equal(
  rootPackage.scripts?.["report:integration:schema"],
  "node scripts/report-integration.mjs --schema",
  "package script should keep the integration report schema CLI available",
);

const cleanArtifactsFixtureDir = mkdtempSync(
  path.join(tmpdir(), "midnight-did-clean-fixture-"),
);

try {
  mkdirSync(path.join(cleanArtifactsFixtureDir, "logs"), { recursive: true });
  mkdirSync(path.join(cleanArtifactsFixtureDir, "packages", "logs"), {
    recursive: true,
  });
  mkdirSync(path.join(cleanArtifactsFixtureDir, ".midnight-test", "probe"), {
    recursive: true,
  });
  mkdirSync(path.join(cleanArtifactsFixtureDir, ".midnight-db", "probe"), {
    recursive: true,
  });
  mkdirSync(path.join(cleanArtifactsFixtureDir, "midnight-level-db", "probe"), {
    recursive: true,
  });
  mkdirSync(
    path.join(cleanArtifactsFixtureDir, "contract", "src", "managed"),
    { recursive: true },
  );
  mkdirSync(
    path.join(cleanArtifactsFixtureDir, "domain", "node_modules", "cache"),
    { recursive: true },
  );
  mkdirSync(path.join(cleanArtifactsFixtureDir, "cli"), { recursive: true });
  mkdirSync(path.join(cleanArtifactsFixtureDir, "api", "dist"), {
    recursive: true,
  });
  writeFileSync(
    path.join(cleanArtifactsFixtureDir, "cli", "not-generated.txt"),
    "not generated\n",
  );
  writeFileSync(
    path.join(cleanArtifactsFixtureDir, "api", "tracked.txt"),
    "tracked content\n",
  );
  writeFileSync(
    path.join(cleanArtifactsFixtureDir, "api", "dist", "generated.txt"),
    "generated content\n",
  );
  writeFileSync(
    path.join(
      cleanArtifactsFixtureDir,
      "domain",
      "node_modules",
      "cache",
      "generated.js",
    ),
    "generated content\n",
  );

  assert.equal(
    spawnSync("git", ["init", "-q", "-b", "main"], {
      cwd: cleanArtifactsFixtureDir,
      encoding: "utf8",
    }).status,
    0,
    "clean-artifacts fixture git init should exit successfully",
  );
  assert.equal(
    spawnSync("git", ["add", "api/tracked.txt"], {
      cwd: cleanArtifactsFixtureDir,
      encoding: "utf8",
    }).status,
    0,
    "clean-artifacts fixture git add should exit successfully",
  );

  const cleanArtifactsDryRun = spawnSync(
    "node",
    [cleanArtifactsScript, "--dry-run", "--json"],
    {
      cwd: cleanArtifactsFixtureDir,
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
    cleanArtifactsReport.removed.includes("packages/logs"),
    "clean-artifacts dry-run JSON should include nested logs cleanup coverage",
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
  assert.ok(
    cleanArtifactsReport.removed.includes("contract"),
    "clean-artifacts dry-run JSON should include historical package shell cleanup coverage",
  );
  assert.ok(
    cleanArtifactsReport.removed.includes("domain"),
    "clean-artifacts dry-run JSON should include node_modules-only historical shell cleanup coverage",
  );
  assert.ok(
    cleanArtifactsReport.skippedNonDisposableShells.includes("cli"),
    "clean-artifacts dry-run JSON should preserve non-disposable historical shell candidates",
  );
  assert.ok(
    cleanArtifactsReport.skippedTracked.includes("api"),
    "clean-artifacts dry-run JSON should preserve tracked historical package shell candidates",
  );
  assert.ok(
    !cleanArtifactsReport.removed.some((relativePath) =>
      relativePath.startsWith("cli/"),
    ),
    "clean-artifacts dry-run JSON should preserve all contents of non-disposable historical shells",
  );
  assert.ok(
    !cleanArtifactsReport.removed.some((relativePath) =>
      relativePath.startsWith("api/"),
    ),
    "clean-artifacts dry-run JSON should preserve all contents of tracked historical shells",
  );
  assert.ok(
    !cleanArtifactsReport.skippedTracked.some((relativePath) =>
      relativePath.startsWith("logs"),
    ),
    "clean-artifacts dry-run JSON should not skip the generated log probe",
  );
} finally {
  rmSync(cleanArtifactsFixtureDir, { recursive: true, force: true });
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
