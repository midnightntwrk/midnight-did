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

test("structured marker parsing rejects prefixes, nesting, and prefixed attributes", () => {
  const base = {
    preHeadSha: fixtureSet.headSha,
    postHeadSha: fixtureSet.headSha,
    formalReviews: { items: [] },
    reviewThreads: { items: [] },
  };
  const resultFor = (body) =>
    auditFeedback(
      policy,
      {
        ...base,
        issueComments: { items: [{ author: { login: "patextreme" }, body }] },
      },
      fixtureSet.headSha,
    );

  assert.equal(
    resultFor(
      `<agentflow-pr-reviewer sha="${fixtureSet.headSha}" verdict="approved"/>`,
    ).status,
    "missing",
  );
  for (const body of [
    `<agentflow-pr-review malformed <x sha="${fixtureSet.headSha}" verdict="approved"/>`,
    `<agentflow-pr-review x-sha="${fixtureSet.headSha}" verdict="approved"/>`,
    `<agentflow-pr-review sha="${fixtureSet.headSha}" not-verdict="approved"/>`,
  ]) {
    assert.equal(resultFor(body).status, "empty");
  }
});

test("outdated unresolved inline threads do not poison the current head", () => {
  const input = {
    preHeadSha: fixtureSet.headSha,
    postHeadSha: fixtureSet.headSha,
    formalReviews: { items: [] },
    reviewThreads: {
      items: [{ id: "old", isResolved: false, isOutdated: true, comments: [] }],
    },
    issueComments: { items: [] },
  };
  const result = auditFeedback(policy, input, fixtureSet.headSha);
  assert.equal(result.status, "missing");
  assert.deepEqual(result.findings, []);
});


test("an authorized structured finding cannot be hidden by a later clean marker", () => {
  const input = {
    preHeadSha: fixtureSet.headSha,
    postHeadSha: fixtureSet.headSha,
    formalReviews: { items: [] },
    reviewThreads: { items: [] },
    issueComments: {
      items: [
        {
          author: { login: "patextreme" },
          body: `<agentflow-pr-review sha="${fixtureSet.headSha}" verdict="changes"/>`,
          createdAt: "2026-08-19T12:00:00Z",
        },
        {
          author: { login: "patextreme" },
          body: `<agentflow-pr-review sha="${fixtureSet.headSha}" verdict="approved"/>`,
          createdAt: "2026-08-19T13:00:00Z",
        },
      ],
    },
  };

  const result = auditFeedback(policy, input, fixtureSet.headSha);
  assert.equal(result.ok, false);
  assert.equal(result.status, "mixed");
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].verdict, "changes");
});
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
