#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  artifactWorkspaces,
  publishWorkspaces,
  workspaceCatalog,
} from "./did-workspace-catalog.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const artifactCatalog = path.join(repoRoot, "scripts/artifact-workspaces.sh");

const bash = (script) =>
  execFileSync("bash", ["-c", `source "${artifactCatalog}"; ${script}`], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

assert.deepEqual(
  bash("did_artifact_workspaces").split(/\r?\n/u),
  artifactWorkspaces,
  "artifact workspace catalog should list DID package tarballs in pack order",
);

assert.equal(
  new Set(workspaceCatalog.map(({ workspace }) => workspace)).size,
  workspaceCatalog.length,
  "workspace catalog paths must be unique",
);
assert.deepEqual(
  new Set(publishWorkspaces),
  new Set(artifactWorkspaces),
  "publish workspace catalog must publish exactly the artifact packages",
);
assert.deepEqual(
  bash("node scripts/did-workspace-catalog.mjs --publish-workspaces").split(
    /\r?\n/u,
  ),
  publishWorkspaces,
  "publish workspace catalog should list packages in dependency order",
);
for (const entry of workspaceCatalog) {
  if (entry.artifactPackage) {
    assert.ok(
      entry.manifest,
      `${entry.workspace} artifact package must define manifest expectations`,
    );
  }
}

const listResult = spawnSync("./upgrade-libs.sh", ["--list-packages"], {
  cwd: repoRoot,
  encoding: "utf8",
});
assert.equal(listResult.status, 0, "--list-packages should succeed");
assert.deepEqual(
  listResult.stdout.trim().split(/\r?\n/u),
  artifactWorkspaces,
  "upgrade-libs should expose the shared artifact workspace catalog",
);

const missingCatalogResult = spawnSync(
  "bash",
  [
    "-c",
    [
      "export DID_WORKSPACE_CATALOG_SCRIPT=/tmp/missing-did-workspace-catalog.mjs",
      "bash ./scripts/pack-artifacts.sh \"$1\"",
    ].join("; "),
    "bash",
    path.join(mkdtempSync(path.join(tmpdir(), "did-pack-missing-")), "npm"),
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
);
assert.equal(
  missingCatalogResult.status,
  1,
  "pack-artifacts should fail closed when the workspace catalog is unavailable",
);
assert.match(
  missingCatalogResult.stderr,
  /DID artifact workspace catalog is empty or unavailable/u,
  "pack-artifacts should explain empty catalog failures",
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
