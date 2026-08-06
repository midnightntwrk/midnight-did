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
    } else if (
      (entry.isFile() || entry.isSymbolicLink()) &&
      entry.name === "SKILL.md"
    ) {
      // Supporting files may be harness-specific (for example Codex agent
      // metadata), so only the portable skill contract must match.
      files.push(entryRelative);
    }
  }

  return files;
}

async function listSkillFiles(root) {
  try {
    return { files: await skillFiles(root), missing: false };
  } catch (error) {
    if (error?.code === "ENOENT") return { files: [], missing: true };
    throw error;
  }
}

const [codex, claude] = await Promise.all([
  listSkillFiles(codexRoot),
  listSkillFiles(claudeRoot),
]);
const allFiles = [...new Set([...codex.files, ...claude.files])].sort();
const mismatches = [];

if (codex.missing) mismatches.push(".codex/skills: directory is missing");
if (claude.missing) mismatches.push(".claude/skills: directory is missing");

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
