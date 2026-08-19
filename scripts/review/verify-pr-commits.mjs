#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_POLICY_PATH = ".github/review-policy.json";
const DEFAULT_COMMIT_INTEGRITY_POLICY = Object.freeze({
  acceptedSignatureTypes: Object.freeze(["GpgSignature", "SshSignature"]),
  dcoExemptBots: Object.freeze([]),
});

const COMMITS_QUERY = `query($owner:String!,$repo:String!,$pr:Int!,$pageSize:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$pr){headRefOid commits(first:$pageSize,after:$cursor){totalCount nodes{commit{oid message author{name email user{login}} signature{__typename isValid state signature signer{login}}}} pageInfo{hasNextPage endCursor}}}}}`;
const HEAD_QUERY = `query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){headRefOid}}}`;

function usage() {
  return `Usage: verify-pr-commits.mjs --repo <owner/name> --pr <number> --head-sha <sha> [options]

Verify the GitHub signature state and terminal DCO trailer of every commit in a
pull request. The result is valid only for the supplied exact head SHA.

Options:
  --policy <path>       Trusted review policy (default: ${DEFAULT_POLICY_PATH})
  --page-size <number>  GraphQL page size (default: ${DEFAULT_PAGE_SIZE}, max: 100)
  --max-pages <number>  Fail-closed pagination cap (default: ${DEFAULT_MAX_PAGES})
  -h, --help            Show this help
`;
}

function positiveInt(value, name, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    pageSize: DEFAULT_PAGE_SIZE,
    maxPages: DEFAULT_MAX_PAGES,
    policyPath: DEFAULT_POLICY_PATH,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (!arg.startsWith("--")) throw new Error(`unexpected argument: ${arg}`);
    const value = argv[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`${arg} requires a value`);
    if (arg === "--repo") options.repo = value;
    else if (arg === "--pr") options.pr = positiveInt(value, "--pr");
    else if (arg === "--head-sha") options.expectedHeadSha = value;
    else if (arg === "--policy") options.policyPath = value;
    else if (arg === "--page-size")
      options.pageSize = positiveInt(value, "--page-size", 100);
    else if (arg === "--max-pages")
      options.maxPages = positiveInt(value, "--max-pages");
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo ?? "")) {
    throw new Error("--repo must be owner/name");
  }
  const [owner, repo] = options.repo.split("/");
  if (owner === "." || owner === ".." || repo === "." || repo === "..") {
    throw new Error("--repo must be owner/name");
  }
  if (!options.pr) throw new Error("--pr is required");
  if (!/^[0-9a-f]{7,64}$/i.test(options.expectedHeadSha ?? "")) {
    throw new Error("--head-sha must be a git SHA");
  }
  return options;
}

function sameSha(left, right) {
  return String(left ?? "").toLowerCase() === String(right ?? "").toLowerCase();
}

function terminalSignoffs(message) {
  const lines = String(message ?? "")
    .replaceAll("\r\n", "\n")
    .split("\n");
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();
  const trailerLines = [];
  while (lines.length > 0 && /^[A-Za-z0-9-]+:\s+.+$/.test(lines.at(-1)))
    trailerLines.unshift(lines.pop());
  return trailerLines.flatMap((line) => {
    const match = /^Signed-off-by:\s+(.+?)\s+<([^<>\s]+@[^<>\s]+)>\s*$/i.exec(
      line,
    );
    return match
      ? [{ name: match[1].trim(), email: match[2].toLowerCase() }]
      : [];
  });
}

function normalizeCommitIntegrityPolicy(policy) {
  const acceptedSignatureTypes = policy?.acceptedSignatureTypes;
  const dcoExemptBots = policy?.dcoExemptBots;
  if (
    !Array.isArray(acceptedSignatureTypes) ||
    acceptedSignatureTypes.length === 0 ||
    acceptedSignatureTypes.some(
      (type) =>
        typeof type !== "string" ||
        !/^[A-Za-z][A-Za-z0-9]*Signature$/.test(type),
    )
  ) {
    throw new Error(
      "commit integrity policy must define a non-empty acceptedSignatureTypes array",
    );
  }
  if (
    !Array.isArray(dcoExemptBots) ||
    dcoExemptBots.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        typeof entry.authorLogin !== "string" ||
        !/^[A-Za-z0-9-]+\[bot\]$/.test(entry.authorLogin) ||
        !Array.isArray(entry.signatureSignerLogins) ||
        entry.signatureSignerLogins.length === 0 ||
        entry.signatureSignerLogins.some(
          (login) =>
            typeof login !== "string" ||
            !/^[A-Za-z0-9-]+(?:\[bot\])?$/.test(login),
        ),
    )
  ) {
    throw new Error(
      "commit integrity policy must define dcoExemptBots with bot authorLogin and non-empty signatureSignerLogins",
    );
  }
  return {
    acceptedSignatureTypes: [...new Set(acceptedSignatureTypes)],
    dcoExemptBots: dcoExemptBots.map((entry) => ({
      authorLogin: entry.authorLogin.toLowerCase(),
      signatureSignerLogins: [
        ...new Set(
          entry.signatureSignerLogins.map((login) => login.toLowerCase()),
        ),
      ],
    })),
  };
}

