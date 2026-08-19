import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  evaluateCommitIntegrity,
  verifyPullRequestCommits,
} from "./verify-pr-commits.mjs";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const fixture = JSON.parse(
  await readFile(join(here, "fixtures", "verify-pr-commits.json"), "utf8"),
);

function payload({
  nodes,
  hasNextPage = false,
  endCursor = null,
  totalCount = nodes.length,
  headSha = fixture.headSha,
}) {
  return {
    data: {
      repository: {
        pullRequest: {
          headRefOid: headSha,
          commits: {
            totalCount,
            nodes: nodes.map((commit) => ({ commit })),
            pageInfo: { hasNextPage, endCursor },
          },
        },
      },
    },
  };
}

function headPayload(headSha = fixture.headSha) {
  return { data: { repository: { pullRequest: { headRefOid: headSha } } } };
}

function queuedGraphql(responses) {
  const calls = [];
  const requestGraphql = async (_query, variables) => {
    calls.push(variables);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.notEqual(response, undefined, "unexpected GraphQL request");
    return response;
  };
  return { calls, requestGraphql };
}

const baseOptions = {
  repo: "example/repository",
  pr: 42,
  expectedHeadSha: fixture.headSha,
  pageSize: 2,
  maxPages: 10,
};

test("mandatory signature regression reports a bad middle commit without skipping good neighbors", async () => {
  const commits = [
    fixture.commits.goodFirst,
    fixture.commits.badMiddleSignature,
    fixture.commits.goodLast,
  ];
  const graphql = queuedGraphql([
    payload({ nodes: commits, totalCount: 3 }),
    headPayload(),
  ]);
  const result = await verifyPullRequestCommits({
    ...baseOptions,
    requestGraphql: graphql.requestGraphql,
  });

  assert.equal(result.ok, false);
  assert.equal(result.commitCount, 3);
  assert.deepEqual(
    result.commits.map(({ ok }) => ok),
    [true, false, true],
  );
  assert.deepEqual(
    result.failures.map(({ type, sha }) => [type, sha]),
    [["signature", fixture.commits.badMiddleSignature.oid]],
  );
});

test("paginates every commit and performs a post-fetch exact-head check", async () => {
  const graphql = queuedGraphql([
    payload({
      nodes: [fixture.commits.goodFirst],
      hasNextPage: true,
      endCursor: "page-2",
      totalCount: 2,
    }),
    payload({ nodes: [fixture.commits.goodLast], totalCount: 2 }),
    headPayload(),
  ]);
  const result = await verifyPullRequestCommits({
    ...baseOptions,
    requestGraphql: graphql.requestGraphql,
  });

  assert.equal(result.ok, true);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.commitCount, 2);
  assert.deepEqual(
    graphql.calls.map(({ cursor }) => cursor),
    [null, "page-2", undefined],
  );
});

test("parses the complete terminal trailer block and reports missing or mismatched DCO", () => {
  const result = evaluateCommitIntegrity([
    fixture.commits.missingDco,
    fixture.commits.mismatchedDco,
    fixture.commits.nonTerminalDco,
  ]);

  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map(({ ok }) => ok),
    [false, false, true],
  );
  assert.deepEqual(
    result.map(({ failures }) => failures.map(({ type }) => type)),
    [["dco"], ["dco"], []],
  );
  assert.match(result[0].failures[0].reason, /terminal trailer block/);
  assert.match(result[1].failures[0].reason, /does not match commit author/);
});

