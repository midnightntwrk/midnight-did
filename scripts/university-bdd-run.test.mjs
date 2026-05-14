#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import test from "node:test";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SCRIPT_PATH = path.join(ROOT_DIR, "scripts", "university-bdd-run.mjs");
const FIXTURE_PATH = path.join(
  ROOT_DIR,
  "api",
  "src",
  "test",
  "fixtures",
  "university-diploma",
  "university-bdd.fixture.json",
);

let hasBuiltApi = false;

const runApiBuild = () => {
  if (hasBuiltApi) {
    return;
  }

  const buildResult = spawnSync("npm", ["run", "build", "-w", "api"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: process.env,
  });
  if (buildResult.status !== 0) {
    throw new Error(
      `API build failed (status=${buildResult.status}): ${buildResult.stderr}`,
    );
  }
  hasBuiltApi = true;
};

const runCli = (args = [], env = {}) => {
  runApiBuild();
  return spawnSync("node", [SCRIPT_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
};

const assertResult = (result, expectedStatus, label) => {
  assert.equal(
    result.status,
    expectedStatus,
    `${label}: expected exit status ${expectedStatus}, got ${result.status}. stderr: ${result.stderr}`,
  );
};

const withFixture = (override) => {
  const tempDir = mkdtempSync(
    path.join(tmpdir(), "university-bdd-cli-fixture-"),
  );
  const fixturePath = path.join(tempDir, "fixture.json");
  const rawFixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const variant = structuredClone(rawFixture);
  override(variant);
  writeFileSync(fixturePath, JSON.stringify(variant, null, 2), "utf8");
  return { fixturePath, tempDir };
};

test("prints usage with --help", () => {
  const result = runCli(["--help"]);
  assertResult(result, 0, "help command");
  assert.ok(result.stdout.includes("Usage:"), "help output");
  assert.ok(
    result.stdout.includes("--student-ids"),
    "help includes student filter",
  );
});

test("runs with default fixture and writes artifacts", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "university-bdd-cli-"));
  const artifactPath = path.join(tempDir, "artifact.json");
  const replayPath = path.join(tempDir, "replay.json");
  const summaryPath = path.join(tempDir, "summary.txt");
  const filteredArtifactPath = path.join(tempDir, "filtered-artifact.json");

  const fullRun = runCli([
    "--fixture",
    FIXTURE_PATH,
    "--format",
    "summary",
    "--artifact",
    artifactPath,
    "--replay-artifact",
    replayPath,
    "--summary",
    summaryPath,
  ]);
  assertResult(fullRun, 0, "default run");
  assert.ok(
    fullRun.stdout.includes("University BDD summary for:"),
    "summary stdout",
  );

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  assert.equal(artifact.scenarioTitle.includes("University Diploma"), true);
  assert.equal(Array.isArray(artifact.steps), true);
  assert.equal(artifact.steps.length, 4);
  assert.equal(artifact.metadata.studentsTargeted, 10);
  assert.equal(
    typeof artifact.artifactVersion,
    "string",
    "artifactVersion exists",
  );
  assert.equal(artifact.artifactVersion.includes("1."), true);

  const replay = JSON.parse(readFileSync(replayPath, "utf8"));
  assert.equal(replay.steps.length, artifact.steps.length);
  assert.equal(replay.mode, "simulator");
  assert.equal(replay.steps[0].stepId.startsWith("step-"), true);
  assert.equal(
    typeof replay.steps[0].requestHash,
    "string",
    "requestHash exists",
  );
  assert.equal(
    typeof replay.artifactVersion,
    "string",
    "replay artifact version exists",
  );

  const summary = readFileSync(summaryPath, "utf8");
  assert.ok(summary.includes("Mode: simulator"), "summary file includes mode");
  assert.ok(summary.includes("Latency:"), "summary file includes latency");

  const filteredRun = runCli([
    "--fixture",
    FIXTURE_PATH,
    "--student-ids",
    "S002,S005",
    "--company-ids",
    "C001",
    "--artifact",
    filteredArtifactPath,
  ]);
  assertResult(filteredRun, 0, "filtered run");

  const filteredArtifact = JSON.parse(
    readFileSync(filteredArtifactPath, "utf8"),
  );
  assert.equal(filteredArtifact.metadata.studentsTargeted, 2);
  assert.equal(filteredArtifact.metadata.companiesTargeted, 1);
  assert.equal(filteredArtifact.issuedCount, 2);

  rmSync(tempDir, { recursive: true, force: true });
});

