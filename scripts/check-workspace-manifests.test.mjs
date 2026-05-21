#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = mkdtempSync(path.join(tmpdir(), "did-workspaces-"));
const scriptPath = path.join(repoRoot, "scripts/check-workspace-manifests.mjs");

const writeJson = (relativePath, value) => {
  const targetPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeReadme = (workspace) => {
  const targetPath = path.join(fixtureRoot, workspace, "README.md");
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `# ${workspace}\n`);
};

const distPackage = ({ name, files, exports }) => ({
  name,
  version: "0.1.0",
  private: true,
  type: "module",
  main: "dist/index.js",
  module: "dist/index.js",
  types: "./dist/index.d.ts",
  exports: Object.fromEntries(
    exports.map((exportKey) => [
      exportKey,
      {
        types:
          exportKey === "."
            ? "./dist/index.d.ts"
            : `./dist/${exportKey.slice(2)}.d.ts`,
        require:
          exportKey === "."
            ? "./dist/index.js"
            : `./dist/${exportKey.slice(2)}.js`,
        import:
          exportKey === "."
            ? "./dist/index.js"
            : `./dist/${exportKey.slice(2)}.js`,
        default:
          exportKey === "."
            ? "./dist/index.js"
            : `./dist/${exportKey.slice(2)}.js`,
      },
    ]),
  ),
  files,
});

const rootPackage = {
  name: "midnight-did",
  version: "0.1.0",
  private: true,
  type: "module",
  workspaces: [
    "packages/api",
    "packages/domain",
    "packages/did",
    "packages/jubjub-schnorr",
    "packages/contract",
    "docs-site",
  ],
};

const packageFixtures = {
  "packages/api": distPackage({
    name: "@midnight-ntwrk/midnight-did-api",
    files: [
      "dist/**",
      "README.md",
      "examples/**",
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
    ],
    exports: ["."],
  }),
  "packages/domain": distPackage({
    name: "@midnight-ntwrk/midnight-did-domain",
    files: [
      "dist/**",
      "README.md",
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
    ],
    exports: [".", "./midnight"],
  }),
  "packages/did": distPackage({
    name: "@midnight-ntwrk/midnight-did",
    files: [
      "dist/**",
      "README.md",
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
    ],
    exports: ["."],
  }),
  "packages/jubjub-schnorr": distPackage({
    name: "@midnight-ntwrk/midnight-did-jubjub-schnorr",
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
  }),
  "packages/contract": distPackage({
    name: "@midnight-ntwrk/midnight-did-contract",
    files: [
      "dist/**",
      "README.md",
      "scripts/*.mjs",
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
    ],
    exports: ["."],
  }),
};

const runCheck = () =>
  spawnSync(process.execPath, [scriptPath], {
    cwd: path.join(fixtureRoot, "packages/api"),
    encoding: "utf8",
    env: {
      ...process.env,
      DID_WORKSPACE_MANIFEST_REPO_ROOT: fixtureRoot,
    },
  });

try {
  writeJson("package.json", rootPackage);
  for (const [workspace, packageJson] of Object.entries(packageFixtures)) {
    writeJson(path.join(workspace, "package.json"), packageJson);
    writeReadme(workspace);
  }
  writeJson("docs-site/package.json", {
    name: "docs-site",
    private: true,
    type: "module",
  });

  const pass = runCheck();
  if (pass.status !== 0) {
    throw new Error(
      `expected valid fixture to pass:\n${pass.stdout}${pass.stderr}`,
    );
  }

  const apiPackagePath = path.join(fixtureRoot, "packages/api/package.json");
  const apiPackage = JSON.parse(readFileSync(apiPackagePath, "utf8"));
  writeJson("packages/api/package.json", {
    ...apiPackage,
    name: "@midnight-ntwrk/broken-did-api",
  });

  const fail = runCheck();
  if (fail.status === 0) {
    throw new Error("expected invalid package name fixture to fail");
  }
  if (!fail.stderr.includes("packages/api/package.json name")) {
    throw new Error(`unexpected failure output:\n${fail.stdout}${fail.stderr}`);
  }

  console.log("check-workspace-manifests contract passed");
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}
