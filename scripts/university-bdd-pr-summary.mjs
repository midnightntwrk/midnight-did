#!/usr/bin/env node
import process from "node:process";

import {
  DEFAULT_UNIVERSITY_BDD_REPORT,
  getReportSummary,
  getSlowestStep,
  markdownTable,
  readJsonFile,
  writeOutput,
} from "./university-bdd-artifact-utils.mjs";

const USAGE = `Usage:
  node scripts/university-bdd-pr-summary.mjs [options]

Options:
  --candidate <path>     Candidate University BDD report JSON path (default: ${DEFAULT_UNIVERSITY_BDD_REPORT})
  --baseline <path>      Optional baseline University BDD report JSON path
  --out <path>           Write markdown output to file instead of stdout
  --help                 Show usage`;

const parseArgs = () => {
  const options = {
    candidate: DEFAULT_UNIVERSITY_BDD_REPORT,
    baseline: undefined,
    out: undefined,
  };
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    if (arg === "--candidate") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--candidate requires a path");
      }
      options.candidate = value;
      index += 1;
      continue;
    }
    if (arg === "--baseline") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--baseline requires a path");
      }
      options.baseline = value;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--out requires a path");
      }
      options.out = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const delta = (baseline, candidate) => {
  if (baseline == null) {
    return "n/a";
  }
  const value = candidate - baseline;
  return value > 0 ? `+${value}` : String(value);
};

const formatSummary = ({ baseline, candidate, candidateSlowest }) => {
  const rows = [
    [
      "Artifact version",
      baseline?.artifactVersion ?? "n/a",
      candidate.artifactVersion,
      "n/a",
    ],
    ["Mode", baseline?.mode ?? "n/a", candidate.mode, "n/a"],
    [
      "Issued credentials",
      baseline?.issuedCount ?? "n/a",
      candidate.issuedCount,
      delta(baseline?.issuedCount, candidate.issuedCount),
    ],
    [
      "Approved applications",
      baseline?.approvedApplications ?? "n/a",
      candidate.approvedApplications,
      delta(baseline?.approvedApplications, candidate.approvedApplications),
    ],
    [
      "Approved discounts",
      baseline?.approvedDiscounts ?? "n/a",
      candidate.approvedDiscounts,
      delta(baseline?.approvedDiscounts, candidate.approvedDiscounts),
    ],
    [
      "Total latency",
      baseline == null ? "n/a" : `${baseline.totalLatencyMs}ms`,
      `${candidate.totalLatencyMs}ms`,
      baseline == null
        ? "n/a"
        : `${delta(baseline.totalLatencyMs, candidate.totalLatencyMs)}ms`,
    ],
  ];

  return [
    "## University BDD PR Summary",
    "",
    `Scenario: ${candidate.scenarioTitle}`,
    "",
    markdownTable(["Metric", "Baseline", "Candidate", "Delta"], rows),
    "",
    `Slowest candidate step: ${candidateSlowest.stepId} (${candidateSlowest.latencyMs}ms)`,
    "",
    "Suggested validation commands:",
    "",
    "```bash",
    "npm run university-bdd:run -- --artifact /tmp/university-bdd-report.json --replay-artifact /tmp/university-bdd-replay.json --summary /tmp/university-bdd-summary.md --format summary",
    "npm run university-bdd:metrics -- --report /tmp/university-bdd-report.json --format markdown",
    "```",
  ].join("\n");
};

const main = () => {
  const options = parseArgs();
  const candidateReport = readJsonFile(
    options.candidate,
    "Candidate University BDD report",
  );
  const baselineReport =
    options.baseline == null
      ? undefined
      : readJsonFile(options.baseline, "Baseline University BDD report");

  const candidate = getReportSummary(candidateReport);
  const baseline =
    baselineReport == null ? undefined : getReportSummary(baselineReport);
  const candidateSlowest = getSlowestStep(candidateReport);

  writeOutput(
    options.out,
    formatSummary({ baseline, candidate, candidateSlowest }),
  );
};

main();

