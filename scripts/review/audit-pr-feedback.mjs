#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 60_000;

function usage() {
  return `Usage: audit-pr-feedback.mjs --repo <owner/name> --pr <number> --head-sha <sha> [options]

Audits structured review outcomes for exactly one PR head. Dispatch ledgers are
not completion evidence.

Options:
  --policy <path>             Review policy (default: .github/review-policy.json)
  --fixture <path>            Read API-shaped feedback from a test fixture
  --timeout-ms <number>       Per-GitHub-call timeout (default: ${DEFAULT_TIMEOUT_MS})
  -h, --help                  Show this help
`;
}

function parseArgs(argv) {
  const options = { timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (!arg.startsWith("--")) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2).replaceAll("-", "");
    const value = argv[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`${arg} requires a value`);
    if (key === "timeoutms")
      options.timeoutMs = positiveInt(value, "--timeout-ms");
    else if (["repo", "pr", "headsha", "policy", "fixture"].includes(key))
      options[key] = value;
    else throw new Error(`unknown option: ${arg}`);
  }
  for (const required of ["repo", "pr", "headsha"]) {
    if (!options[required])
      throw new Error(
        `--${required.replace("headsha", "head-sha")} is required`,
      );
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo))
    throw new Error("--repo must be owner/name");
  const [owner, repository] = options.repo.split("/");
  if (
    owner === "." ||
    owner === ".." ||
    repository === "." ||
    repository === ".."
  )
    throw new Error("--repo must be owner/name");
  if (!/^\d+$/.test(options.pr) || Number(options.pr) < 1)
    throw new Error("--pr must be a positive integer");
  if (!/^[0-9a-f]{7,64}$/i.test(options.headsha))
    throw new Error("--head-sha must be a git SHA");
  return options;
}

