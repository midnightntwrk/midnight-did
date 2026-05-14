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
  const totalDone = lines.filter((line) => isDoneLine(line)).length;
  const totalItems = lines.filter((line) => /^\d+\./.test(line)).length;

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