export async function loadCommitIntegrityPolicy(policyPath) {
  let raw;
  try {
    raw = await readFile(policyPath, "utf8");
  } catch (error) {
    throw new Error(
      `could not read commit integrity policy at ${policyPath}: ${error.message}`,
    );
  }
  let document;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `commit integrity policy at ${policyPath} is invalid JSON: ${error.message}`,
    );
  }
  if (document?.version !== 1 || !document.commitIntegrity) {
    throw new Error(
      `commit integrity policy at ${policyPath} must define version 1 and commitIntegrity`,
    );
  }
  return normalizeCommitIntegrityPolicy(document.commitIntegrity);
}

export function evaluateCommitIntegrity(
  commits,
  policy = DEFAULT_COMMIT_INTEGRITY_POLICY,
) {
  const normalizedPolicy = normalizeCommitIntegrityPolicy(policy);
  const acceptedTypes = new Set(normalizedPolicy.acceptedSignatureTypes);
  const dcoExemptBots = new Map(
    normalizedPolicy.dcoExemptBots.map((entry) => [
      entry.authorLogin,
      new Set(entry.signatureSignerLogins),
    ]),
  );
  return commits.map((commit) => {
    const failures = [];
    const exemptions = [];
    if (commit?.signature?.isValid !== true) {
      failures.push({
        type: "signature",
        reason: `GitHub signature verification is not valid${commit?.signature?.state ? ` (${commit.signature.state})` : ""}`,
      });
    } else if (!acceptedTypes.has(commit?.signature?.__typename)) {
      failures.push({
        type: "signature",
        reason: `GitHub signature type ${commit?.signature?.__typename ?? "missing"} is not allowed (accepted: ${normalizedPolicy.acceptedSignatureTypes.join(", ")})`,
      });
    }

    const authorLogin = String(commit?.author?.user?.login ?? "")
      .trim()
      .toLowerCase();
    const signatureSignerLogin = String(commit?.signature?.signer?.login ?? "")
      .trim()
      .toLowerCase();
    if (
      authorLogin &&
      signatureSignerLogin &&
      dcoExemptBots.get(authorLogin)?.has(signatureSignerLogin)
    ) {
      exemptions.push({
        type: "dco",
        authorLogin,
        signatureSignerLogin,
        reason: `DCO trailer requirement is exempt for policy-listed bot ${authorLogin} signed by ${signatureSignerLogin}`,
      });
    } else {
      const signoffs = terminalSignoffs(commit?.message);
      const authorName = String(commit?.author?.name ?? "").trim();
      const authorEmail = String(commit?.author?.email ?? "")
        .trim()
        .toLowerCase();
      if (signoffs.length === 0) {
        failures.push({
          type: "dco",
          reason:
            "terminal trailer block has no Signed-off-by: Name <email> trailer",
        });
      } else if (
        !authorName ||
        !authorEmail ||
        !signoffs.some(
          (signoff) =>
            signoff.name === authorName && signoff.email === authorEmail,
        )
      ) {
        failures.push({
          type: "dco",
          reason:
            "Signed-off-by trailer does not match commit author name and email",
        });
      }
    }
    return {
      sha: commit?.oid ?? null,
      ok: failures.length === 0,
      failures,
      exemptions,
    };
  });
}

function flattenFailures(commits) {
  return commits.flatMap((commit) =>
    commit.failures.map((failure) => ({ ...failure, sha: commit.sha })),
  );
}

function apiFailure(reason) {
  return {
    ok: false,
    status: "error",
    commitCount: 0,
    pagesFetched: 0,
    commits: [],
    failures: [{ type: "api", reason }],
  };
}

function parseGraphqlResponse(response) {
  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    throw new Error(
      response.errors
        .map((entry) => entry.message ?? "unknown GraphQL error")
        .join("; "),
    );
  }
  const pullRequest = response?.data?.repository?.pullRequest;
  if (
    !pullRequest?.commits ||
    !Array.isArray(pullRequest.commits.nodes) ||
    !pullRequest.commits.pageInfo
  ) {
    throw new Error("missing pull request commit data");
  }
  return pullRequest;
}

