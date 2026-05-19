#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const json = args.has("--json");
const skipDirectoryNames = new Set([".git", "node_modules"]);
const generatedDirectoryNames = new Set([
  ".npm-cache",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "playwright-report",
  "reports",
  "target",
  "test-results",
]);
const generatedRelativeDirectories = new Set([
  "docs-site/.vitepress/.temp",
  "docs-site/.vitepress/cache",
  "docs-site/.vitepress/dist",
  "docs-site/api/reference",
  "docs-site/source",
]);
const removed = new Set();
const missing = [];

const toRelative = (absolutePath) => path.relative(repoRoot, absolutePath).split(path.sep).join("/");

const removePath = (absolutePath) => {
  const relativePath = toRelative(absolutePath);
  removed.add(relativePath);

  if (!dryRun) {
    rmSync(absolutePath, { recursive: true, force: true });
  }
};

const isGeneratedDirectory = (absolutePath, direntName) => {
  const relativePath = toRelative(absolutePath);

  return (
    generatedDirectoryNames.has(direntName) ||
    generatedRelativeDirectories.has(relativePath) ||
    relativePath === "managed" ||
    relativePath.endsWith("/src/managed")
  );
};

const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      if (
        isGeneratedDirectory(absolutePath, entry.name) ||
        entry.name.endsWith(".tsbuildinfo") ||
        entry.name.endsWith(".tgz")
      ) {
        removePath(absolutePath);
      }
      continue;
    }

    if (entry.isDirectory()) {
      if (skipDirectoryNames.has(entry.name)) {
        continue;
      }

      if (isGeneratedDirectory(absolutePath, entry.name)) {
        removePath(absolutePath);
        continue;
      }

      walk(absolutePath);
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".tsbuildinfo") || entry.name.endsWith(".tgz"))) {
      removePath(absolutePath);
    }
  }
};

for (const relativePath of generatedRelativeDirectories) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    if (statSync(absolutePath).isDirectory()) {
      removePath(absolutePath);
    }
  } catch {
    missing.push(relativePath);
  }
}

walk(repoRoot);

const removedPaths = [...removed].sort();

if (json) {
  console.log(JSON.stringify({ dryRun, removed: removedPaths, missing }, null, 2));
} else if (removedPaths.length === 0) {
  console.log("[clean-artifacts] No generated artifacts found.");
} else {
  const action = dryRun ? "Would remove" : "Removed";
  console.log(`[clean-artifacts] ${action} ${removedPaths.length} generated artifact paths:`);
  for (const relativePath of removedPaths) {
    console.log(`  ${relativePath}`);
  }
}
