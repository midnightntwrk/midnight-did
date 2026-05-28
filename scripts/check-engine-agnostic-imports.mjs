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
  "packages/api/src/browser.ts",
  "packages/api/src/domain-to-runtime.ts",
  "packages/api/src/lightweight.ts",
  "packages/api/src/network-mapping.ts",
  "packages/api/src/runtime-to-domain.ts",
  "packages/api/src/seed.ts",
];
const sourceRoots =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultSourceRoots;
const ignoredDirectoryNames = new Set(["dist", "managed", "node_modules", "test"]);

const staticDeclarationPattern = /^\s*(?:import|export)\b[\s\S]*?;/gm;
const bareNodeImportPattern = /^\s*import\s+["'](node:[^"']+)["']/m;
const nodeFromPattern = /\bfrom\s+["'](node:[^"']+)["']/;

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

const resolveSourceRoot = (sourceRoot) =>
  path.isAbsolute(sourceRoot) ? sourceRoot : path.join(repoRoot, sourceRoot);

const collectSourceFiles = (sourceRoot) => {
  if (!fs.existsSync(sourceRoot)) {
    return [];
  }

  const stat = fs.statSync(sourceRoot);
  if (stat.isFile()) {
    return sourceRoot.endsWith(".ts") ? [sourceRoot] : [];
  }
  if (stat.isDirectory()) {
    return walk(sourceRoot);
  }
  return [];
};

const violations = [];

for (const sourceRoot of sourceRoots) {
  for (const file of collectSourceFiles(resolveSourceRoot(sourceRoot))) {
    const text = fs.readFileSync(file, "utf8");
    const relativeFile = path.relative(repoRoot, file);

    for (const declarationMatch of text.matchAll(staticDeclarationPattern)) {
      const declaration = declarationMatch[0];
      for (const pattern of [bareNodeImportPattern, nodeFromPattern]) {
        const match = declaration.match(pattern);
        if (!match) {
          continue;
        }
        violations.push(
          `${relativeFile}: static ${match[1]} import makes the package entry graph Node-only`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("DID engine-agnostic import guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("DID engine-agnostic import guard passed");
