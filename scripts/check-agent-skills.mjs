#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function skillFiles(root, relative = "") {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const entryRelative = path.join(relative, entry.name);
    if (entry.isDirectory())
      files.push(...(await skillFiles(root, entryRelative)));
    else if (
      (entry.isFile() || entry.isSymbolicLink()) &&
      entry.name === "SKILL.md"
    )
      files.push(entryRelative);
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

export async function checkAgentSkills(repositoryRoot) {
  const codexRoot = path.join(repositoryRoot, ".codex", "skills");
  const claudeRoot = path.join(repositoryRoot, ".claude", "skills");
  const [codex, claude] = await Promise.all([
    listSkillFiles(codexRoot),
    listSkillFiles(claudeRoot),
  ]);
  const allFiles = [...new Set([...codex.files, ...claude.files])].sort();
  const mismatches = [];
  if (codex.missing) mismatches.push(".codex/skills: directory is missing");
  if (claude.missing) mismatches.push(".claude/skills: directory is missing");
  for (const relative of allFiles) {
    let codexContent;
    let claudeContent;
    try {
      codexContent = await readFile(path.join(codexRoot, relative), "utf8");
    } catch {
      mismatches.push(`${relative}: missing from .codex/skills`);
      continue;
    }
    try {
      claudeContent = await readFile(path.join(claudeRoot, relative), "utf8");
    } catch {
      mismatches.push(`${relative}: missing from .claude/skills`);
      continue;
    }
    if (codexContent !== claudeContent)
      mismatches.push(`${relative}: Codex and Claude copies differ`);
  }
  return { ok: mismatches.length === 0, files: allFiles, mismatches };
}

function parseArgs(argv) {
  let repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") return { help: true };
    const value = argv[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`${arg} requires a value`);
    if (arg === "--repo-root") repositoryRoot = path.resolve(value);
    else throw new Error(`unknown option: ${arg}`);
  }
  return { repositoryRoot };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "Usage: check-agent-skills.mjs [--repo-root <path>]\n",
    );
    return;
  }
  const result = await checkAgentSkills(options.repositoryRoot);
  if (!result.ok) {
    process.stderr.write("Repository agent skill copies are out of sync:\n");
    for (const mismatch of result.mismatches)
      process.stderr.write(`- ${mismatch}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Agent skill copies synchronized (${result.files.length} files).\n`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
