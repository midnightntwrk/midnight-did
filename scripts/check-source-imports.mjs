#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const defaultSourceRoots = [
  "packages/jubjub-schnorr/src",
  "packages/contract/src",
  "packages/domain/src",
  "packages/did/src",
  "packages/api/src",
];
const sourceRoots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultSourceRoots;
const allowedExtensions = [".js", ".json"];
const ignoredDirectoryNames = new Set(["managed", "dist", "node_modules"]);

const walk = (dir) => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return ignoredDirectoryNames.has(entry.name) ? [] : walk(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    })
    .sort();
};

// Regex parsing is intentionally lightweight for source discipline checks. If a
// future source comment or string literal looks like an import statement and
// trips this guard, either rephrase the text or promote this script to the
// TypeScript compiler API.
const importPatterns = [
  /\bfrom\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bexport\s+\*\s+from\s+["']([^"']+)["']/g,
  /\bvi\.mock\s*\(\s*["']([^"']+)["']/g,
];

const isRelativeSpecifier = (specifier) =>
  specifier === "." ||
  specifier === ".." ||
  specifier.startsWith("./") ||
  specifier.startsWith("../");

const hasAllowedExtension = (specifier) =>
  allowedExtensions.some((extension) => specifier.endsWith(extension));

const violations = [];

const resolveSourceRoot = (sourceRoot) =>
  path.isAbsolute(sourceRoot) ? sourceRoot : path.join(repoRoot, sourceRoot);

for (const sourceRoot of sourceRoots) {
  for (const file of walk(resolveSourceRoot(sourceRoot))) {
    const text = fs.readFileSync(file, "utf8");
    const relativeFile = path.relative(repoRoot, file);

    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;

      for (const match of text.matchAll(pattern)) {
        const specifier = match[1];
        if (!isRelativeSpecifier(specifier) || hasAllowedExtension(specifier)) {
          continue;
        }

        violations.push(`${relativeFile}: relative import "${specifier}" must include .js or .json`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("DID source import discipline failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("DID source import discipline passed");
