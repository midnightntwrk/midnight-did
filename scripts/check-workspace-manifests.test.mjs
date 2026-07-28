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

import {
  npmPackageRegistry,
  repositoryUrl,
} from "./did-workspace-catalog.mjs";

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

const distPackage = ({ name, workspace, files, exports }) => ({
  name,
  version: "0.1.0",
  license: "Apache-2.0",
  type: "module",
  repository: {
    type: "git",
    url: repositoryUrl,
    directory: workspace,
  },
  publishConfig: {
    access: "public",
    registry: npmPackageRegistry,
  },
  engines: {
    node: ">=24",
    pnpm: ">=10",
  },
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
    workspace: "packages/api",
    files: [
      "dist/**",
      "README.md",
      "examples/**",
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
    ],
    exports: [".", "./browser"],
  }),
  "packages/domain": distPackage({
    name: "@midnight-ntwrk/midnight-did-domain",
    workspace: "packages/domain",
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
    workspace: "packages/did",
    files: [
      "dist/**",
      "README.md",
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
    ],
    exports: [".", "./midnight"],
  }),
  "packages/jubjub-schnorr": distPackage({
    name: "@midnight-ntwrk/midnight-did-jubjub-schnorr",
    workspace: "packages/jubjub-schnorr",
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
    workspace: "packages/contract",
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

const writeFixture = () => {
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
};

const readFixtureJson = (relativePath) =>
  JSON.parse(readFileSync(path.join(fixtureRoot, relativePath), "utf8"));

const expectFailure = (mutateFixture, expectedMessage) => {
  writeFixture();
  mutateFixture();
  const fail = runCheck();
  if (fail.status === 0) {
    throw new Error(`expected fixture to fail with ${expectedMessage}`);
  }
  if (!fail.stderr.includes(expectedMessage)) {
    throw new Error(`unexpected failure output:\n${fail.stdout}${fail.stderr}`);
  }
};

try {
  writeFixture();

  const pass = runCheck();
  if (pass.status !== 0) {
    throw new Error(
      `expected valid fixture to pass:\n${pass.stdout}${pass.stderr}`,
    );
  }

  expectFailure(() => {
    writeJson("packages/api/package.json", {
      ...readFixtureJson("packages/api/package.json"),
      name: "@midnight-ntwrk/broken-did-api",
    });
  }, "packages/api/package.json name");

  expectFailure(() => {
    const apiPackage = readFixtureJson("packages/api/package.json");
    writeJson("packages/api/package.json", {
      ...apiPackage,
      private: true,
    });
  }, "packages/api/package.json must be publishable");

  expectFailure(() => {
    const apiPackage = readFixtureJson("packages/api/package.json");
    writeJson("packages/api/package.json", {
      ...apiPackage,
      publishConfig: {
        registry: "https://npm.pkg.github.com",
      },
    });
  }, "packages/api/package.json publishConfig.registry");

  expectFailure(() => {
    const apiPackage = readFixtureJson("packages/api/package.json");
    writeJson("packages/api/package.json", {
      ...apiPackage,
      publishConfig: {
        ...apiPackage.publishConfig,
        access: "restricted",
      },
    });
  }, "packages/api/package.json publishConfig.access");

  expectFailure(() => {
    const apiPackage = readFixtureJson("packages/api/package.json");
    writeJson("packages/api/package.json", {
      ...apiPackage,
      repository: {
        ...apiPackage.repository,
        directory: "packages/did",
      },
    });
  }, "packages/api/package.json repository.directory");

  expectFailure(() => {
    const apiPackage = readFixtureJson("packages/api/package.json");
    writeJson("packages/api/package.json", {
      ...apiPackage,
      files: [...apiPackage.files, "unexpected/**"],
    });
  }, "packages/api/package.json files");

  expectFailure(() => {
    const apiPackage = readFixtureJson("packages/api/package.json");
    writeJson("packages/api/package.json", {
      ...apiPackage,
      exports: {
        ...apiPackage.exports,
        ".": {
          ...apiPackage.exports["."],
          types: "./src/index.ts",
        },
      },
    });
  }, "packages/api/package.json export .: types must point into ./dist");

  expectFailure(() => {
    rmSync(path.join(fixtureRoot, "packages/api/README.md"), { force: true });
  }, "packages/api README: missing packages/api/README.md");

  expectFailure(() => {
    mkdirSync(path.join(fixtureRoot, "packages/api/src"), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, "packages/api/src/index.ts"),
      'import { z } from "zod";\nexport { z };\n',
    );
  }, "packages/api/package.json dependency zod");

  console.log("check-workspace-manifests contract passed");
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}
