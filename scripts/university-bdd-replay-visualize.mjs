#!/usr/bin/env node
import process from "node:process";

import {
  DEFAULT_UNIVERSITY_BDD_REPLAY,
  DEFAULT_UNIVERSITY_BDD_REPORT,
  escapeHtml,
  getReportSummary,
  getUniversityFlowSamples,
  parsePositiveInteger,
  readJsonFile,
  shortHash,
  writeOutput,
} from "./university-bdd-artifact-utils.mjs";

const USAGE = `Usage:
  node scripts/university-bdd-replay-visualize.mjs [options]

Options:
  --report <path>        University BDD report JSON path (default: ${DEFAULT_UNIVERSITY_BDD_REPORT})
  --replay <path>        University BDD replay JSON path (default: ${DEFAULT_UNIVERSITY_BDD_REPLAY})
  --format <html|mermaid|markdown> Output format (default: html)
  --limit <count>        Maximum flow samples per exchange type (default: 10)
  --out <path>           Write output to file instead of stdout
  --help                 Show usage`;

const parseArgs = () => {
  const options = {
    reportPath: DEFAULT_UNIVERSITY_BDD_REPORT,
    replayPath: DEFAULT_UNIVERSITY_BDD_REPLAY,
    format: "html",
    limit: 10,
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
    if (arg === "--replay") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--replay requires a path");
      }
      options.replayPath = value;
      index += 1;
      continue;
    }
    if (arg === "--format") {
      if (value !== "html" && value !== "mermaid" && value !== "markdown") {
        throw new Error("--format must be html, mermaid, or markdown");
      }
      options.format = value;
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      if (value == null || value.startsWith("--")) {
        throw new Error("--limit requires a value");
      }
      options.limit = parsePositiveInteger(value, "--limit");
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

const mermaidText = (value) =>
  String(value ?? "")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .replaceAll(";", ",")
    .replaceAll(":", " -")
    .replace(/\s+/g, " ")
    .trim();

const actorAlias = (prefix, index) => `${prefix}${String(index).padStart(2, "0")}`;

const buildMermaid = (report, replay, limit) => {
  const samples = getUniversityFlowSamples(report, limit);
  const lines = [
    "sequenceDiagram",
    "  autonumber",
    "  participant University as University issuer DID",
    "  participant Mall as Mall verifier DID",
  ];
  const companyAliases = new Map();
  const studentAliases = new Map();

  const ensureStudent = (studentId, label) => {
    if (!studentAliases.has(studentId)) {
      const alias = actorAlias("S", studentAliases.size + 1);
      studentAliases.set(studentId, alias);
      lines.push(`  participant ${alias} as ${mermaidText(label)}`);
    }
    return studentAliases.get(studentId);
  };

  const ensureCompany = (did, label) => {
    if (!companyAliases.has(did)) {
      const alias = actorAlias("C", companyAliases.size + 1);
      companyAliases.set(did, alias);
      lines.push(`  participant ${alias} as ${mermaidText(label)}`);
    }
    return companyAliases.get(did);
  };

  for (const item of samples.issue) {
    const student = item.request?.student ?? {};
    const studentId = item.studentId ?? item.request?.studentId;
    const alias = ensureStudent(
      studentId,
      `${student.fullName ?? studentId} (${student.did ?? item.request?.studentDid})`,
    );
    const credentialId = item.response?.credential?.id ?? "no credential";
    lines.push(
      `  ${alias}->>University: issueDiploma(${mermaidText(studentId)}, ${mermaidText(item.request?.requestReference)})`,
    );
    lines.push(
      `  University-->>${alias}: ${item.response?.issued ? "issued" : "rejected"} ${mermaidText(credentialId)}`,
    );
  }

  for (const item of samples.presentations) {
    const student = item.student ?? {};
    const studentId = item.studentId ?? item.student?.studentId;
    const studentAlias = ensureStudent(
      studentId,
      `${student.fullName ?? studentId} (${student.did ?? item.studentDid})`,
    );
    const companyAlias = ensureCompany(item.verifierDid, item.verifierDid);
    lines.push(
      `  ${studentAlias}->>${companyAlias}: presentProof(${mermaidText(item.presentationId)}, credential ${mermaidText(item.credentialId)})`,
    );
    lines.push(
      `  ${companyAlias}-->>${studentAlias}: ${item.response?.accepted ? "accepted" : "rejected"} (${mermaidText(item.response?.issuerCheck)})`,
    );
  }

  for (const item of samples.discounts) {
    const student = item.student ?? {};
    const studentId = item.studentId ?? item.student?.studentId;
    const studentAlias = ensureStudent(
      studentId,
      `${student.fullName ?? studentId} (${student.did ?? item.studentDid})`,
    );
    lines.push(
      `  ${studentAlias}->>Mall: requestDiscount(${mermaidText(item.offerId)}, grade ${item.grade})`,
    );
    lines.push(
      `  Mall-->>${studentAlias}: ${item.response?.accepted ? "accepted" : "declined"} (${item.couponPercent ?? 0} percent)`,
    );
  }

  const replaySteps = Array.isArray(replay.steps) ? replay.steps : [];
  for (const step of replaySteps) {
    lines.push(
      `  Note over University,Mall: ${mermaidText(step.stepId)} request=${shortHash(step.requestHash)} response=${shortHash(step.responseHash)} latency=${step.latencyMs ?? 0}ms`,
    );
  }

  return lines.join("\n");
};

const buildHtml = (summary, mermaid, replay) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(summary.scenarioTitle)} replay</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; color: #15202b; }
    main { max-width: 1180px; margin: 0 auto; }
    header { border-bottom: 1px solid #d8dee4; margin-bottom: 1.5rem; padding-bottom: 1rem; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1rem; }
    dt { font-weight: 700; }
    pre { background: #f6f8fa; border: 1px solid #d8dee4; padding: 1rem; overflow: auto; }
    .mermaid { margin-top: 1rem; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(summary.scenarioTitle)}</h1>
      <dl>
        <dt>Artifact</dt><dd>${escapeHtml(summary.artifactVersion)}</dd>
        <dt>Mode</dt><dd>${escapeHtml(summary.mode)}</dd>
        <dt>Issued</dt><dd>${summary.issuedCount}</dd>
        <dt>Applications</dt><dd>${summary.approvedApplications}/${summary.applicationCount} approved</dd>
        <dt>Discounts</dt><dd>${summary.approvedDiscounts}/${summary.discountCount} approved</dd>
        <dt>Replay steps</dt><dd>${Array.isArray(replay.steps) ? replay.steps.length : 0}</dd>
      </dl>
    </header>
    <section class="mermaid">
${escapeHtml(mermaid)}
    </section>
    <h2>Mermaid Source</h2>
    <pre>${escapeHtml(mermaid)}</pre>
  </main>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true, securityLevel: "strict" });
  </script>
</body>
</html>`;

const main = () => {
  const options = parseArgs();
  const report = readJsonFile(options.reportPath, "University BDD report");
  const replay = readJsonFile(options.replayPath, "University BDD replay");
  const summary = getReportSummary(report);
  const mermaid = buildMermaid(report, replay, options.limit);

  const output =
    options.format === "html"
      ? buildHtml(summary, mermaid, replay)
      : options.format === "markdown"
        ? ["# University BDD Replay", "", "```mermaid", mermaid, "```"].join("\n")
        : mermaid;

  writeOutput(options.out, output);
};

main();

