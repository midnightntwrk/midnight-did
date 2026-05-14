import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DEFAULT_UNIVERSITY_BDD_REPORT =
  "docs/uc-bundles/university-bdd/sample-report.json";
export const DEFAULT_UNIVERSITY_BDD_REPLAY =
  "docs/uc-bundles/university-bdd/sample-replay.json";

export const readJsonFile = (filePath, label = "JSON file") => {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    throw new Error(`${label} not found: ${filePath}`);
  }

  return JSON.parse(readFileSync(resolved, "utf8"));
};

export const writeOutput = (filePath, content) => {
  if (filePath == null) {
    process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
    return;
  }

  const resolved = resolve(filePath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content.endsWith("\n") ? content : `${content}\n`);
};

export const parsePositiveInteger = (value, flag) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return parsed;
};

export const parseNonNegativeInteger = (value, flag) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} requires a non-negative integer`);
  }
  return parsed;
};

export const sum = (values) => values.reduce((acc, value) => acc + value, 0);

export const getReportSummary = (report) => {
  const steps = Array.isArray(report.steps) ? report.steps : [];
  const totalLatencyMs =
    report.timing?.totalLatencyMs ??
    sum(steps.map((step) => Number(step.latencyMs ?? 0)));

  return {
    artifactVersion: report.artifactVersion ?? "unknown",
    scenarioTitle: report.scenarioTitle ?? "unknown",
    generatedAt: report.generatedAt ?? "unknown",
    mode: report.metadata?.mode ?? report.mode ?? "unknown",
    fixtureVersion: report.metadata?.fixtureVersion ?? "unknown",
    studentsTargeted: report.metadata?.studentsTargeted ?? 0,
    companiesTargeted: report.metadata?.companiesTargeted ?? 0,
    issuedCount: report.issuedCount ?? 0,
    applicationCount: report.applicationCount ?? 0,
    discountCount: report.discountCount ?? 0,
    approvedApplications: report.approvedApplications ?? 0,
    approvedDiscounts: report.approvedDiscounts ?? 0,
    totalSteps: report.timing?.totalSteps ?? steps.length,
    totalLatencyMs,
    avgLatencyMs:
      report.timing?.avgLatencyMs ??
      Math.round(totalLatencyMs / Math.max(steps.length, 1)),
  };
};

export const getStepRows = (report, context = {}) => {
  const summary = getReportSummary(report);
  const steps = Array.isArray(report.steps) ? report.steps : [];

  return steps.map((step, index) => ({
    commit: context.commit ?? "",
    artifactVersion: summary.artifactVersion,
    generatedAt: summary.generatedAt,
    mode: summary.mode,
    fixtureVersion: summary.fixtureVersion,
    scenarioTitle: summary.scenarioTitle,
    stepIndex: index + 1,
    stepId: step.stepId ?? step.step ?? `step-${index + 1}`,
    step: step.step ?? "",
    latencyMs: Number(step.latencyMs ?? 0),
    checks: Array.isArray(step.checks) ? step.checks.length : 0,
    involvedDids: Array.isArray(step.involvedDids)
      ? step.involvedDids.length
      : 0,
    requestHash: step.requestHash ?? "",
    responseHash: step.responseHash ?? "",
  }));
};

export const getSlowestStep = (report) => {
  const rows = getStepRows(report);
  return rows.reduce(
    (slowest, row) => (row.latencyMs > slowest.latencyMs ? row : slowest),
    {
      stepId: "none",
      step: "none",
      latencyMs: 0,
    },
  );
};

export const csvEscape = (value) => {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
};

export const toCsv = (rows) => {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
};

export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const markdownTable = (headers, rows) => {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${row.map((cell) => String(cell ?? "").replaceAll("|", "\\|")).join(" | ")} |`,
  );
  return [headerLine, separator, ...body].join("\n");
};

export const getUniversityFlowSamples = (report, limit = 10) => {
  const steps = Array.isArray(report.steps) ? report.steps : [];
  const findResponse = (name) =>
    steps.find((step) => step.step === name)?.response ?? {};

  const issue = findResponse("Issue diploma VC across batches");
  const presentations = findResponse("Student-to-verifier presentation requests");
  const discounts = findResponse("Student-to-mall discount presentations");

  return {
    issue: (issue.issuedRequests ?? []).slice(0, limit),
    presentations: (presentations.presentationResults ?? []).slice(0, limit),
    discounts: (discounts.discountRequests ?? []).slice(0, limit),
  };
};

export const shortHash = (value) => String(value ?? "").slice(0, 12);