test("empty commit sets fail closed", async () => {
  const graphql = queuedGraphql([
    payload({ nodes: [], totalCount: 0 }),
    headPayload(),
  ]);
  const result = await verifyPullRequestCommits({
    ...baseOptions,
    requestGraphql: graphql.requestGraphql,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "empty");
  assert.equal(result.failures[0].type, "empty");
});

test("pagination truncation fails closed when the page limit is reached", async () => {
  const graphql = queuedGraphql([
    payload({
      nodes: [fixture.commits.goodFirst],
      hasNextPage: true,
      endCursor: "page-2",
      totalCount: 2,
    }),
    headPayload(),
  ]);
  const result = await verifyPullRequestCommits({
    ...baseOptions,
    maxPages: 1,
    requestGraphql: graphql.requestGraphql,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some(
      ({ type, reason }) => type === "pagination" && /truncated/.test(reason),
    ),
  );
});

test("missing cursors and incomplete total counts fail closed", async (t) => {
  await t.test("missing next cursor", async () => {
    const graphql = queuedGraphql([
      payload({
        nodes: [fixture.commits.goodFirst],
        hasNextPage: true,
        endCursor: null,
        totalCount: 2,
      }),
      headPayload(),
    ]);
    const result = await verifyPullRequestCommits({
      ...baseOptions,
      requestGraphql: graphql.requestGraphql,
    });
    assert.ok(
      result.failures.some(
        ({ type, reason }) => type === "pagination" && /cursor/.test(reason),
      ),
    );
  });

  await t.test("reported total exceeds fetched commits", async () => {
    const graphql = queuedGraphql([
      payload({ nodes: [fixture.commits.goodFirst], totalCount: 2 }),
      headPayload(),
    ]);
    const result = await verifyPullRequestCommits({
      ...baseOptions,
      requestGraphql: graphql.requestGraphql,
    });
    assert.ok(
      result.failures.some(
        ({ type, reason }) =>
          type === "pagination" &&
          /reported 2 commits but fetched 1/.test(reason),
      ),
    );
  });
});

test("GraphQL errors, transport errors, and malformed responses fail closed", async (t) => {
  for (const [name, response, pattern] of [
    ["GraphQL error", { errors: [{ message: "forbidden" }] }, /forbidden/],
    [
      "transport error",
      new Error("network unavailable"),
      /network unavailable/,
    ],
    [
      "malformed response",
      { data: { repository: null } },
      /missing pull request commit data/,
    ],
  ]) {
    await t.test(name, async () => {
      const graphql = queuedGraphql([response]);
      const result = await verifyPullRequestCommits({
        ...baseOptions,
        requestGraphql: graphql.requestGraphql,
      });
      assert.equal(result.ok, false);
      assert.equal(result.status, "error");
      assert.ok(
        result.failures.some(
          ({ type, reason }) => type === "api" && pattern.test(reason),
        ),
      );
    });
  }
});

test("pre-fetch and post-fetch exact-head mismatches fail closed", async (t) => {
  await t.test("pre-fetch mismatch", async () => {
    const graphql = queuedGraphql([
      payload({
        nodes: [fixture.commits.goodFirst],
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
      headPayload(),
    ]);
    const result = await verifyPullRequestCommits({
      ...baseOptions,
      requestGraphql: graphql.requestGraphql,
    });
    assert.ok(
      result.failures.some(
        ({ type, phase }) => type === "head" && phase === "pre-fetch",
      ),
    );
  });

  await t.test("post-fetch mismatch", async () => {
    const graphql = queuedGraphql([
      payload({ nodes: [fixture.commits.goodFirst] }),
      headPayload("cccccccccccccccccccccccccccccccccccccccc"),
    ]);
    const result = await verifyPullRequestCommits({
      ...baseOptions,
      requestGraphql: graphql.requestGraphql,
    });
    assert.ok(
      result.failures.some(
        ({ type, phase }) => type === "head" && phase === "post-fetch",
      ),
    );
  });
});

test("module import is side-effect free", async () => {
  const scriptUrl = pathToFileURL(join(here, "verify-pr-commits.mjs")).href;
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `await import(${JSON.stringify(scriptUrl)})`,
  ]);
  assert.equal(stdout, "");
  assert.equal(stderr, "");
});

test("trusted-base workflow and package scripts retain local/CI integrity wiring", async () => {
  const workflow = await readFile(
    join(repoRoot, ".github", "workflows", "pr-commit-integrity.yml"),
    "utf8",
  );
  const packageJson = JSON.parse(
    await readFile(join(repoRoot, "package.json"), "utf8"),
  );

  assert.match(workflow, /^on:\n  pull_request_target:/m);
  assert.match(
    workflow,
    /permissions:\n  contents: read\n  pull-requests: read/,
  );
  assert.doesNotMatch(workflow, /actions\/checkout/);
  assert.doesNotMatch(workflow, /refs\/pull|github\.head_ref/);
  assert.match(
    workflow,
    /BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
  );
  assert.match(
    workflow,
    /contents\/scripts\/review\/verify-pr-commits\.mjs\?ref=\$\{BASE_SHA\}/,
  );
  assert.match(workflow, /node "\$\{RUNNER_TEMP\}\/verify-pr-commits\.mjs"/);
  assert.match(workflow, /- edited/);
  assert.match(
    packageJson.scripts["test:pr-commit-integrity"],
    /verify-pr-commits\.test\.mjs/,
  );
  assert.match(packageJson.scripts["ci:core"], /test:pr-commit-integrity/);
  assert.match(packageJson.scripts.verify, /\.\/run\.sh --light --strict/);
  assert.match(packageJson.scripts.verify, /\.\/run\.sh core --strict/);
  assert.match(packageJson.scripts.verify, /\.\/run\.sh integration-report/);
  assert.match(packageJson.scripts.verify, /pnpm run coverage:all/);
  assert.equal(packageJson.scripts.ci, "pnpm run verify");
});
