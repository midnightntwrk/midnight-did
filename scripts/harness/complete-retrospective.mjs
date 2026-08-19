#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function usage() {
  return "Usage: complete-retrospective.mjs --record <docs/retrospectives/file.md> --repo <owner/name> --issue <number> --pr <number> --head-sha <sha> [--repo-root <path>]\n";
}

function positiveInt(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function parseArgs(argv) {
  const options = { repoRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") return { help: true };
    const value = argv[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`${arg} requires a value`);
    if (arg === "--record") options.record = value;
    else if (arg === "--repo") options.repo = value;
    else if (arg === "--issue") options.issue = positiveInt(value, "--issue");
    else if (arg === "--pr") options.pr = positiveInt(value, "--pr");
    else if (arg === "--head-sha") options.headSha = value;
    else if (arg === "--repo-root") options.repoRoot = path.resolve(value);
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!options.record) throw new Error("--record is required");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo ?? ""))
    throw new Error("--repo must be owner/name");
  if (!options.issue) throw new Error("--issue is required");
  if (!options.pr) throw new Error("--pr is required");
  if (!/^[0-9a-f]{7,64}$/i.test(options.headSha ?? ""))
    throw new Error("--head-sha must be a git SHA");
  return options;
}

function resolveRecord(repoRoot, record) {
  const normalized = record.split(path.sep).join("/");
  if (
    path.isAbsolute(record) ||
    !normalized.startsWith("docs/retrospectives/") ||
    normalized.includes("../")
  ) {
    throw new Error(
      "--record must be a repository-relative path under docs/retrospectives/",
    );
  }
  const recordPath = path.resolve(repoRoot, record);
  const expectedRoot = `${path.resolve(repoRoot, "docs", "retrospectives")}${path.sep}`;
  if (!recordPath.startsWith(expectedRoot))
    throw new Error("retrospective record escapes docs/retrospectives/");
  return { normalized, recordPath };
}

function exactIssuePattern(repo, issue) {
  const escapedRepo = repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:https://github\\.com/${escapedRepo}/issues/|#)${issue}(?!\\d)`,
  );
}

async function requireTrackedRecord(repoRoot, record) {
  try {
    await execFileAsync("git", ["ls-files", "--error-unmatch", "--", record], {
      cwd: repoRoot,
    });
  } catch {
    throw new Error(`retrospective record is not Git-tracked: ${record}`);
  }
}

export async function completeRetrospective({
  repoRoot,
  record,
  repo,
  issue,
  pr,
  headSha,
  now = new Date(),
}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? ""))
    throw new Error("repo must be owner/name");
  if (!Number.isInteger(issue) || issue < 1)
    throw new Error("issue must be a positive integer");
  if (!Number.isInteger(pr) || pr < 1)
    throw new Error("pr must be a positive integer");
  if (!/^[0-9a-f]{7,64}$/i.test(headSha ?? ""))
    throw new Error("headSha must be a git SHA");
  const { normalized, recordPath } = resolveRecord(repoRoot, record);
  const content = await readFile(recordPath, "utf8");
  if (content.trim().length < 80)
    throw new Error(`retrospective record is missing or too short: ${record}`);
  if (!exactIssuePattern(repo, issue).test(content))
    throw new Error(
      `retrospective record is not bound to exact issue #${issue}: ${record}`,
    );
  await requireTrackedRecord(repoRoot, normalized);
  const recordSha256 = createHash("sha256").update(content).digest("hex");
  const checkpoint = {
    state: "complete",
    completedAt: now.toISOString(),
    artifact: { kind: "pr", repo, issue, number: pr, headSha },
    record: normalized,
    recordSha256,
    notes: `Tracked retrospective: ${normalized}`,
  };
  const checkpointPath = path.join(
    repoRoot,
    ".pi",
    "dev-loop-retrospective-checkpoint.json",
  );
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  await writeFile(
    checkpointPath,
    `${JSON.stringify(checkpoint, null, 2)}\n`,
    "utf8",
  );
  return { ok: true, record: normalized, checkpointPath, checkpoint };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const result = await completeRetrospective(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain)
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ ok: false, error: error.message })}\n`,
    );
    process.exitCode = 1;
  });