export async function verifyPullRequestCommits({
  repo,
  pr,
  expectedHeadSha,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
  policy = DEFAULT_COMMIT_INTEGRITY_POLICY,
  requestGraphql = defaultGraphqlRequest,
}) {
  const [owner, name] = repo.split("/");
  const variables = {
    owner,
    repo: name,
    pr: Number(pr),
    pageSize,
    cursor: null,
  };
  const commits = [];
  const failures = [];
  let pagesFetched = 0;
  let expectedTotal = null;
  let cursor = null;
  let firstHeadSha = null;
  let truncated = false;

  try {
    while (pagesFetched < maxPages) {
      const pullRequest = parseGraphqlResponse(
        await requestGraphql(COMMITS_QUERY, { ...variables, cursor }),
      );
      pagesFetched += 1;
      firstHeadSha ??= pullRequest.headRefOid;
      expectedTotal ??= pullRequest.commits.totalCount;
      commits.push(...pullRequest.commits.nodes.map((node) => node.commit));
      if (!pullRequest.commits.pageInfo.hasNextPage) break;
      cursor = pullRequest.commits.pageInfo.endCursor;
      if (!cursor) {
        failures.push({
          type: "pagination",
          reason: "GitHub reported another commit page without a cursor",
        });
        break;
      }
      if (pagesFetched >= maxPages) truncated = true;
    }
  } catch (error) {
    return apiFailure(error instanceof Error ? error.message : String(error));
  }

  if (!sameSha(firstHeadSha, expectedHeadSha)) {
    failures.push({
      type: "head",
      phase: "pre-fetch",
      reason: `PR head ${firstHeadSha ?? "missing"} does not match expected ${expectedHeadSha}`,
    });
  }
  if (truncated)
    failures.push({
      type: "pagination",
      reason: `commit pagination was truncated after ${maxPages} page(s)`,
    });
  if (Number.isInteger(expectedTotal) && expectedTotal !== commits.length) {
    failures.push({
      type: "pagination",
      reason: `GitHub reported ${expectedTotal} commits but fetched ${commits.length}`,
    });
  }
  if (commits.length === 0)
    failures.push({
      type: "empty",
      reason: "pull request contains no verifiable commits",
    });

  let postHeadSha = null;
  try {
    const response = await requestGraphql(HEAD_QUERY, {
      owner,
      repo: name,
      pr: Number(pr),
    });
    if (Array.isArray(response?.errors) && response.errors.length > 0) {
      throw new Error(
        response.errors
          .map((entry) => entry.message ?? "unknown GraphQL error")
          .join("; "),
      );
    }
    postHeadSha = response?.data?.repository?.pullRequest?.headRefOid;
    if (!postHeadSha) throw new Error("missing post-fetch pull request head");
  } catch (error) {
    failures.push({
      type: "api",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  if (postHeadSha && !sameSha(postHeadSha, expectedHeadSha)) {
    failures.push({
      type: "head",
      phase: "post-fetch",
      reason: `PR head ${postHeadSha} does not match expected ${expectedHeadSha}`,
    });
  }

  const evaluated = evaluateCommitIntegrity(commits, policy);
  failures.push(...flattenFailures(evaluated));
  const status = failures.some((failure) => failure.type === "api")
    ? "error"
    : failures.some((failure) => failure.type === "empty")
      ? "empty"
      : failures.length > 0
        ? "blocked"
        : "clean";
  return {
    ok: failures.length === 0,
    status,
    repo,
    pr: Number(pr),
    expectedHeadSha,
    observedHeadSha: postHeadSha,
    pagesFetched,
    commitCount: commits.length,
    commits: evaluated,
    failures,
  };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0)
        reject(
          new Error(
            `gh api graphql failed with exit ${code}: ${stderr.trim()}`,
          ),
        );
      else resolve(stdout);
    });
  });
}

export async function defaultGraphqlRequest(query, variables) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    if (value === null || value === undefined) continue;
    args.push(typeof value === "number" ? "-F" : "-f", `${key}=${value}`);
  }
  const stdout = await run(process.env.GITHUB_CLI ?? "gh", args);
  if (stdout.trim() === "")
    throw new Error("GitHub GraphQL returned an empty response");
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`GitHub GraphQL returned invalid JSON: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const policy = await loadCommitIntegrityPolicy(options.policyPath);
  const result = await verifyPullRequestCommits({ ...options, policy });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ ok: false, status: "error", error: error.message })}\n`,
    );
    process.exitCode = 1;
  });
}
