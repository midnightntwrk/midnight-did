#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "packages/api/src");
const allowedExtensions = [".js", ".json"];

const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    })
    .sort();

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

for (const file of walk(sourceRoot)) {
  const text = fs.readFileSync(file, "utf8");
  const relativeFile = path.relative(repoRoot, file);

  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (!isRelativeSpecifier(specifier)) {
        continue;
      }

      if (hasAllowedExtension(specifier)) {
        continue;
      }

      violations.push(`${relativeFile}: relative import "${specifier}" must include .js or .json`);
    }
  }
}

if (violations.length > 0) {
  console.error("API relative import discipline failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("API relative import discipline passed");
