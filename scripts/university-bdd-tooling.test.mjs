import { spawnSync } from "node:child_process";
import { strict as assert } from "node:assert";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import test from "node:test";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const runScript = (scriptName, args = []) =>
  spawnSync("node", [path.join(ROOT_DIR, "scripts", scriptName), ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: process.env,
  });

test("repo PR snippet emits stable JSON fields", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "repo-pr-snippet-"));
  const metricsPath = path.join(tempDir, "metrics.json");
  writeFileSync(
    metricsPath,
    JSON.stringify({
      generatedAt: "2026-05-15T00:00:00Z",
      totalSteps: 2,
      steps: [
        { index: 1, label: "Lint", durationMs: 10 },
        { index: 2, label: "Test", durationMs: 30 },
      ],
    }),
    "utf8",
  );

  const result = runScript("repo-pr-snippet.mjs", [
    "--metrics",
    metricsPath,
    "--command",
    "bash ./run.sh --skip-coverage",
    "--verdict",
    "pass",
    "--format",
    "json",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.snippetVersion, "1.0.0");
  assert.equal(payload.verdict, "pass");
  assert.equal(payload.runMetrics.slowestStep, "Test");
  assert.equal(payload.universityBdd.issuedCount, 10);

  rmSync(tempDir, { recursive: true, force: true });
});

test("university BDD metrics emits CSV and honors budgets", () => {
  const csvResult = runScript("university-bdd-metrics.mjs", [
    "--format",
    "csv",
    "--max-total-ms",
    "10000",
    "--max-step-ms",
    "10000",
  ]);
  assert.equal(csvResult.status, 0, csvResult.stderr);
  assert.ok(csvResult.stdout.includes("stepId"));
  assert.ok(csvResult.stdout.includes("01-load-graduating-class"));

  const failResult = runScript("university-bdd-metrics.mjs", [
    "--max-total-ms",
    "0",
  ]);
  assert.equal(failResult.status, 1);
  assert.ok(
    failResult.stderr.includes("University BDD metrics budget failed"),
    failResult.stderr,
  );
});

test("university BDD PR summary includes counts and validation commands", () => {
  const result = runScript("university-bdd-pr-summary.mjs", []);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("University BDD PR Summary"));
  assert.ok(result.stdout.includes("Issued credentials"));
  assert.ok(result.stdout.includes("npm run university-bdd:metrics"));
});

test("university BDD visualizer writes HTML and Mermaid source", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "university-bdd-viz-"));
  const outPath = path.join(tempDir, "replay.html");
  const result = runScript("university-bdd-replay-visualize.mjs", [
    "--limit",
    "2",
    "--out",
    outPath,
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(outPath));
  const html = readFileSync(outPath, "utf8");
  assert.ok(html.includes("sequenceDiagram"));
  assert.ok(html.includes("issueDiploma"));
  assert.ok(html.includes("presentProof"));

  rmSync(tempDir, { recursive: true, force: true });
});

