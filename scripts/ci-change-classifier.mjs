#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { argv, cwd, env, stdout } from "node:process";

const normalizePath = (filePath) => filePath.replaceAll("\\", "/").replace(/^\.\/+/u, "");

export const isDocsOnlyPath = (filePath) => {
  const normalized = normalizePath(filePath);

  if (!normalized) return false;

  return (
    normalized.endsWith(".md") ||
    normalized.startsWith("docs/") ||
    normalized.startsWith("docs-site/") ||
    normalized.startsWith("w3c-spec/")
  );
};

export const isCodeImpactingPath = (filePath) => {
  const normalized = normalizePath(filePath);

  if (!normalized || isDocsOnlyPath(normalized)) return false;

  if (
    normalized === "CODEOWNERS" ||
    normalized === "renovate.json" ||
    normalized.startsWith(".github/") ||
    normalized.startsWith(".claude/") ||
    normalized.startsWith(".codex/") ||
    normalized.startsWith(".obsidian/")
  ) {
    return false;
  }

  if (
    normalized === ".nvmrc" ||
    normalized === "flake.lock" ||
    normalized === "flake.nix" ||
    normalized === "package.json" ||
    normalized === "pnpm-lock.yaml" ||
    normalized === "pnpm-workspace.yaml" ||
    normalized === "tsconfig.json" ||
    normalized === "turbo.json"
  ) {
    return true;
  }

  return (
    normalized.endsWith(".sh") ||
    normalized.startsWith("nix/") ||
    normalized.startsWith("packages/") ||
    normalized.startsWith("proof-server-bootstrap/") ||
    normalized.startsWith("scripts/")
  );
};

export const isSnapshotReleaseRelevantPath = (filePath) => {
  const normalized = normalizePath(filePath);

  if (!normalized || isDocsOnlyPath(normalized)) return false;

  if (
    normalized.startsWith(".github/") ||
    normalized.startsWith(".claude/") ||
    normalized.startsWith(".codex/") ||
    normalized.startsWith(".obsidian/")
  ) {
    return false;
  }

  if (
    normalized === "package.json" ||
    normalized === "pnpm-lock.yaml" ||
    normalized === "pnpm-workspace.yaml" ||
    normalized === "renovate.json" ||
    normalized === "package-lock.json"
  ) {
    return false;
  }

  if (/^packages\/.*\.(?:ts|tsx|mts|cts|js|mjs|cjs|compact)$/u.test(normalized)) {
    return true;
  }

  if (/^scripts\/.*\.(?:sh|js|mjs|cjs)$/u.test(normalized)) {
    return true;
  }

  return /^run(?:-[a-z0-9-]+)?\.sh$/u.test(normalized);
};

export const classifyChangedFiles = (files) => {
  const changedFiles = [...new Set(files.map(normalizePath).filter(Boolean))].sort();
  const codeChanged = changedFiles.some(isCodeImpactingPath);
  const docsOnly = changedFiles.length > 0 && changedFiles.every(isDocsOnlyPath);
  const hasDocsChanges = changedFiles.some(isDocsOnlyPath);
  const snapshotReleaseRelevant = changedFiles.some(isSnapshotReleaseRelevantPath);

  return {
    changedFiles,
    changedFileCount: changedFiles.length,
    codeChanged,
    docsOnly,
    hasDocsChanges,
    snapshotReleaseRelevant,
  };
};

export const diffRangeForChangedFiles = ({
  base,
  head,
  hasBaseCommit = true,
  hasHeadCommit = true,
  hasMergeBase,
}) => {
  if (!hasBaseCommit || !hasHeadCommit) return "";

  return hasMergeBase ? `${base}...${head}` : `${base}..${head}`;
};

const readChangedFiles = ({ base, head }) => {
  if (!base || !head || /^0+$/u.test(base) || /^0+$/u.test(head)) {
    return [];
  }

  // Three-dot diff matches the pull-request change set while remaining safe
  // for push events, where the merge base is normally the previous commit.
  const diffRange = diffRangeForChangedFiles({
    base,
    head,
    hasBaseCommit: hasCommit(base),
    hasHeadCommit: hasCommit(head),
    hasMergeBase: hasMergeBase(base, head),
  });
  if (!diffRange) return [];

  const output = execFileSync("git", ["diff", "--name-only", diffRange], {
    cwd: cwd(),
    encoding: "utf8",
  });

  return output.split(/\r?\n/u).filter(Boolean);
};

const hasCommit = (ref) => {
  try {
    execFileSync("git", ["cat-file", "-e", `${ref}^{commit}`], {
      cwd: cwd(),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

const hasMergeBase = (base, head) => {
  try {
    execFileSync("git", ["merge-base", base, head], {
      cwd: cwd(),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

const parseArgs = (args) => {
  const parsed = {
    base: env.BASE_SHA ?? "",
    head: env.HEAD_SHA ?? "",
    output: env.GITHUB_OUTPUT ?? "",
    json: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--base":
        parsed.base = args[++i] ?? "";
        break;
      case "--head":
        parsed.head = args[++i] ?? "";
        break;
      case "--output":
        parsed.output = args[++i] ?? "";
        break;
      case "--json":
        parsed.json = true;
        break;
      default:
        throw new Error(`Unknown ci-change-classifier argument: ${arg}`);
    }
  }

  return parsed;
};

const writeGitHubOutputs = (outputPath, classification) => {
  if (!outputPath) return;

  appendFileSync(
    outputPath,
    [
      `docs_only=${classification.docsOnly ? "true" : "false"}`,
      `has_docs_changes=${classification.hasDocsChanges ? "true" : "false"}`,
      `code_changed=${classification.codeChanged ? "true" : "false"}`,
      `snapshot_release_relevant=${classification.snapshotReleaseRelevant ? "true" : "false"}`,
      `changed_file_count=${classification.changedFileCount}`,
      "",
    ].join("\n"),
    "utf8",
  );
};

const isDirectExecution = argv[1]?.endsWith("ci-change-classifier.mjs");

if (isDirectExecution) {
  const options = parseArgs(argv.slice(2));
  const classification = classifyChangedFiles(readChangedFiles(options));

  writeGitHubOutputs(options.output, classification);

  if (options.json) {
    stdout.write(`${JSON.stringify(classification, null, 2)}\n`);
  } else {
    stdout.write(
      `docs_only=${classification.docsOnly ? "true" : "false"} ` +
        `code_changed=${classification.codeChanged ? "true" : "false"} ` +
        `snapshot_release_relevant=${classification.snapshotReleaseRelevant ? "true" : "false"} ` +
        `changed_file_count=${classification.changedFileCount}\n`,
    );
  }
}
