#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const stableSemverPattern = "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)";

export const releaseTrainVersionFromPackageVersion = (version) => {
  const match = new RegExp(`${stableSemverPattern}(?:-.+)?$`, "u").exec(
    version ?? "",
  );
  if (!match) {
    throw new Error(
      `package version must start with a stable release train like 1.2.3: ${version}`,
    );
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
};

export const releaseDocExamplesForVersion = (packageVersion) => {
  const releaseTrain = releaseTrainVersionFromPackageVersion(packageVersion);
  const snapshotLocalVersion = `${releaseTrain}-snapshot.local`;
  const snapshotWorkflowVersion = `${releaseTrain}-snapshot.<run>.<sha>`;
  const rcVersion = `${releaseTrain}-rc1`;

  return {
    releaseTrain,
    latestReleaseBadge: `release-v${releaseTrain}-blue`,
    snapshotLocalVersion,
    snapshotWorkflowVersion,
    snapshotLocalArchive: `artifacts/zk/midnight-did-zk-artifacts-${snapshotLocalVersion}.tar.gz`,
    snapshotOciRef: `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${snapshotWorkflowVersion}`,
    rcVersion,
    rcOciRef: `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${rcVersion}`,
    rcReleaseTag: `v${rcVersion}`,
  };
};

export const readRootPackageVersion = (root = repoRoot) => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  return packageJson.version;
};

export const releaseDocExamplesFromRoot = (root = repoRoot) =>
  releaseDocExamplesForVersion(readRootPackageVersion(root));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(releaseDocExamplesFromRoot(), null, 2));
}
