#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedWorkspaces,
  githubPackageRegistry,
  packageManifestCatalog,
  repositoryUrl,
} from "./did-workspace-catalog.mjs";

const scriptRepoRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);
const repoRoot = process.env.DID_WORKSPACE_MANIFEST_REPO_ROOT
  ? path.resolve(process.env.DID_WORKSPACE_MANIFEST_REPO_ROOT)
  : scriptRepoRoot;

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

const rootPackage = readJson("package.json");

const errors = [];
const ignoredSourceDirectoryNames = new Set([
  "dist",
  "managed",
  "node_modules",
  "test",
]);
const builtinModuleNames = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);
const sourceImportPatterns = [
  /\bfrom\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bexport\s+\*\s+from\s+["']([^"']+)["']/g,
];

const assertEqual = (label, actual, expected) => {
  if (actual !== expected) {
    errors.push(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
};

const assertArrayEqual = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
};

const assertFileExists = (label, relativePath) => {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    errors.push(`${label}: missing ${relativePath}`);
  }
};

const walkTypeScriptSources = (directory) => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return ignoredSourceDirectoryNames.has(entry.name)
          ? []
          : walkTypeScriptSources(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    })
    .sort();
};

const packageNameFromSpecifier = (specifier) => {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    builtinModuleNames.has(specifier)
  ) {
    return undefined;
  }

  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }

  return specifier.split("/")[0];
};

const packageSourceImports = (workspace) => {
  const sourceRoot = path.join(repoRoot, workspace, "src");
  const packageNames = new Set();

  for (const sourceFile of walkTypeScriptSources(sourceRoot)) {
    const source = fs.readFileSync(sourceFile, "utf8");
    for (const pattern of sourceImportPatterns) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const packageName = packageNameFromSpecifier(match[1]);
        if (packageName) {
          packageNames.add(packageName);
        }
      }
    }
  }

  return [...packageNames].sort();
};

assertArrayEqual("root workspaces", rootPackage.workspaces, expectedWorkspaces);

for (const workspace of expectedWorkspaces) {
  assertFileExists(
    `${workspace} package`,
    path.join(workspace, "package.json"),
  );
}

for (const [workspace, expected] of packageManifestCatalog.entries()) {
  const packageJson = readJson(path.join(workspace, "package.json"));
  const label = `${workspace}/package.json`;

  assertEqual(`${label} name`, packageJson.name, expected.name);
  assertEqual(`${label} version`, packageJson.version, rootPackage.version);
  assertEqual(`${label} license`, packageJson.license, "Apache-2.0");
  if (packageJson.private === true) {
    errors.push(`${label} must be publishable and must not set private=true`);
  }
  assertEqual(`${label} type`, packageJson.type, "module");
  assertEqual(`${label} repository.type`, packageJson.repository?.type, "git");
  assertEqual(
    `${label} repository.url`,
    packageJson.repository?.url,
    repositoryUrl,
  );
  assertEqual(
    `${label} repository.directory`,
    packageJson.repository?.directory,
    workspace,
  );
  assertEqual(
    `${label} publishConfig.registry`,
    packageJson.publishConfig?.registry,
    githubPackageRegistry,
  );
  assertEqual(`${label} engines.node`, packageJson.engines?.node, ">=24");
  assertEqual(`${label} engines.pnpm`, packageJson.engines?.pnpm, ">=10");
  assertEqual(`${label} main`, packageJson.main, "dist/index.js");
  assertEqual(`${label} module`, packageJson.module, "dist/index.js");
  assertEqual(`${label} types`, packageJson.types, "./dist/index.d.ts");
  assertArrayEqual(`${label} files`, packageJson.files, expected.files);
  assertArrayEqual(
    `${label} export keys`,
    Object.keys(packageJson.exports ?? {}),
    expected.exports,
  );
  assertFileExists(`${workspace} README`, path.join(workspace, "README.md"));

  const declaredDependencies = new Set(
    Object.keys(packageJson.dependencies ?? {}),
  );
  for (const packageName of packageSourceImports(workspace)) {
    if (!declaredDependencies.has(packageName)) {
      errors.push(
        `${label} dependency ${packageName}: source import must be declared in dependencies`,
      );
    }
  }

  for (const exportKey of expected.exports) {
    const exportEntry = packageJson.exports?.[exportKey];
    if (!exportEntry || typeof exportEntry !== "object") {
      // DID packages use object exports so types/import/default targets can be
      // checked independently; string shorthand exports are valid package
      // the convention for this repository.
      errors.push(`${label} export ${exportKey}: missing object export entry`);
      continue;
    }

    if (!String(exportEntry.types ?? "").startsWith("./dist/")) {
      errors.push(`${label} export ${exportKey}: types must point into ./dist`);
    }
    if (
      Object.hasOwn(exportEntry, "require") &&
      !String(exportEntry.require ?? "").startsWith("./dist/")
    ) {
      errors.push(
        `${label} export ${exportKey}: require must point into ./dist`,
      );
    }
    if (!String(exportEntry.import ?? "").startsWith("./dist/")) {
      errors.push(
        `${label} export ${exportKey}: import must point into ./dist`,
      );
    }
    if (!String(exportEntry.default ?? "").startsWith("./dist/")) {
      errors.push(
        `${label} export ${exportKey}: default must point into ./dist`,
      );
    }
  }
}

const docsSitePackage = readJson("docs-site/package.json");
assertEqual("docs-site/package.json name", docsSitePackage.name, "docs-site");
assertEqual("docs-site/package.json private", docsSitePackage.private, true);
assertEqual("docs-site/package.json type", docsSitePackage.type, "module");

if (errors.length > 0) {
  console.error("[check-workspace-manifests] DID workspace manifest drift:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  "[check-workspace-manifests] DID workspace package manifests are aligned.",
);
