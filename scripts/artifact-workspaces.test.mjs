#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const artifactCatalog = path.join(repoRoot, "scripts/artifact-workspaces.sh");

const expectedWorkspaces = [
  "packages/api",
  "packages/domain",
  "packages/did",
  "packages/jubjub-schnorr",
  "packages/contract",
];

const bash = (script) =>
  execFileSync("bash", ["-c", `source "${artifactCatalog}"; ${script}`], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

assert.deepEqual(
  bash("did_artifact_workspaces").split(/\r?\n/u),
  expectedWorkspaces,
  "artifact workspace catalog should list DID package tarballs in pack order",
);

const listResult = spawnSync("./upgrade-libs.sh", ["--list-packages"], {
  cwd: repoRoot,
  encoding: "utf8",
});
assert.equal(listResult.status, 0, "--list-packages should succeed");
assert.deepEqual(
  listResult.stdout.trim().split(/\r?\n/u),
  expectedWorkspaces,
  "upgrade-libs should expose the shared artifact workspace catalog",
);

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "did-artifacts-"));
try {
  const downstreamRepo = path.join(fixtureRoot, "consumer");
  const libsRoot = path.join(fixtureRoot, "libs");
  const artifactsRoot = path.join(fixtureRoot, "artifacts");
  const customRoot = path.join(fixtureRoot, "custom-output");

  mkdirSync(path.join(downstreamRepo, "libs"), { recursive: true });
  mkdirSync(libsRoot, { recursive: true });
  mkdirSync(artifactsRoot, { recursive: true });
  mkdirSync(customRoot, { recursive: true });
  writeFileSync(path.join(downstreamRepo, "package.json"), "{}\n");

  assert.equal(
    bash(`did_artifact_resolve_destination "${downstreamRepo}"`),
    path.join(downstreamRepo, "libs/midnight-did"),
    "downstream repo roots should resolve to libs/midnight-did",
  );
  assert.equal(
    bash(`did_artifact_resolve_destination "${libsRoot}"`),
    path.join(libsRoot, "midnight-did"),
    "libs roots should resolve to libs/midnight-did",
  );
  assert.equal(
    bash(`did_artifact_resolve_destination "${artifactsRoot}"`),
    path.join(artifactsRoot, "npm"),
    "artifacts roots should resolve to artifacts/npm",
  );
  assert.equal(
    bash(`did_artifact_resolve_destination "${customRoot}"`),
    customRoot,
    "concrete output directories should be preserved",
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("artifact workspace contract checks passed.");
