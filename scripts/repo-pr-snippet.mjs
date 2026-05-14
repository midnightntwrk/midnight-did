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
  node scripts/repo-pr-snippet.mjs [options]

Options:
  --metrics <path>       run.sh metrics JSON path
  --bdd-report <path>    University BDD report JSON path (default: ${DEFAULT_UNIVERSITY_BDD_REPORT})
  --command <text>       Command used for the validation run
  --verdict <text>       Validation verdict, for example pass/fail/pending (default: pending)
  --format <markdown|json> Output format (default: markdown)
  --out <path>           Write output to file instead of stdout
  --help                 Show usage`;

const parseArgs = () => {
  const options = {
    metricsPath: undefined,
    bddReportPath: DEFAULT_UNIVERSITY_BDD_REPORT,
    command: "not provided",
    verdict: "pending",
    format: "markdown",
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
    if (arg === "--metrics") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--metrics requires a path");
      }
      options.metricsPath = value;
      index += 1;
      continue;
    }
    if (arg === "--bdd-report") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--bdd-report requires a path");
      }
      options.bddReportPath = value;
      index += 1;
      continue;
    }
    if (arg === "--command") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--command requires text");
      }
      options.command = value;
      index += 1;
      continue;
    }
    if (arg === "--verdict") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--verdict requires text");
      }
      options.verdict = value;
      index += 1;
      continue;
    }
    if (arg === "--format") {
      if (value !== "markdown" && value !== "json") {
        throw new Error("--format must be markdown or json");
      }
      options.format = value;
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

const summarizeMetrics = (metricsPath) => {
  if (metricsPath == null) {
    return {
      provided: false,
      totalSteps: 0,
      totalDurationMs: 0,
      slowestStep: "not provided",
      slowestDurationMs: 0,
    };
  }

  const metrics = readJsonFile(metricsPath, "Metrics JSON");
  const steps = Array.isArray(metrics.steps) ? metrics.steps : [];
  const slowest = steps.reduce(
    (current, step) =>
      Number(step.durationMs ?? 0) > Number(current.durationMs ?? 0)
        ? step
        : current,
    { label: "none", durationMs: 0 },
  );

  return {
    provided: true,
    generatedAt: metrics.generatedAt ?? "unknown",
    totalSteps: metrics.totalSteps ?? steps.length,
    totalDurationMs: steps.reduce(
      (total, step) => total + Number(step.durationMs ?? 0),
      0,
    ),
    slowestStep: slowest.label ?? "none",
    slowestDurationMs: Number(slowest.durationMs ?? 0),
  };
};

const buildPayload = (options) => {
  const report = readJsonFile(options.bddReportPath, "University BDD report");
  const reportSummary = getReportSummary(report);
  const bddSlowest = getSlowestStep(report);
  const runMetrics = summarizeMetrics(options.metricsPath);

  return {
    snippetVersion: "1.0.0",
    verdict: options.verdict,
    command: options.command,
    runMetrics,
    universityBdd: {
      artifactVersion: reportSummary.artifactVersion,
      scenarioTitle: reportSummary.scenarioTitle,
      mode: reportSummary.mode,
      fixtureVersion: reportSummary.fixtureVersion,
      issuedCount: reportSummary.issuedCount,
      approvedApplications: reportSummary.approvedApplications,
      approvedDiscounts: reportSummary.approvedDiscounts,
      totalLatencyMs: reportSummary.totalLatencyMs,
      slowestStep: bddSlowest.stepId,
      slowestLatencyMs: bddSlowest.latencyMs,
    },
  };
};

const formatMarkdown = (payload) => {
  const rows = [
    ["Snippet version", payload.snippetVersion],
    ["Verdict", payload.verdict],
    ["Command", `\`${payload.command}\``],
    ["run.sh total steps", payload.runMetrics.totalSteps],
    ["run.sh total duration", `${payload.runMetrics.totalDurationMs}ms`],
    [
      "run.sh slowest step",
      `${payload.runMetrics.slowestStep} (${payload.runMetrics.slowestDurationMs}ms)`,
    ],
    ["BDD artifact version", payload.universityBdd.artifactVersion],
    ["BDD mode", payload.universityBdd.mode],
    ["Issued credentials", payload.universityBdd.issuedCount],
    ["Approved applications", payload.universityBdd.approvedApplications],
    ["Approved discounts", payload.universityBdd.approvedDiscounts],
    ["BDD total latency", `${payload.universityBdd.totalLatencyMs}ms`],
    [
      "BDD slowest step",
      `${payload.universityBdd.slowestStep} (${payload.universityBdd.slowestLatencyMs}ms)`,
    ],
  ];

  return [
    "## PR Validation Snapshot",
    "",
    markdownTable(["Field", "Value"], rows),
  ].join("\n");
};

const main = () => {
  const options = parseArgs();
  const payload = buildPayload(options);
  const output =
    options.format === "json"
      ? JSON.stringify(payload, null, 2)
      : formatMarkdown(payload);
  writeOutput(options.out, output);
};

main();

