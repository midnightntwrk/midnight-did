#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { strict as assert } from "node:assert";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  artifactProfiles,
  createInputSourceManifest,
  explainProfile,
  profileNames,
} from "./managed-artifact-catalog.mjs";

assert.deepEqual(
  profileNames,
  ["contract", "jubjub-schnorr"],
  "managed artifact profiles should stay explicit and ordered",
);

for (const profileName of profileNames) {
  const report = explainProfile(profileName);
  assert.equal(report.known, true, `${profileName} should be known`);
  assert.equal(
    report.sourceManifest.algorithm,
    "sha256",
    `${profileName} should expose a SHA-256 source manifest`,
  );
  assert.match(
    report.sourceManifest.digest,
    /^[0-9a-f]{64}$/u,
    `${profileName} source manifest should expose a hex digest`,
  );
  assert.deepEqual(
    report.inputs,
    [...new Set(artifactProfiles[profileName].outputs.flatMap((artifact) => artifact.inputs))].sort(),
    `${profileName} should report the unique source inputs behind the digest`,
  );
  for (const input of report.inputs) {
    assert(
      report.sourceManifest.files.some((file) => file === input || file.startsWith(`${input}/`)),
      `${profileName} source manifest should include files for ${input}`,
    );
  }
}

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "did-managed-artifacts-"));
try {
  mkdirSync(path.join(fixtureRoot, "src"), { recursive: true });
  writeFileSync(path.join(fixtureRoot, "src", "a.compact"), "export a\n");
  writeFileSync(path.join(fixtureRoot, "src", "b.compact"), "export b\n");

  const first = createInputSourceManifest(["src"], fixtureRoot);
  assert.deepEqual(
    first.files,
    [path.join("src", "a.compact"), path.join("src", "b.compact")],
    "source manifest should collect input files in stable order",
  );

  writeFileSync(path.join(fixtureRoot, "src", "b.compact"), "export b2\n");
  const second = createInputSourceManifest(["src"], fixtureRoot);
  assert.notEqual(
    first.digest,
    second.digest,
    "source manifest digest should change when input contents change",
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("managed artifact catalog contract checks passed.");
