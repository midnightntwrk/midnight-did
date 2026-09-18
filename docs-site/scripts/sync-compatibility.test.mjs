import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  assertCurrentBaselineMatchesEvidence,
  buildCompatibilityPage,
  loadCompatibilityBaselines,
  readCurrentCompatibilityEvidence,
} from "./sync-compatibility.mjs";

test("extracts the current compatibility row from repository evidence", async () => {
  const evidence = await readCurrentCompatibilityEvidence();

  assert.equal(evidence.version, "0.6.0");
  assert.equal(evidence.nodeMajor, "24");
  assert.equal(evidence.pnpm, "10.34.5");
  assert.equal(evidence.compactCompiler, "0.31.1");
  assert.equal(evidence.didLanguagePragma, ">= 0.20");
  assert.equal(evidence.jubjubLanguagePragma, ">= 0.22");
  assert.equal(evidence.compactRuntime, "0.16.0");
  assert.equal(evidence.compactJs, "2.5.0");
  assert.equal(evidence.ledger, "@midnight-ntwrk/ledger-v8@8.1.0");
  assert.equal(evidence.midnightJsFamily, "4.0.2");
  assert.equal(evidence.proofServer, "midnightntwrk/proof-server:8.0.3");
  assert.deepEqual(
    new Set(Object.values(evidence.packageVersions)),
    new Set(["0.6.0"]),
  );
});

test("fails closed when a current repository pin drifts from reviewed baseline data", async () => {
  const evidence = await readCurrentCompatibilityEvidence();
  const source = await loadCompatibilityBaselines();
  const current = source.baselines.find(
    ({ version }) => version === source.currentRelease,
  );
  const drifted = structuredClone(evidence);
  drifted.compactCompiler = "0.31.2";

  assert.throws(
    () => assertCurrentBaselineMatchesEvidence(drifted, current),
    /stale for: compactCompiler/u,
  );
});

test("generated compatibility page records status semantics and 0.5 manifest caveat", async () => {
  const { content } = await buildCompatibilityPage();

  assert.match(content, /\*\*Current\*\* means the latest published/u);
  assert.match(
    content,
    /Compatibility reference\*\* records a\s+legacy release/u,
  );
  assert.match(content, /no continuing-support implication/u);
  assert.match(content, /v0\.5\.0.*a14267cec3c1ab7e00bb0f058a54267d913a321b/u);
  assert.match(content, /v0\.6\.0.*8f788e2ef5652fa7f9cfdc71a3cac40d5f3683bf/u);
  assert.match(content, /source tag reports version\n`0\.4\.0`/u);
  assert.match(content, /does not infer\nsupport for newer Node/u);
});

test("committed compatibility page matches generated repository evidence", async () => {
  const [{ content }, committed] = await Promise.all([
    buildCompatibilityPage(),
    readFile("docs-site/guide/compatibility.md", "utf8"),
  ]);

  assert.equal(committed, content);
});
