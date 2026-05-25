#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceCatalog = [
  {
    workspace: "packages/api",
    artifactPackage: true,
    manifest: {
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
    },
  },
  {
    workspace: "packages/domain",
    artifactPackage: true,
    manifest: {
      name: "@midnight-ntwrk/midnight-did-domain",
      files: [
        "dist/**",
        "README.md",
        "package.json",
        "tsconfig.json",
        "tsconfig.build.json",
      ],
      exports: [".", "./midnight"],
    },
  },
  {
    workspace: "packages/did",
    artifactPackage: true,
    manifest: {
      name: "@midnight-ntwrk/midnight-did",
      files: [
        "dist/**",
        "README.md",
        "package.json",
        "tsconfig.json",
        "tsconfig.build.json",
      ],
      exports: [".", "./midnight"],
    },
  },
  {
    workspace: "packages/jubjub-schnorr",
    artifactPackage: true,
    manifest: {
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
    },
  },
  {
    workspace: "packages/contract",
    artifactPackage: true,
    manifest: {
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
    },
  },
  {
    workspace: "docs-site",
    artifactPackage: false,
  },
];

export const expectedWorkspaces = workspaceCatalog.map(
  ({ workspace }) => workspace,
);

export const artifactWorkspaces = workspaceCatalog
  .filter(({ artifactPackage }) => artifactPackage)
  .map(({ workspace }) => workspace);

export const packageManifestCatalog = new Map(
  workspaceCatalog
    .filter(({ artifactPackage }) => artifactPackage)
    .map(({ workspace, manifest }) => [workspace, manifest]),
);

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const [command] = process.argv.slice(2);

if (isDirectExecution) {
  switch (command) {
    case "--artifact-workspaces":
      stdout.write(`${artifactWorkspaces.join("\n")}\n`);
      break;
    case undefined:
    case "--help":
      stdout.write(
        [
          "Usage: node scripts/did-workspace-catalog.mjs <command>",
          "",
          "Commands:",
          "  --artifact-workspaces  Print package workspaces packed as tarballs.",
        ].join("\n"),
      );
      stdout.write("\n");
      break;
    default:
      console.error(`[did-workspace-catalog] Unknown command: ${command}`);
      process.exit(2);
  }
}
