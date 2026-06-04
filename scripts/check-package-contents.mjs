#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { artifactWorkspaces } from "./did-workspace-catalog.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const disallowedFilePatterns = [
  /^coverage\//u,
  /^reports\//u,
  /^dist\/test\//u,
  /^src\/test\//u,
  /(^|\/)[^/]+\.test\.(js|d\.ts|js\.map|d\.ts\.map)$/u,
  /(^|\/)[^/]+\.tsbuildinfo$/u,
];

const parsePackOutput = (workspace, stdout) => {
  try {
    const parsed = JSON.parse(stdout);
    const [packument] = Array.isArray(parsed) ? parsed : [parsed];
    if (!packument || !Array.isArray(packument.files)) {
      throw new Error("missing files array");
    }
    return packument;
  } catch (error) {
    throw new Error(
      `${workspace}: npm pack did not return parseable JSON (${error.message})`,
    );
  }
};

const errors = [];

for (const workspace of artifactWorkspaces) {
  const result = spawnSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: path.join(repoRoot, workspace),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    errors.push(
      `${workspace}: npm pack failed\n${result.stdout}${result.stderr}`.trim(),
    );
    continue;
  }

  const packument = parsePackOutput(workspace, result.stdout);
  const filePaths = packument.files.map(({ path: filePath }) => filePath);
  const disallowed = filePaths.filter((filePath) =>
    disallowedFilePatterns.some((pattern) => pattern.test(filePath)),
  );

  if (disallowed.length > 0) {
    errors.push(
      `${workspace}: package contains development-only files: ${disallowed.join(", ")}`,
    );
  }

  console.log(
    `[check-package-contents] ${workspace}: ${filePaths.length} files, ${packument.size} packed bytes`,
  );
}

if (errors.length > 0) {
  console.error("[check-package-contents] Package content check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[check-package-contents] Package contents are publishable.");
