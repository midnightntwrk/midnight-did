#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import process from "node:process";

const usage = `Usage:
  node scripts/university-bdd-diff.mjs [options]

Options:
  --baseline <path>      Baseline BDD artifact JSON path
  --candidate <path>     Candidate BDD artifact JSON path
  --format <json|text>   Output format (default: text)
  --fail-on-regression    Exit 1 when candidate reduces key counts
  --help                 Show usage`;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    baseline: undefined,
    candidate: undefined,
    format: "text",
    failOnRegression: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    if (arg === "--help") {
      console.log(usage);
      process.exit(0);
    }

    if (arg === "--baseline") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--baseline requires a file path");
      }
      options.baseline = value;
      index += 1;
      continue;
    }

    if (arg === "--candidate") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--candidate requires a file path");
      }
      options.candidate = value;
      index += 1;
      continue;
    }

    if (arg === "--format") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--format requires json or text");
      }
      if (value !== "json" && value !== "text") {
        throw new Error("--format must be json or text");
      }
      options.format = value;
      index += 1;
      continue;
    }

    if (arg === "--fail-on-regression") {
      options.failOnRegression = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.baseline == null) {
    throw new Error("Missing required --baseline path");
  }
  if (options.candidate == null) {
    throw new Error("Missing required --candidate path");
  }
  return options;
};

const readArtifact = (artifactPath) => {
  const resolved = artifactPath;
  if (!existsSync(resolved)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }

  const raw = readFileSync(resolved, "utf8");
  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== "object") {
    throw new Error(`Invalid artifact payload: ${artifactPath}`);
  }
  if (!Array.isArray(payload.steps)) {
    throw new Error(`Invalid artifact steps: ${artifactPath}`);
  }
  return payload;
};

const sum = (values) => values.reduce((acc, value) => acc + value, 0);

const summarize = (artifact) => {
  const steps = artifact.steps ?? [];

  return {
    scenarioTitle: artifact.scenarioTitle,
    generatedAt: artifact.generatedAt,
    mode: artifact.metadata?.mode,
    issuedCount: artifact.issuedCount ?? 0,
    applicationCount: artifact.applicationCount ?? 0,
    discountCount: artifact.discountCount ?? 0,
    approvedApplications: artifact.approvedApplications ?? 0,
    approvedDiscounts: artifact.approvedDiscounts ?? 0,
    totalSteps: artifact.timing?.totalSteps ?? steps.length,
    totalLatencyMs:
      artifact.timing?.totalLatencyMs ??
      sum(steps.map((step) => step.latencyMs ?? 0)),
    avgLatencyMs: artifact.timing?.avgLatencyMs ?? 0,
    metadata: {
      studentsTargeted: artifact.metadata?.studentsTargeted,
      companiesTargeted: artifact.metadata?.companiesTargeted,
      fixtureVersion: artifact.metadata?.fixtureVersion,
    },
    stepSummaries: steps.map((step) => ({
      stepId: step.stepId ?? step.step,
      requestId: step.requestId,
      latencyMs: step.latencyMs ?? 0,
      checks: (step.checks ?? []).length,
    })),
  };
};

const toDelta = (base, candidate) => {
  if (base == null || candidate == null) {
    return 0;
  }
  return candidate - base;
};

