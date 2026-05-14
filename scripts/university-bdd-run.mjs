#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  loadUniversityScenarioFromFile,
  runUniversityDiplomaScenario,
  summarizeUniversityScenario,
  toUniversityScenarioArtifact,
  toUniversityScenarioReplayArtifact,
  normalizeUniversityScenarioReplayArtifact,
} from "../api/dist/index.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = resolve(
  SCRIPT_DIR,
  "../api/src/test/fixtures/university-diploma/university-bdd.fixture.json",
);
const usage = `Usage:
  node scripts/university-bdd-run.mjs [options]

Options:
  --fixture <path>             Fixture JSON path (default: ${DEFAULT_FIXTURE_PATH})
  --mode <simulator|standalone> Scenario transport mode
  --student-ids <a,b,c>        Comma-separated list of studentIds
  --company-ids <a,b,c>        Comma-separated list of companyIds
  --artifact <path>            Write full scenario artifact JSON
  --replay-artifact <path>     Write replay artifact JSON
  --summary <path>             Write human summary text
  --max-step-ms <ms>           Fail if any step latency exceeds this threshold
  --max-total-ms <ms>          Fail if total latency exceeds this threshold
  --assert-replay <path>       Compare generated replay artifact with expected file
  --format <json|summary>      Output format for stdout (default: json)
  --help                       Show usage`;

const printUsage = (exitCode = 0) => {
  console.log(usage);
  process.exit(exitCode);
};

const parseNumber = (value, flag) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid numeric value for ${flag}: ${value}`);
  }
  return parsed;
};

const parseCommaList = (value, flag) => {
  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`Invalid list for ${flag}: ${value}`);
  }
  return values;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const next = {
    mode: undefined,
    studentIds: undefined,
    companyIds: undefined,
    fixture: DEFAULT_FIXTURE_PATH,
    artifactPath: undefined,
    replayArtifactPath: undefined,
    summaryPath: undefined,
    maxStepMs: undefined,
    maxTotalMs: undefined,
    assertReplay: undefined,
    format: "json",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    if (arg === "--help") {
      printUsage(0);
    }

    if (arg === "--fixture") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--fixture requires a value");
      }
      next.fixture = resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--mode") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--mode requires a value");
      }
      if (value !== "simulator" && value !== "standalone") {
        throw new Error("--mode must be simulator or standalone");
      }
      next.mode = value;
      index += 1;
      continue;
    }

    if (arg === "--student-ids") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--student-ids requires a value");
      }
      next.studentIds = parseCommaList(value, "--student-ids");
      index += 1;
      continue;
    }

    if (arg === "--company-ids") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--company-ids requires a value");
      }
      next.companyIds = parseCommaList(value, "--company-ids");
      index += 1;
      continue;
    }

    if (arg === "--artifact") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--artifact requires a path");
      }
      next.artifactPath = value;
      index += 1;
      continue;
    }

    if (arg === "--replay-artifact") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--replay-artifact requires a path");
      }
      next.replayArtifactPath = value;
      index += 1;
      continue;
    }

    if (arg === "--summary") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--summary requires a path");
      }
      next.summaryPath = value;
      index += 1;
      continue;
    }

    if (arg === "--max-step-ms") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--max-step-ms requires a numeric value");
      }
      next.maxStepMs = parseNumber(value, "--max-step-ms");
      index += 1;
      continue;
    }

    if (arg === "--max-total-ms") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--max-total-ms requires a numeric value");
      }
      next.maxTotalMs = parseNumber(value, "--max-total-ms");
      index += 1;
      continue;
    }

    if (arg === "--assert-replay") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--assert-replay requires a path");
      }
      next.assertReplay = value;
      index += 1;
      continue;
    }

    if (arg === "--format") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--format requires json or summary");
      }
      if (value !== "json" && value !== "summary") {
        throw new Error("--format must be json or summary");
      }
      next.format = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return next;
};

const writeIfPath = (pathValue, payload, encoding = "utf8") => {
  if (pathValue == null) {
    return;
  }
  const destination = resolve(pathValue);
  const output = payload();
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, output, encoding);
};

const assertReplayMatch = (actualReplay, expectedReplay) => {
  if (actualReplay.mode !== expectedReplay.mode) {
    throw new Error(
      `Replay mode mismatch: ${actualReplay.mode} != ${expectedReplay.mode}`,
    );
  }

  if (actualReplay.steps.length !== expectedReplay.steps.length) {
    throw new Error(
      `Replay step count mismatch: ${actualReplay.steps.length} != ${expectedReplay.steps.length}`,
    );
  }

  for (let index = 0; index < actualReplay.steps.length; index += 1) {
    const actualStep = actualReplay.steps[index];
    const expectedStep = expectedReplay.steps[index];

    if (actualStep.stepId !== expectedStep.stepId) {
      throw new Error(
        `Replay stepId mismatch at index ${index}: ${actualStep.stepId} != ${expectedStep.stepId}`,
      );
    }
    if (actualStep.step !== expectedStep.step) {
      throw new Error(
        `Replay step name mismatch at index ${index}: ${actualStep.step} != ${expectedStep.step}`,
      );
    }
    if (actualStep.requestHash !== expectedStep.requestHash) {
      throw new Error(
        `Replay requestHash mismatch at index ${index}: ${actualStep.step} ${actualStep.requestHash} != ${expectedStep.requestHash}`,
      );
    }
    if (actualStep.responseHash !== expectedStep.responseHash) {
      throw new Error(
        `Replay responseHash mismatch at index ${index}: ${actualStep.step} ${actualStep.responseHash} != ${expectedStep.responseHash}`,
      );
    }
  }
};

const assertLatencyBudget = (result, maxStepMs, maxTotalMs) => {
  if (maxStepMs != null) {
    for (const step of result.steps) {
      if (step.latencyMs > maxStepMs) {
        throw new Error(
          `Step ${step.step} exceeded max latency budget: ${step.latencyMs}ms > ${maxStepMs}ms`,
        );
      }
    }
  }

  if (maxTotalMs != null && result.timing.totalLatencyMs > maxTotalMs) {
    throw new Error(
      `Total latency exceeded max budget: ${result.timing.totalLatencyMs}ms > ${maxTotalMs}ms`,
    );
  }
};

const run = async () => {
  const options = parseArgs();
  const fixture = loadUniversityScenarioFromFile(resolve(options.fixture));

  const result = await runUniversityDiplomaScenario(fixture, {
    mode: options.mode,
    studentIds: options.studentIds,
    companyIds: options.companyIds,
  });

  assertLatencyBudget(result, options.maxStepMs, options.maxTotalMs);

  const artifact = toUniversityScenarioArtifact(result);
  const replay = toUniversityScenarioReplayArtifact(result);

  if (options.assertReplay != null) {
    const expectedReplay = normalizeUniversityScenarioReplayArtifact(
      JSON.parse(readFileSync(resolve(options.assertReplay), "utf8")),
    );
    assertReplayMatch(replay, expectedReplay);
  }

  writeIfPath(options.artifactPath, () => JSON.stringify(artifact, null, 2));
  writeIfPath(options.replayArtifactPath, () =>
    JSON.stringify(replay, null, 2),
  );
  writeIfPath(options.summaryPath, () => summarizeUniversityScenario(result));

  if (options.format === "summary") {
    console.log(summarizeUniversityScenario(result));
  } else {
    console.log(JSON.stringify(artifact, null, 2));
  }
};

run().catch((error) => {
  console.error(
    `University BDD run failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
