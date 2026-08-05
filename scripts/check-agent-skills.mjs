#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const codexRoot = path.join(repositoryRoot, ".codex", "skills");
const claudeRoot = path.join(repositoryRoot, ".claude", "skills");

async function skillFiles(root, relative = "") {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const entryRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await skillFiles(root, entryRelative)));
    } else if (entry.name === "SKILL.md") {
      files.push(entryRelative);
    }
  }

  return files;
}

const [codexFiles, claudeFiles] = await Promise.all([
  skillFiles(codexRoot),
  skillFiles(claudeRoot),
]);
const allFiles = [...new Set([...codexFiles, ...claudeFiles])].sort();
const mismatches = [];

for (const relative of allFiles) {
  const codexPath = path.join(codexRoot, relative);
  const claudePath = path.join(claudeRoot, relative);
  let codexContent;
  let claudeContent;

  try {
    codexContent = await readFile(codexPath, "utf8");
  } catch {
    mismatches.push(`${relative}: missing from .codex/skills`);
    continue;
  }

  try {
    claudeContent = await readFile(claudePath, "utf8");
  } catch {
    mismatches.push(`${relative}: missing from .claude/skills`);
    continue;
  }

  if (codexContent !== claudeContent) {
    mismatches.push(`${relative}: Codex and Claude copies differ`);
  }
}

if (mismatches.length > 0) {
  console.error("Repository agent skill copies are out of sync:");
  for (const mismatch of mismatches) console.error(`- ${mismatch}`);
  process.exit(1);
}

console.log(`Agent skill copies synchronized (${allFiles.length} files).`);
