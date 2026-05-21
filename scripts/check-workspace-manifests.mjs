#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

const rootPackage = readJson("package.json");

const expectedWorkspaces = [
  "packages/api",
  "packages/domain",
  "packages/did",
  "packages/jubjub-schnorr",
  "packages/contract",
  "docs-site",
];

const expectedPackages = new Map([
  [
    "packages/api",
    {
      name: "@midnight-ntwrk/midnight-did-api",
      packageClass: "dist",
      files: [
        "dist/**",
        "README.md",
        "examples/**",
        "package.json",
        "tsconfig.json",
        "tsconfig.build.json",
      ],
      exports: ["."],
    },
  ],
  [
    "packages/domain",
    {
      name: "@midnight-ntwrk/midnight-did-domain",
      packageClass: "dist",
      files: [
        "dist/**",
        "README.md",
        "package.json",
        "tsconfig.json",
        "tsconfig.build.json",
      ],
      exports: [".", "./midnight"],
    },
  ],
  [
    "packages/did",
    {
      name: "@midnight-ntwrk/midnight-did",
      packageClass: "dist",
      files: [
        "dist/**",
        "README.md",
        "package.json",
        "tsconfig.json",
        "tsconfig.build.json",
      ],
      exports: ["."],
    },
  ],
  [
    "packages/jubjub-schnorr",
    {
      name: "@midnight-ntwrk/midnight-did-jubjub-schnorr",
      packageClass: "dist-with-compact-source",
      files: [
        "dist/**",
        "src/**/*.compact",
        "README.md",
        "scripts/*.mjs",
        "package.json",
        "tsconfig.json",
        "tsconfig.build.json",
      ],
      exports: [".", "./managed/jubjub-schnorr/contract"],
    },
  ],
  [
    "packages/contract",
    {
      name: "@midnight-ntwrk/midnight-did-contract",
      packageClass: "dist",
      files: [
        "dist/**",
        "README.md",
        "scripts/*.mjs",
        "package.json",
        "tsconfig.json",
        "tsconfig.build.json",
      ],
      exports: ["."],
    },
  ],
]);

const errors = [];

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

assertArrayEqual("root workspaces", rootPackage.workspaces, expectedWorkspaces);

for (const workspace of expectedWorkspaces) {
  assertFileExists(
    `${workspace} package`,
    path.join(workspace, "package.json"),
  );
}

for (const [workspace, expected] of expectedPackages.entries()) {
  const packageJson = readJson(path.join(workspace, "package.json"));
  const label = `${workspace}/package.json`;

  assertEqual(`${label} name`, packageJson.name, expected.name);
  assertEqual(`${label} version`, packageJson.version, rootPackage.version);
  assertEqual(`${label} private`, packageJson.private, true);
  assertEqual(`${label} type`, packageJson.type, "module");
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

  for (const exportKey of expected.exports) {
    const exportEntry = packageJson.exports?.[exportKey];
    if (!exportEntry || typeof exportEntry !== "object") {
      errors.push(`${label} export ${exportKey}: missing object export entry`);
      continue;
    }

    if (!String(exportEntry.types ?? "").startsWith("./dist/")) {
      errors.push(`${label} export ${exportKey}: types must point into ./dist`);
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