const compare = (baseline, candidate) => {
  const baseSummary = summarize(baseline);
  const candidateSummary = summarize(candidate);

  const stepById = new Map();
  for (const step of candidateSummary.stepSummaries) {
    stepById.set(step.stepId, step);
  }
  for (const step of baseSummary.stepSummaries) {
    stepById.set(step.stepId, {
      ...(stepById.get(step.stepId) ?? {}),
      stepId: step.stepId,
    });
  }

  const stepDeltas = Array.from(stepById.keys())
    .sort()
    .map((stepId) => {
      const baseStep = baseSummary.stepSummaries.find(
        (entry) => entry.stepId === stepId,
      );
      const candidateStep = candidateSummary.stepSummaries.find(
        (entry) => entry.stepId === stepId,
      );
      return {
        stepId,
        baselineLatencyMs: baseStep?.latencyMs ?? 0,
        candidateLatencyMs: candidateStep?.latencyMs ?? 0,
        deltaLatencyMs: toDelta(
          baseStep?.latencyMs ?? 0,
          candidateStep?.latencyMs ?? 0,
        ),
        baselineChecks: baseStep?.checks ?? 0,
        candidateChecks: candidateStep?.checks ?? 0,
        deltaChecks: toDelta(baseStep?.checks ?? 0, candidateStep?.checks ?? 0),
        added: baseStep == null,
        removed: candidateStep == null,
      };
    });

  const metrics = {
    issuedCount: {
      baseline: baseSummary.issuedCount,
      candidate: candidateSummary.issuedCount,
      delta: toDelta(baseSummary.issuedCount, candidateSummary.issuedCount),
    },
    applicationCount: {
      baseline: baseSummary.applicationCount,
      candidate: candidateSummary.applicationCount,
      delta: toDelta(
        baseSummary.applicationCount,
        candidateSummary.applicationCount,
      ),
    },
    discountCount: {
      baseline: baseSummary.discountCount,
      candidate: candidateSummary.discountCount,
      delta: toDelta(baseSummary.discountCount, candidateSummary.discountCount),
    },
    approvedApplications: {
      baseline: baseSummary.approvedApplications,
      candidate: candidateSummary.approvedApplications,
      delta: toDelta(
        baseSummary.approvedApplications,
        candidateSummary.approvedApplications,
      ),
    },
    approvedDiscounts: {
      baseline: baseSummary.approvedDiscounts,
      candidate: candidateSummary.approvedDiscounts,
      delta: toDelta(
        baseSummary.approvedDiscounts,
        candidateSummary.approvedDiscounts,
      ),
    },
    totalLatencyMs: {
      baseline: baseSummary.totalLatencyMs,
      candidate: candidateSummary.totalLatencyMs,
      delta: toDelta(
        baseSummary.totalLatencyMs,
        candidateSummary.totalLatencyMs,
      ),
    },
  };

  const hasRegression =
    metrics.issuedCount.delta < 0 ||
    metrics.applicationCount.delta < 0 ||
    metrics.discountCount.delta < 0 ||
    metrics.approvedApplications.delta < 0 ||
    metrics.approvedDiscounts.delta < 0;

  return {
    baseline: {
      path: process.argv[process.argv.indexOf("--baseline") + 1],
      ...baseSummary,
    },
    candidate: {
      path: process.argv[process.argv.indexOf("--candidate") + 1],
      ...candidateSummary,
    },
    metrics,
    stepDeltas,
    hasRegression,
  };
};

const formatText = (diff) => {
  const lines = [];
  lines.push("University BDD artifact comparison");
  lines.push(`Baseline: ${diff.baseline.path}`);
  lines.push(`Candidate: ${diff.candidate.path}`);
  lines.push(`Scenario: ${diff.baseline.scenarioTitle}`);
  lines.push(`Mode: ${diff.baseline.mode} -> ${diff.candidate.mode}`);

  for (const [name, metric] of Object.entries(diff.metrics)) {
    const deltaSymbol = metric.delta > 0 ? "+" : "";
    lines.push(
      `${name}: ${metric.baseline} -> ${metric.candidate} (${deltaSymbol}${metric.delta})`,
    );
  }

  lines.push("\nStep latency deltas:");
  for (const step of diff.stepDeltas) {
    const status = step.added ? "(added)" : step.removed ? "(removed)" : "";
    const sign = step.deltaLatencyMs > 0 ? "+" : "";
    lines.push(
      `${step.stepId}: ${step.baselineLatencyMs}ms -> ${step.candidateLatencyMs}ms (${sign}${step.deltaLatencyMs}ms) ${status}`,
    );
  }

  return lines.join("\n");
};

const main = () => {
  const options = parseArgs();
  const baseline = readArtifact(options.baseline);
  const candidate = readArtifact(options.candidate);
  const diff = compare(baseline, candidate);

  const output =
    options.format === "json"
      ? JSON.stringify(diff, null, 2)
      : formatText(diff);

  console.log(output);

  if (options.failOnRegression && diff.hasRegression) {
    process.exitCode = 1;
  }
};

try {
  main();
} catch (error) {
  console.error(error?.message ?? "Unknown error");
  process.exit(1);
}