function positiveInt(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export async function loadReviewPolicy(policyPath) {
  let policy;
  try {
    policy = JSON.parse(await readFile(policyPath, "utf8"));
  } catch (error) {
    throw new Error(
      `review policy at ${policyPath} is missing or invalid: ${error.message}`,
    );
  }
  const audit = policy?.audit;
  const requiredArrays = [
    "requiredReviewerLogins",
    "cleanVerdicts",
    "findingVerdicts",
    "timeoutVerdicts",
  ];
  const routedReviewers = policy?.routedReview?.reviewers;
  if (
    policy?.version !== 1 ||
    policy?.routedReview?.backend !== "agent-review" ||
    !Array.isArray(routedReviewers) ||
    routedReviewers.length === 0 ||
    routedReviewers.some(
      (reviewer) => typeof reviewer !== "string" || reviewer.length === 0,
    ) ||
    !audit ||
    typeof audit.structuredMarker !== "string" ||
    audit.structuredMarker.length === 0 ||
    requiredArrays.some(
      (key) =>
        !Array.isArray(audit[key]) ||
        audit[key].length === 0 ||
        audit[key].some(
          (value) => typeof value !== "string" || value.length === 0,
        ),
    ) ||
    !Number.isInteger(audit.pageSize) ||
    audit.pageSize < 1 ||
    audit.pageSize > 100 ||
    !Number.isInteger(audit.maxPages) ||
    audit.maxPages < 1
  ) {
    throw new Error(
      `review policy at ${policyPath} does not satisfy the version 1 review policy contract`,
    );
  }
  const routed = new Set(policy.routedReview.reviewers.map(lower));
  if (
    audit.requiredReviewerLogins.some(
      (login) => typeof login !== "string" || !routed.has(lower(login)),
    )
  ) {
    throw new Error(
      `review policy at ${policyPath} must route every required audit reviewer`,
    );
  }
  return policy;
}

function lower(value) {
  return String(value ?? "").toLowerCase();
}

function sameSha(left, right) {
  return lower(left) === lower(right);
}

function authorLogin(item) {
  return item?.author?.login ?? item?.user?.login ?? item?.authorLogin ?? null;
}

function commitSha(item) {
  return (
    item?.commit?.oid ??
    item?.commitId ??
    item?.commit_id ??
    item?.headSha ??
    item?.sha ??
    null
  );
}

function timestamp(item) {
  const raw = item?.submittedAt ?? item?.createdAt ?? item?.updatedAt ?? "";
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function latestBy(items, key) {
  const latest = new Map();
  for (const item of items) {
    const id = key(item);
    if (!id) continue;
    const previous = latest.get(id);
    if (!previous || timestamp(item) >= timestamp(previous))
      latest.set(id, item);
  }
  return [...latest.values()];
}

function collectionProblem(name, collection) {
  if (collection === undefined || collection === null)
    return { status: "missing", reason: `${name} response is missing` };
  if (collection.timedOut || collection.timeout)
    return { status: "timeout", reason: `${name} request timed out` };
  if (collection.truncated)
    return { status: "truncated", reason: `${name} pagination was truncated` };
  if (collection.emptyResponse || collection.raw === "")
    return { status: "empty", reason: `${name} returned an empty response` };
  if (!Array.isArray(collection.items))
    return { status: "missing", reason: `${name} items are missing` };
  return null;
}

function markerPattern(marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `<${escaped}\\s+sha="([^"]*)"\\s+verdict="([^"]*)"\\s*\\/>`,
    "gi",
  );
}

function structuredMarkers(comments, marker) {
  const pattern = markerPattern(marker);
  const results = [];
  for (const comment of comments) {
    const body = String(comment?.body ?? "");
    pattern.lastIndex = 0;
    let match;
    let found = false;
    while ((match = pattern.exec(body)) !== null) {
      found = true;
      results.push({
        author: authorLogin(comment),
        sha: match[1],
        verdict: lower(match[2]),
        createdAt: comment.createdAt,
        source: "issue-comment",
      });
    }
    if (!found && body.includes(`<${marker}`)) {
      results.push({
        author: authorLogin(comment),
        sha: null,
        verdict: null,
        createdAt: comment.createdAt,
        source: "issue-comment",
        malformed: true,
      });
    }
  }
  return results;
}

function summarySources(input) {
  const summarize = (collection) => ({
    count: Array.isArray(collection?.items) ? collection.items.length : null,
    truncated: collection?.truncated === true,
    timedOut: collection?.timedOut === true || collection?.timeout === true,
    emptyResponse: collection?.emptyResponse === true || collection?.raw === "",
  });
  return {
    formalReviews: summarize(input.formalReviews),
    reviewThreads: summarize(input.reviewThreads),
    issueComments: summarize(input.issueComments),
  };
}

export function auditFeedback(policy, input, expectedHeadSha) {
  const base = {
    ok: false,
    status: "missing",
    headSha: expectedHeadSha,
    requiredReviewers: policy.audit.requiredReviewerLogins,
    sources: summarySources(input),
    evidence: [],
    findings: [],
    reasons: [],
  };

  if (!sameSha(input.preHeadSha, expectedHeadSha)) {
    return {
      ...base,
      status: "stale",
      reasons: [
        `pre-audit PR head is ${input.preHeadSha ?? "missing"}, expected ${expectedHeadSha}`,
      ],
    };
  }
  if (!sameSha(input.postHeadSha, expectedHeadSha)) {
    return {
      ...base,
      status: "head-race",
      reasons: [
        `post-audit PR head is ${input.postHeadSha ?? "missing"}, expected ${expectedHeadSha}`,
      ],
    };
  }

  const sourceProblems = [
    collectionProblem("formal reviews", input.formalReviews),
    collectionProblem("review threads", input.reviewThreads),
    collectionProblem("issue comments", input.issueComments),
  ].filter(Boolean);
  if (sourceProblems.length > 0) {
    const priority = ["timeout", "truncated", "empty", "missing"];
    const status = priority.find((candidate) =>
      sourceProblems.some((problem) => problem.status === candidate),
    );
    return {
      ...base,
      status,
      reasons: sourceProblems.map((problem) => problem.reason),
    };
  }

  const required = new Set(policy.audit.requiredReviewerLogins.map(lower));
  const cleanVerdicts = new Set(policy.audit.cleanVerdicts.map(lower));
  const findingVerdicts = new Set(policy.audit.findingVerdicts.map(lower));
  const timeoutVerdicts = new Set(policy.audit.timeoutVerdicts.map(lower));
  const formal = latestBy(input.formalReviews.items, (review) =>
    lower(authorLogin(review)),
  );
  const markers = latestBy(
    structuredMarkers(
      input.issueComments.items,
      policy.audit.structuredMarker,
    ).filter((marker) => required.has(lower(marker.author))),
    (marker) => lower(marker.author),
  );

  const clean = [];
  const findings = [];
  const stale = [];
  const indeterminate = [];
  const timeout = [];

  for (const review of formal) {
    const author = authorLogin(review);
    const state = String(review?.state ?? "").toUpperCase();
    const sha = commitSha(review);
    const record = { source: "formal-review", author, sha, verdict: state };
    if (state === "DISMISSED" || state === "PENDING") continue;
    if (!sameSha(sha, expectedHeadSha)) {
      if (required.has(lower(author))) stale.push(record);
      continue;
    }
    if (state === "CHANGES_REQUESTED") findings.push(record);
    else if (state === "APPROVED" && required.has(lower(author)))
      clean.push(record);
    else if (required.has(lower(author))) indeterminate.push(record);
  }

  for (const marker of markers) {
    const record = {
      source: marker.source,
      author: marker.author,
      sha: marker.sha,
      verdict: marker.verdict,
    };
    if (marker.malformed || !marker.sha || !marker.verdict) {
      indeterminate.push(record);
    } else if (!sameSha(marker.sha, expectedHeadSha)) {
      stale.push(record);
    } else if (cleanVerdicts.has(marker.verdict)) {
      clean.push(record);
    } else if (findingVerdicts.has(marker.verdict)) {
      findings.push(record);
    } else if (timeoutVerdicts.has(marker.verdict)) {
      timeout.push(record);
    } else {
      indeterminate.push(record);
    }
  }

  for (const thread of input.reviewThreads.items) {
    if (thread?.isResolved === true || thread?.resolved === true) continue;
    const comments =
      thread?.comments?.items ??
      thread?.comments?.nodes ??
      thread?.comments ??
      [];
    const lastComment = Array.isArray(comments) ? comments.at(-1) : null;
    findings.push({
      source: "review-thread",
      author: authorLogin(lastComment),
      sha: commitSha(lastComment) ?? commitSha(thread),
      verdict: "UNRESOLVED",
      threadId: thread?.id ?? null,
    });
  }

  const cleanReviewers = new Set(clean.map((record) => lower(record.author)));
  const missingReviewers = [...required].filter(
    (reviewer) => !cleanReviewers.has(reviewer),
  );
  const evidence = [
    ...clean,
    ...findings,
    ...stale,
    ...indeterminate,
    ...timeout,
  ];
  const common = { ...base, evidence, findings, missingReviewers };

  if (timeout.length > 0)
    return {
      ...common,
      status: "timeout",
      reasons: ["a required reviewer reported a timeout"],
    };
  if (clean.length > 0 && (findings.length > 0 || indeterminate.length > 0)) {
    return {
      ...common,
      status: "mixed",
      reasons: [
        "current-head review evidence has conflicting or indeterminate outcomes",
      ],
    };
  }
  if (findings.length > 0)
    return {
      ...common,
      status: "findings",
      reasons: ["current review findings remain"],
    };
  if (indeterminate.length > 0)
    return {
      ...common,
      status: "empty",
      reasons: ["required review evidence has no recognized verdict"],
    };
  if (missingReviewers.length > 0 && stale.length > 0) {
    return {
      ...common,
      status: "stale",
      reasons: ["required review evidence targets a different head"],
    };
  }
  if (missingReviewers.length > 0) {
    return {
      ...common,
      status: "missing",
      reasons: [
        `missing a clean current-head outcome from: ${missingReviewers.join(", ")}`,
      ],
    };
  }
  return { ...common, ok: true, status: "clean", reasons: [] };
}

function signalProcessTree(child, signal) {
  try {
    if (process.platform !== "win32" && child.pid)
      process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function run(command, args, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout, stderr });
    };
    const timer = setTimeout(() => {
      signalProcessTree(child, "SIGTERM");
      setTimeout(() => signalProcessTree(child, "SIGKILL"), 250).unref();
      finish({
        ok: false,
        timedOut: true,
        reason: `timeout after ${timeoutMs}ms`,
      });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => finish({ ok: false, reason: error.message }));
    child.on("close", (exitCode, signal) =>
      finish({
        ok: exitCode === 0,
        exitCode,
        reason:
          exitCode === 0
            ? null
            : `exit ${exitCode ?? "unknown"}${signal ? ` (${signal})` : ""}`,
      }),
    );
  });
}

