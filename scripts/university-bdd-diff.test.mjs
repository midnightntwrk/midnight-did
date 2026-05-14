import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import test from "node:test";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SCRIPT_PATH = path.join(ROOT_DIR, "scripts", "university-bdd-diff.mjs");

const buildArtifact = (overrides = {}) => ({
  scenarioTitle: "University Diploma Issuance and Presentation",
  generatedAt: "2026-05-14T00:00:00.000Z",
  timing: {
    totalSteps: 2,
    totalLatencyMs: 130,
    avgLatencyMs: 65,
  },
  issuedCount: 10,
  applicationCount: 9,
  discountCount: 5,
  approvedApplications: 9,
  approvedDiscounts: 5,
  metadata: {
    mode: "simulator",
    studentsTargeted: 10,
    companiesTargeted: 3,
    totalStudents: 10,
    totalCompanies: 3,
  },
  steps: [
    {
      step: "Issue",
      stepId: "01-issue",
      requestId: "r1",
      requestHash: "a1",
      responseHash: "b1",
      latencyMs: 80,
      checks: ["A"],
    },
    {
      step: "Finalize",
      stepId: "02-finalize",
      requestId: "r2",
      requestHash: "a2",
      responseHash: "b2",
      latencyMs: 50,
      checks: ["A", "B"],
    },
  ],
  ...overrides,
});

const runDiff = (args, cwd = ROOT_DIR) => {
  return spawnSync("node", [SCRIPT_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
};

test("prints deterministic json diff output", () => {
  const tempDir = mkdtempSync(
    path.join(process.env.TMPDIR ?? "/tmp", "university-bdd-diff-"),
  );
  const baselinePath = path.join(tempDir, "baseline.json");
  const candidatePath = path.join(tempDir, "candidate.json");

  const base = buildArtifact();
  const candidate = buildArtifact({
    issuedCount: 11,
    approvedDiscounts: 6,
    timing: {
      ...base.timing,
      totalLatencyMs: 160,
      avgLatencyMs: 80,
    },
    steps: [
      {
        ...base.steps[0],
        latencyMs: 90,
      },
      {
        ...base.steps[1],
        latencyMs: 70,
      },
    ],
  });

  writeFileSync(baselinePath, JSON.stringify(base, null, 2), "utf8");
  writeFileSync(candidatePath, JSON.stringify(candidate, null, 2), "utf8");

  const result = runDiff([
    "--baseline",
    baselinePath,
    "--candidate",
    candidatePath,
    "--format",
    "json",
  ]);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.metrics.issuedCount.delta, 1);
  assert.equal(payload.metrics.approvedDiscounts.delta, 1);
  assert.equal(payload.metrics.totalLatencyMs.delta, 30);
  assert.equal(
    payload.stepDeltas.find((step) => step.stepId === "01-issue")
      ?.deltaLatencyMs,
    10,
  );

  rmSync(tempDir, { recursive: true, force: true });
});

test("fails with regression when guard enabled", () => {
  const tempDir = mkdtempSync(
    path.join(process.env.TMPDIR ?? "/tmp", "university-bdd-diff-"),
  );
  const baselinePath = path.join(tempDir, "baseline.json");
  const candidatePath = path.join(tempDir, "candidate.json");

  const base = buildArtifact();
  const candidate = buildArtifact({ issuedCount: 9 });

  writeFileSync(baselinePath, JSON.stringify(base, null, 2), "utf8");
  writeFileSync(candidatePath, JSON.stringify(candidate, null, 2), "utf8");

  const result = runDiff([
    "--baseline",
    baselinePath,
    "--candidate",
    candidatePath,
    "--fail-on-regression",
    "--format",
    "text",
  ]);
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes("issuedCount: 10 -> 9 (-1)"));

  rmSync(tempDir, { recursive: true, force: true });
});

test("rejects malformed arguments", () => {
  const result = runDiff([
    "--candidate",
    "missing.json",
    "--baseline",
    "also-missing.json",
  ]);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("Artifact not found"));
});
