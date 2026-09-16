import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectFullGateHelper,
  parsePackageSpec,
  validateReviewPolicy,
} from "./diagnose.mjs";

async function createDevLoopsFixture(t, { helperSource, version = "0.9.0" }) {
  const fixtureRoot = await mkdtemp(
    path.join(os.tmpdir(), "midnight-did-dev-loops-fixture-"),
  );
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await writeFile(
    path.join(fixtureRoot, "package.json"),
    `${JSON.stringify({ name: "dev-loops", version })}\n`,
  );
  if (helperSource !== undefined) {
    const helperDirectory = path.join(fixtureRoot, "scripts", "github");
    await mkdir(helperDirectory, { recursive: true });
    await writeFile(
      path.join(helperDirectory, "upsert-checkpoint-verdict.mjs"),
      helperSource,
    );
  }
  return fixtureRoot;
}

test("parses pinned scoped and unscoped npm package specifications", () => {
  assert.deepEqual(parsePackageSpec("npm:dev-loops@0.9.0"), {
    spec: "npm:dev-loops@0.9.0",
    name: "dev-loops",
    version: "0.9.0",
  });
  assert.deepEqual(parsePackageSpec("npm:pi-subagents@0.62.0"), {
    spec: "npm:pi-subagents@0.62.0",
    name: "pi-subagents",
    version: "0.62.0",
  });
  assert.deepEqual(
    parsePackageSpec("npm:@input-output-hk/agent-review-pi@0.6.0"),
    {
      spec: "npm:@input-output-hk/agent-review-pi@0.6.0",
      name: "@input-output-hk/agent-review-pi",
      version: "0.6.0",
    },
  );
  assert.equal(parsePackageSpec("github:user/repo"), null);
});

test("keeps the reviewed stable Pi package pins exact", async () => {
  const settings = JSON.parse(
    await readFile(new URL("../../.pi/settings.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(settings.packages, [
    "npm:dev-loops@0.9.0",
    "npm:pi-subagents@0.62.0",
    "npm:@input-output-hk/agent-review-pi@0.6.0",
  ]);
});

test("reports the package-local full gate helper as ready", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource:
      'process.stdout.write("Usage: upsert-checkpoint-verdict.mjs\\n");\n',
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "full-helper-ready");
  assert.equal(result.reason, null);
  assert.equal(
    result.helperPath,
    path.join(
      packageRoot,
      "scripts",
      "github",
      "upsert-checkpoint-verdict.mjs",
    ),
  );
});

test("reports a missing package-local helper as fallback only", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {});

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /missing/);
});

test("reports a malformed package-local helper as fallback only", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: "export const broken = ;\n",
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /syntax validation/);
});

test("reports an invalid helper CLI contract as fallback only", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource: 'process.stdout.write("not the full helper\\n");\n',
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "fallback-only");
  assert.match(result.reason, /CLI help probe/);
});

test("distinguishes a package version failure from fallback-only state", async (t) => {
  const packageRoot = await createDevLoopsFixture(t, {
    helperSource:
      'process.stdout.write("Usage: upsert-checkpoint-verdict.mjs\\n");\n',
    version: "0.8.0",
  });

  const result = await inspectFullGateHelper({
    packageRoot,
    expectedVersion: "0.9.0",
  });

  assert.equal(result.status, "package-failure");
  assert.match(result.reason, /expected 0\.9\.0, found 0\.8\.0/);
});

test("review readiness fails closed when a mandatory reviewer is not routed", () => {
  const valid = {
    version: 1,
    routedReview: { backend: "agent-review", reviewers: ["patextreme"] },
    audit: {
      requiredReviewerLogins: ["patextreme"],
      structuredMarker: "agentflow-pr-review",
    },
  };
  assert.deepEqual(validateReviewPolicy(valid), { ok: true, errors: [] });
  const invalid = structuredClone(valid);
  invalid.audit.requiredReviewerLogins = ["someone-else"];
  const result = validateReviewPolicy(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /must be routed/);
});