async function ghJson(args, options) {
  const result = await run(process.env.GITHUB_CLI ?? "gh", args, {
    cwd: options.repoRoot,
    timeoutMs: options.timeoutMs,
  });
  if (!result.ok) {
    const error = new Error(
      result.timedOut
        ? result.reason
        : `${result.reason}${result.stderr.trim() ? `: ${result.stderr.trim()}` : ""}`,
    );
    error.timedOut = result.timedOut;
    throw error;
  }
  if (result.stdout.trim() === "") {
    const error = new Error("GitHub returned an empty response");
    error.emptyResponse = true;
    throw error;
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`GitHub returned invalid JSON: ${error.message}`);
  }
}

async function readLiveHead(options) {
  const value = await ghJson(
    ["api", `repos/${options.repo}/pulls/${options.pr}`],
    options,
  );
  const sha = value?.head?.sha;
  if (!/^[0-9a-f]{7,64}$/i.test(sha ?? ""))
    throw new Error("GitHub PR response has no valid head SHA");
  return sha;
}

const QUERIES = {
  formalReviews: `query($owner:String!,$repo:String!,$pr:Int!,$pageSize:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$pr){reviews(first:$pageSize,after:$cursor){nodes{author{login} state submittedAt commit{oid}} pageInfo{hasNextPage endCursor}}}}}`,
  reviewThreads: `query($owner:String!,$repo:String!,$pr:Int!,$pageSize:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$pr){reviewThreads(first:$pageSize,after:$cursor){nodes{id isResolved comments(last:1){nodes{author{login} createdAt commit{oid}}}} pageInfo{hasNextPage endCursor}}}}}`,
  issueComments: `query($owner:String!,$repo:String!,$pr:Int!,$pageSize:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$pr){comments(first:$pageSize,after:$cursor){nodes{author{login} body createdAt} pageInfo{hasNextPage endCursor}}}}}`,
};

