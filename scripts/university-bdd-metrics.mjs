#!/usr/bin/env node
import process from "node:process";

import {
  DEFAULT_UNIVERSITY_BDD_REPORT,
  getReportSummary,
  getStepRows,
  markdownTable,
  parseNonNegativeInteger,
  readJsonFile,
  toCsv,
  writeOutput,
} from "./university-bdd-artifact-utils.mjs";

const USAGE = `Usage:
  node scripts/university-bdd-metrics.mjs [options]

Options:
  --report <path>        University BDD report JSON path (default: ${DEFAULT_UNIVERSITY_BDD_REPORT})
  --format <json|csv|markdown> Output format (default: json)
  --commit <sha>         Commit SHA or branch label to include in metric rows
  --max-step-ms <ms>     Fail if any step exceeds this latency budget
  --max-total-ms <ms>    Fail if total scenario latency exceeds this budget
  --out <path>           Write output to file instead of stdout
  --help                 Show usage`;

const parseArgs = () => {
  const options = {
    reportPath: DEFAULT_UNIVERSITY_BDD_REPORT,
    format: "json",
    commit: "",
    maxStepMs: undefined,
    maxTotalMs: undefined,
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
    if (arg === "--report") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--report requires a path");
      }
      options.reportPath = value;
      index += 1;
      continue;
    }
    if (arg === "--format") {
      if (value !== "json" && value !== "csv" && value !== "markdown") {
        throw new Error("--format must be json, csv, or markdown");
      }
      options.format = value;
      index += 1;
      continue;
    }
    if (arg === "--commit") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--commit requires a value");
      }
      options.commit = value;
      index += 1;
      continue;
    }
    if (arg === "--max-step-ms") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--max-step-ms requires a value");
      }
      options.maxStepMs = parseNonNegativeInteger(value, "--max-step-ms");
      index += 1;
      continue;
    }
    if (arg === "--max-total-ms") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--max-total-ms requires a value");
      }
      options.maxTotalMs = parseNonNegativeInteger(value, "--max-total-ms");
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

const assertBudgets = (summary, rows, options) => {
  const failures = [];
  if (options.maxTotalMs != null && summary.totalLatencyMs > options.maxTotalMs) {
    failures.push(
      `totalLatencyMs ${summary.totalLatencyMs}ms exceeds ${options.maxTotalMs}ms`,
    );
  }

  if (options.maxStepMs != null) {
    for (const row of rows) {
      if (row.latencyMs > options.maxStepMs) {
        failures.push(
          `${row.stepId} latency ${row.latencyMs}ms exceeds ${options.maxStepMs}ms`,
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`University BDD metrics budget failed: ${failures.join("; ")}`);
  }
};

const toMarkdown = (summary, rows) => {
  const summaryRows = [
    ["Artifact version", summary.artifactVersion],
    ["Mode", summary.mode],
    ["Issued", summary.issuedCount],
    ["Approved applications", summary.approvedApplications],
    ["Approved discounts", summary.approvedDiscounts],
    ["Total latency", `${summary.totalLatencyMs}ms`],
  ];
  const stepRows = rows.map((row) => [
    row.stepIndex,
    row.stepId,
    row.latencyMs,
    row.checks,
    row.involvedDids,
  ]);

  return [
    "# University BDD Metrics",
    "",
    markdownTable(["Metric", "Value"], summaryRows),
    "",
    markdownTable(
      ["#", "Step", "Latency ms", "Checks", "DIDs"],
      stepRows,
    ),
  ].join("\n");
};

const main = () => {
  const options = parseArgs();
  const report = readJsonFile(options.reportPath, "University BDD report");
  const summary = getReportSummary(report);
  const rows = getStepRows(report, { commit: options.commit });

  assertBudgets(summary, rows, options);

  const payload = {
    metricsVersion: "1.0.0",
    source: options.reportPath,
    summary,
    rows,
  };

  const output =
    options.format === "csv"
      ? toCsv(rows)
      : options.format === "markdown"
        ? toMarkdown(summary, rows)
        : JSON.stringify(payload, null, 2);

  writeOutput(options.out, output);
};

main();

