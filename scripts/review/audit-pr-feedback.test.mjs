import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import { auditFeedback, loadReviewPolicy } from "./audit-pr-feedback.mjs";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, "audit-pr-feedback.mjs");
const repoRoot = resolve(here, "../..");
const policyPath = join(repoRoot, ".github", "review-policy.json");
const fixturesPath = join(here, "fixtures", "audit-pr-feedback.json");
const fixtureSet = JSON.parse(await readFile(fixturesPath, "utf8"));
const policy = await loadReviewPolicy(policyPath);

for (const fixture of fixtureSet.cases) {
  test(`feedback audit: ${fixture.name}`, () => {
    const result = auditFeedback(policy, fixture.input, fixtureSet.headSha);
    assert.equal(result.status, fixture.expectedStatus);
    assert.equal(result.ok, fixture.expectedStatus === "clean");
    assert.equal(result.headSha, fixtureSet.headSha);
    assert.ok(Array.isArray(result.evidence));
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.reasons));
  });
}

test("missing API source and empty API output fail closed distinctly", () => {
  const base = {
    preHeadSha: fixtureSet.headSha,
    postHeadSha: fixtureSet.headSha,
    formalReviews: { items: [] },
    reviewThreads: { items: [] },
    issueComments: { items: [] },
  };
  const missing = { ...base };
  delete missing.reviewThreads;
  assert.equal(
    auditFeedback(policy, missing, fixtureSet.headSha).status,
    "missing",
  );

  const empty = { ...base, formalReviews: { items: [], emptyResponse: true } };
  assert.equal(
    auditFeedback(policy, empty, fixtureSet.headSha).status,
    "empty",
  );
});

test("policy loader rejects an unrouted required reviewer", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "review-policy-"));
  const invalidPath = join(temporary, "policy.json");
  await writeFile(
    invalidPath,
    JSON.stringify({
      ...policy,
      audit: { ...policy.audit, requiredReviewerLogins: ["not-routed"] },
    }),
  );
  try {
    await assert.rejects(
      loadReviewPolicy(invalidPath),
      /must route every required audit reviewer/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("CLI emits structured JSON and exits nonzero when dispatch is the only evidence", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "review-audit-fixture-"));
  const fixture = fixtureSet.cases.find(({ name }) =>
    name.includes("dispatch success"),
  );
  const fixturePath = join(temporary, "fixture.json");
  await writeFile(fixturePath, JSON.stringify(fixture.input));
  try {
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          script,
          "--repo",
          "example/repo",
          "--pr",
          "42",
          "--head-sha",
          fixtureSet.headSha,
          "--policy",
          policyPath,
          "--fixture",
          fixturePath,
        ],
        { cwd: repoRoot },
      ),
      (error) => {
        const payload = JSON.parse(error.stdout);
        assert.equal(payload.ok, false);
        assert.equal(payload.status, "missing");
        assert.equal(payload.repo, "example/repo");
        assert.equal(payload.pr, 42);
        return true;
      },
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