test("supports strict replay assertion and detects drift", () => {
  const tempDir = mkdtempSync(
    path.join(tmpdir(), "university-bdd-cli-replay-"),
  );
  const expectedReplayPath = path.join(tempDir, "expected.json");
  const actualReplayPath = path.join(tempDir, "actual.json");
  const driftReplayPath = path.join(tempDir, "drift.json");

  const baselineResult = runCli([
    "--fixture",
    FIXTURE_PATH,
    "--replay-artifact",
    expectedReplayPath,
  ]);
  assertResult(baselineResult, 0, "baseline replay generation");
  assertResult(
    runCli(["--assert-replay", expectedReplayPath]),
    0,
    "replay assertion passes",
  );

  const expectedReplayWithoutVersion = JSON.parse(
    readFileSync(expectedReplayPath, "utf8"),
  );
  delete expectedReplayWithoutVersion.artifactVersion;
  const legacyReplayPath = path.join(tempDir, "legacy-expected-replay.json");
  writeFileSync(
    legacyReplayPath,
    JSON.stringify(expectedReplayWithoutVersion, null, 2),
    "utf8",
  );
  assertResult(
    runCli(["--assert-replay", legacyReplayPath]),
    0,
    "replay assertion supports legacy artifact format",
  );

  const expectedReplay = JSON.parse(readFileSync(expectedReplayPath, "utf8"));
  const driftReplay = structuredClone(expectedReplay);
  driftReplay.steps[0] = {
    ...driftReplay.steps[0],
    responseHash: "tampered-hash",
  };
  writeFileSync(driftReplayPath, JSON.stringify(driftReplay, null, 2), "utf8");

  const driftResult = runCli(["--assert-replay", driftReplayPath]);
  assert.equal(driftResult.status, 1, "replay assertion detects drift");
  assert.ok(
    driftResult.stderr.includes("responseHash mismatch"),
    "drift is reported as response hash mismatch",
  );

  rmSync(tempDir, { recursive: true, force: true });
});

test("parses invalid flags early", () => {
  const badMode = runCli(["--mode", "invalid"]);
  assert.equal(badMode.status, 1, "invalid mode is rejected");
  assert.ok(
    badMode.stderr.includes("--mode must be simulator or standalone"),
    "invalid mode error",
  );

  const unknownArg = runCli(["--bad-flag"]);
  assert.equal(unknownArg.status, 1, "unknown arg is rejected");
  assert.ok(unknownArg.stderr.includes("Unknown argument: --bad-flag"));
});

test("reports missing fixture file with actionable error", () => {
  const missingPath = path.join(
    tmpdir(),
    "university-bdd-missing-fixture.json",
  );
  const missingFixture = runCli(["--fixture", missingPath]);
  assertResult(missingFixture, 1, "missing fixture is rejected");
  assert.ok(
    missingFixture.stderr.includes(
      `University fixture not found: ${missingPath}`,
    ),
    "missing fixture message",
  );
});

test("validates fixture format and required fields", () => {
  const { fixturePath, tempDir } = withFixture((fixture) => {
    // ensure parse path fails with deterministic field-level message
    delete fixture.scenarioVersion;
    delete fixture.students;
  });

  const malformedFixture = runCli(["--fixture", fixturePath]);
  assertResult(malformedFixture, 1, "malformed fixture is rejected");
  assert.ok(
    malformedFixture.stderr.includes(
      "Invalid university fixture format: missing scenarioVersion",
    ),
    "missing scenarioVersion message",
  );
  rmSync(tempDir, { recursive: true, force: true });
});

test("validates fixture ISO timestamps", () => {
  const { fixturePath, tempDir } = withFixture((fixture) => {
    fixture.createdAt = "not-an-iso-date";
  });
  const malformedTimestamp = runCli(["--fixture", fixturePath]);
  assertResult(malformedTimestamp, 1, "invalid timestamp fixture is rejected");
  assert.ok(
    malformedTimestamp.stderr.includes(
      "Invalid ISO timestamp: not-an-iso-date",
    ),
    "invalid timestamp message",
  );
  rmSync(tempDir, { recursive: true, force: true });
});

test("canonicalizes DIDs before scenario execution", () => {
  const { fixturePath, tempDir } = withFixture((fixture) => {
    fixture.university.did = "  DID:midnight:EDU:Midnight-University-State  ";
    fixture.university.issuerDid = "Did:Midnight:KEY:University-Issuer";
    fixture.students[0].did = "  DID:Midnight:USER:Student-001  ";
    fixture.companies[0].did = "did:Midnight:ORG:Company-One";
    fixture.mall.did = "did:MIDNIGHT:ORG:Discount-Mall";
  });

  const artifactPath = path.join(tempDir, "canonicalized.json");
  const canonicalizedRun = runCli([
    "--fixture",
    fixturePath,
    "--artifact",
    artifactPath,
    "--format",
    "json",
  ]);

  assertResult(canonicalizedRun, 0, "canonicalized run");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const issueStep = artifact.steps.find(
    (step) => step.step === "Issue diploma VC across batches",
  );
  const firstIssue = issueStep?.response?.issuedRequests?.[0]?.request;
  assert.ok(
    firstIssue?.studentDid === "did:midnight:user:student-001",
    "student DID canonicalized",
  );
  assert.ok(
    firstIssue?.universityDid === "did:midnight:edu:midnight-university-state",
    "university DID canonicalized",
  );

  rmSync(tempDir, { recursive: true, force: true });
});

test("rejects malformed student and company records with field-level diagnostics", () => {
  const { fixturePath, tempDir } = withFixture((fixture) => {
    fixture.students[0] = { studentId: 123 };
    fixture.companies[0] = { companyId: "C001" };
  });

  const malformedStudents = runCli(["--fixture", fixturePath]);
  assert.equal(
    malformedStudents.status,
    1,
    "invalid student/company fixture is rejected",
  );
  assert.ok(
    malformedStudents.stderr.includes("students[0].did"),
    "student record diagnostics",
  );

  rmSync(tempDir, { recursive: true, force: true });
});
