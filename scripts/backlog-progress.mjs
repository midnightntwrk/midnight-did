#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import process from "node:process";

const BACKLOG_PATH = "docs/repository-maturity-backlog.md";

const CHECKS = [
  {
    itemNumber: 31,
    label: "Add BDD metric guardrails for CI",
    command: "npm run test:university-bdd",
  },
  {
    itemNumber: 38,
    label: "Add BDD report diff utility for PR comments",
    command: "node --test scripts/university-bdd-diff.test.mjs",
  },
  {
    itemNumber: 55,
    label: "Add a PR-ready README snippet generator",
    command: "node scripts/repo-pr-snippet.mjs --format json",
  },
  {
    itemNumber: 56,
    label: "Add a canonical replay visualizer script",
    command: "node scripts/university-bdd-replay-visualize.mjs --format mermaid --limit 1",
  },
  {
    itemNumber: 57,
    label: "Add a smallest owner + dependencies badge in specs",
    command:
      "node -e \"const fs=require('fs'); const s=fs.readFileSync('docs/midnight-did-book-for-dummies.md','utf8'); if(!s.includes('Smallest owner and dependency badges')) process.exit(1)\"",
  },
  {
    itemNumber: 58,
    label: "Expose a machine-readable metrics index",
    command: "node scripts/university-bdd-metrics.mjs --format json",
  },
  {
    itemNumber: 59,
    label: "Add a PR summary helper for university BDD diffs",
    command: "node scripts/university-bdd-pr-summary.mjs",
  },
  {
    itemNumber: 60,
    label: "Document adapter migration path for real Midnight transport",
    command:
      "node -e \"const fs=require('fs'); if(!fs.existsSync('docs/university-bdd-transport-migration.md')) process.exit(1)\"",
  },
  {
    itemNumber: 61,
    label: "Add docs/contract cross-linking to run.sh and backlog",
    command:
      "node -e \"const {spawnSync}=require('child_process'); const r=spawnSync('./run.sh',['--help'],{encoding:'utf8'}); if(r.status!==0 || !r.stdout.includes('docs/uc-bundles/university-bdd/README.md')) process.exit(1)\"",
  },
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    apply: args.includes("--apply"),
    json: args.includes("--json"),
  };
};

const runCheck = (command) => {
  try {
    execSync(command, { stdio: "pipe" });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error.message,
      output:
        error.stdout?.toString() ??
        error.stderr?.toString() ??
        "Command failed",
    };
  }
};

const isDoneLine = (line) => /\u2705/.test(line);

const summarizeBacklog = (text, results) => {
  const lines = text.split("\n");
  const itemLines = lines.filter((line) => /^\d+\./.test(line));
  const totalDone = itemLines.filter((line) => isDoneLine(line)).length;
  const totalItems = itemLines.length;

  const checkSummary = CHECKS.map((check) => {
    const title = new RegExp(`^${check.itemNumber}\\.`, "m").test(text)
      ? `Item ${check.itemNumber}`
      : `Unresolved ${check.itemNumber}`;
    const result = results[check.itemNumber];
    return {
      itemNumber: check.itemNumber,
      title,
      ok: result?.ok ?? false,
      reason: result?.reason,
      command: check.command,
    };
  });

  return {
    totalItems,
    totalDone,
    checks: checkSummary,
  };
};

const applyAutoProgress = (text, results) => {
  const lines = text.split("\n");
  let updated = false;

  const byLineIndex = new Map();
  lines.forEach((line, index) => {
    const match = line.match(/^(\d+)\.\s*(.*)/);
    if (!match) return;
    byLineIndex.set(Number.parseInt(match[1], 10), index);
  });

  for (const check of CHECKS) {
    const index = byLineIndex.get(check.itemNumber);
    if (index == null) continue;
    const line = lines[index];
    if (isDoneLine(line)) continue;
    const checkResult = results[check.itemNumber];
    if (!checkResult?.ok) continue;

    const match = line.match(/^(\d+)\.\s*(.*)$/);
    if (match == null) continue;
    const rest = match[2].trimStart();
    lines[index] = `${match[1]}. ✅ **Done: ${rest}`;
    updated = true;
  }

  return { text: `${lines.join("\n")}\n`, updated };
};

const main = () => {
  const { apply, json } = parseArgs();
  const content = readFileSync(BACKLOG_PATH, "utf8");
  const results = {};

  for (const check of CHECKS) {
    results[check.itemNumber] = runCheck(check.command);
  }

  const summary = summarizeBacklog(content, results);

  if (apply) {
    const applied = applyAutoProgress(content, results);
    if (applied.updated) {
      writeFileSync(BACKLOG_PATH, applied.text, "utf8");
    }
  }

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `[backlog] items=${summary.totalDone}/${summary.totalItems} completed`,
    );
    for (const check of summary.checks) {
      console.log(
        `[backlog] ${check.itemNumber}: ${check.ok ? "PASS" : "FAIL"} (${check.command})`,
      );
      if (!check.ok && check.reason) {
        console.log(`  reason: ${check.reason}`);
      }
    }
  }

  const hasFailure = Object.values(results).some((entry) => !entry.ok);
  process.exitCode = hasFailure ? 1 : 0;
};

main();