async function fetchCollection(name, policy, options) {
  const [owner, repo] = options.repo.split("/");
  const items = [];
  let cursor = null;
  for (let page = 0; page < policy.audit.maxPages; page += 1) {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${QUERIES[name]}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `repo=${repo}`,
      "-F",
      `pr=${options.pr}`,
      "-F",
      `pageSize=${policy.audit.pageSize}`,
    ];
    if (cursor) args.push("-f", `cursor=${cursor}`);
    let payload;
    try {
      payload = await ghJson(args, options);
    } catch (error) {
      if (error.timedOut) return { items, timedOut: true };
      if (error.emptyResponse) return { items, emptyResponse: true };
      throw error;
    }
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      throw new Error(
        `GitHub GraphQL error while reading ${name}: ${payload.errors.map((entry) => entry.message).join("; ")}`,
      );
    }
    const connection =
      payload?.data?.repository?.pullRequest?.[
        name === "formalReviews"
          ? "reviews"
          : name === "issueComments"
            ? "comments"
            : "reviewThreads"
      ];
    if (
      !connection ||
      !Array.isArray(connection.nodes) ||
      !connection.pageInfo
    ) {
      return { items, emptyResponse: true };
    }
    if (name === "reviewThreads") {
      items.push(
        ...connection.nodes.map((thread) => ({
          ...thread,
          comments: thread.comments?.nodes ?? [],
        })),
      );
    } else {
      items.push(...connection.nodes);
    }
    if (!connection.pageInfo.hasNextPage) return { items, truncated: false };
    cursor = connection.pageInfo.endCursor;
    if (!cursor) return { items, truncated: true };
  }
  return { items, truncated: true };
}

async function loadLiveInput(policy, options) {
  const preHeadSha = await readLiveHead(options);
  const formalReviews = await fetchCollection("formalReviews", policy, options);
  const reviewThreads = await fetchCollection("reviewThreads", policy, options);
  const issueComments = await fetchCollection("issueComments", policy, options);
  const postHeadSha = await readLiveHead(options);
  return {
    preHeadSha,
    postHeadSha,
    formalReviews,
    reviewThreads,
    issueComments,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  options.repoRoot = process.cwd();
  const policyPath = path.resolve(
    options.repoRoot,
    options.policy ?? ".github/review-policy.json",
  );
  const policy = await loadReviewPolicy(policyPath);
  let input;
  if (options.fixture) {
    input = JSON.parse(
      await readFile(path.resolve(options.repoRoot, options.fixture), "utf8"),
    );
  } else {
    input = await loadLiveInput(policy, options);
  }
  const result = {
    ...auditFeedback(policy, input, options.headsha),
    repo: options.repo,
    pr: Number(options.pr),
    policyPath,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    const status = error.timedOut
      ? "timeout"
      : error.emptyResponse
        ? "empty"
        : "error";
    console.log(
      JSON.stringify({ ok: false, status, error: error.message }, null, 2),
    );
    process.exitCode = 1;
  });
}
