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
  ".midnight-db",
  ".midnight-test",
  ".npm-cache",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "midnight-level-db",
  "playwright-report",
  "reports",
  "target",
  "test-results",
]);
const generatedRelativeDirectories = new Set([
  "logs",
  "docs-site/.vitepress/.temp",
  "docs-site/.vitepress/cache",
  "docs-site/.vitepress/dist",
  "docs-site/api/reference",
  "docs-site/source",
]);
const trackedFiles = new Set(
  execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split(/\r?\n/u)
    .filter(Boolean),
);
const trackedPaths = new Set();
for (const file of trackedFiles) {
  trackedPaths.add(file);

  let directory = path.posix.dirname(file);
  while (directory !== ".") {
    trackedPaths.add(directory);
    directory = path.posix.dirname(directory);
  }
}
const removed = new Set();
const missing = [];
const skippedTracked = new Set();
const skippedDeadShells = new Set();
const classifiedTopLevelShells = new Set();

const historicalTopLevelShells = new Set([
  "api",
  "cli",
  "contract",
  "credentials",
  "credentials-birth",
  "credentials-birth-secret",
  "credentials-demo-contract",
  "credentials-iso-registry",
  "credentials-openid",
  "credentials-protocol",
  "credentials-same-holder",
  "did",
  "did-manager-service",
  "did-resolver-service",
  "domain",
  "jubjub-schnorr",
  "secret-storage",
]);
const disposableShellDirectoryNames = new Set([
  ...generatedDirectoryNames,
  "managed",
  "node_modules",
]);

const toRelative = (absolutePath) =>
  path.relative(repoRoot, absolutePath).split(path.sep).join("/");

const containsTrackedFile = (relativePath) => trackedPaths.has(relativePath);

const isDisposableDeadShell = (absolutePath) => {
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const entryPath = path.join(absolutePath, entry.name);

    if (entry.isSymbolicLink()) {
      return false;
    }

    if (entry.isDirectory()) {
      if (disposableShellDirectoryNames.has(entry.name)) {
        continue;
      }

      if (entry.name === "src" && isDisposableDeadShell(entryPath)) {
        continue;
      }

      return false;
    }

    if (
      entry.isFile() &&
      (entry.name === ".DS_Store" ||
        entry.name.endsWith(".log") ||
        entry.name.endsWith(".tgz") ||
        entry.name.endsWith(".tsbuildinfo"))
    ) {
      continue;
    }

    return false;
  }

  return true;
};

const removePath = (absolutePath) => {
  const relativePath = toRelative(absolutePath);

  if (containsTrackedFile(relativePath)) {
    skippedTracked.add(relativePath);
    return;
  }

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

      if (
        directory === repoRoot &&
        classifiedTopLevelShells.has(toRelative(absolutePath))
      ) {
        continue;
      }

      if (isGeneratedDirectory(absolutePath, entry.name)) {
        removePath(absolutePath);
        continue;
      }

      walk(absolutePath);
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith(".tsbuildinfo") || entry.name.endsWith(".tgz"))
    ) {
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

for (const relativePath of historicalTopLevelShells) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    if (statSync(absolutePath).isDirectory()) {
      classifiedTopLevelShells.add(relativePath);
      if (containsTrackedFile(relativePath)) {
        skippedTracked.add(relativePath);
      } else if (!isDisposableDeadShell(absolutePath)) {
        skippedDeadShells.add(relativePath);
      } else {
        removePath(absolutePath);
      }
    }
  } catch {
    // Missing historical package/service shells do not need cleanup.
  }
}

walk(repoRoot);

const removedPaths = [...removed].sort();
const skippedTrackedPaths = [...skippedTracked].sort();
const skippedDeadShellPaths = [...skippedDeadShells].sort();

if (json) {
  console.log(
    JSON.stringify(
      {
        dryRun,
        removed: removedPaths,
        missing,
        skippedTracked: skippedTrackedPaths,
        skippedDeadShells: skippedDeadShellPaths,
      },
      null,
      2,
    ),
  );
} else if (
  removedPaths.length === 0 &&
  skippedTrackedPaths.length === 0 &&
  skippedDeadShellPaths.length === 0
) {
  console.log("[clean-artifacts] No generated artifacts found.");
} else {
  if (removedPaths.length > 0) {
    const action = dryRun ? "Would remove" : "Removed";
    console.log(
      `[clean-artifacts] ${action} ${removedPaths.length} generated artifact paths:`,
    );
    for (const relativePath of removedPaths) {
      console.log(`  ${relativePath}`);
    }
  }

  if (skippedTrackedPaths.length > 0) {
    console.log("[clean-artifacts] Skipped tracked artifact paths:");
    for (const relativePath of skippedTrackedPaths) {
      console.log(`  ${relativePath}`);
    }
  }

  if (skippedDeadShellPaths.length > 0) {
    console.log(
      "[clean-artifacts] Skipped non-disposable historical shell candidates:",
    );
    for (const relativePath of skippedDeadShellPaths) {
      console.log(`  ${relativePath}`);
    }
  }
}
