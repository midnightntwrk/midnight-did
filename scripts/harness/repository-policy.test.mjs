import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { load as loadYaml } from "js-yaml";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function text(relative) {
  return readFile(path.join(root, relative), "utf8");
}

function shellTokens(command) {
  return [
    ...command.matchAll(
      /\r?\n|&&|\|\||[;&|]|"(?:\\.|[^"\\])*"|'[^']*'|[^\s;&|]+/g,
    ),
  ].map(([token]) =>
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
      ? token.slice(1, -1)
      : token,
  );
}

function githubActionsRunCommands(workflow) {
  const document = loadYaml(workflow);
  if (document == null || typeof document !== "object") return [];

  const jobs = document.jobs;
  if (jobs == null || typeof jobs !== "object") return [];

  const commands = [];
  for (const job of Object.values(jobs)) {
    if (job == null || typeof job !== "object" || !Array.isArray(job.steps)) {
      continue;
    }
    for (const step of job.steps) {
      if (
        step != null &&
        typeof step === "object" &&
        typeof step.run === "string"
      ) {
        commands.push(step.run);
      }
    }
  }
  return commands;
}

function shellCommandContainsGlobalNpmInstall(command) {
  const tokens = shellTokens(command.replaceAll(/\\\r?\n/g, " "));
  const separators = new Set(["\n", "&&", "||", ";", "&", "|"]);
  const controlPrefixes = new Set([
    "!",
    "(",
    "{",
    "do",
    "elif",
    "else",
    "if",
    "then",
    "until",
    "while",
  ]);

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== "npm") continue;
    let start = index - 1;
    while (start >= 0 && !separators.has(tokens[start])) start -= 1;
    const prefix = tokens.slice(start + 1, index);
    const commandPrefix = prefix.filter(
      (token) =>
        token !== "-" &&
        !controlPrefixes.has(token) &&
        !/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(token),
    );
    if (commandPrefix.length > 0) continue;

    const relativeEnd = tokens
      .slice(index + 1)
      .findIndex((token) => separators.has(token));
    const end = relativeEnd === -1 ? tokens.length : index + 1 + relativeEnd;
    const args = tokens.slice(index + 1, end);
    if (!args.some((arg) => arg === "install" || arg === "i")) continue;

    if (
      args.some(
        (arg) =>
          arg === "-g" ||
          arg === "--global" ||
          /^--global=(?:true|1)$/i.test(arg) ||
          /^--location=global$/i.test(arg),
      )
    ) {
      return true;
    }
    if (
      args.some(
        (arg, argIndex) =>
          arg === "--location" &&
          args[argIndex + 1]?.toLowerCase() === "global",
      )
    ) {
      return true;
    }
  }

  return false;
}

function containsGlobalNpmInstall(workflow) {
  return githubActionsRunCommands(workflow).some(
    shellCommandContainsGlobalNpmInstall,
  );
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function nanoid3OverrideFloor(range) {
  const trimmed = String(range ?? "").trim();
  const bounded = /^(?:\^|~)?(3\.\d+\.\d+)$/.exec(trimmed);
  if (bounded) return bounded[1];
  const explicit = /^>=\s*(3\.\d+\.\d+)\s+<\s*4(?:\.0\.0)?$/.exec(trimmed);
  return explicit?.[1] ?? null;
}

function resolvedNanoid3Versions(lockfile) {
  return [
    ...new Set(
      [...lockfile.matchAll(/^  nanoid@(3\.\d+\.\d+)(?:\([^\n]*\))?:$/gm)].map(
        ([, version]) => version,
      ),
    ),
  ];
}

function workflowWithRunScalar(runScalar) {
  return `jobs:\n  check:\n    steps:\n      - name: Check\n        ${runScalar.replaceAll("\n", "\n        ")}\n`;
}

test("detects global npm installs in parsed GitHub Actions run scalars", () => {
  for (const runScalar of [
    "run: npm install -g npm@12",
    'run: "npm install -g npm@12"',
    'run: "npm install -g npm@12" # trailing comment',
    "run: 'npm install -g npm@12'",
    "run: if npm install -g npm@12; then echo installed; fi",
    "run: npm install --silent -g npm@12",
    "run: npm i --global npm@12",
    "run: npm --global install npm@12",
    "run: npm install --global=true npm@12",
    "run: npm install --location=global npm@12",
    "run: npm i --location global npm@12",
    "run: echo ready && npm --silent i --location=GLOBAL npm@12",
    "run: |\n  echo ready\n  npm install -g npm@12",
    "run: |2-\n  npm install -g npm@12",
    "run: |-2\n  npm install -g npm@12",
    "run: >-\n  if npm install -g npm@12; then\n  echo installed; fi",
    "run: >-\n  echo ready\n    npm install -g npm@12",
  ]) {
    const workflow = workflowWithRunScalar(runScalar);
    assert.equal(containsGlobalNpmInstall(workflow), true, runScalar);
  }

  for (const runScalar of [
    "run: pnpm install --frozen-lockfile",
    "run: npm install",
    "run: npm install --global=false package",
    "run: npm install --location=project package",
    'run: "echo npm install -g" # trailing comment',
    "run: 'printf npm install -g'",
    "run: |2-\n  echo 'npm install -g npm@12'\n  pnpm install",
    "run: >-\n  echo ready\n    printf 'npm install -g npm@12'",
  ]) {
    const workflow = workflowWithRunScalar(runScalar);
    assert.equal(containsGlobalNpmInstall(workflow), false, runScalar);
  }
});

test("scans only jobs.*.steps[].run string values", () => {
  const workflow = `
run: npm install -g npm@12
jobs:
  ignored:
    run: npm install -g npm@12
    steps:
      - uses: actions/checkout@immutable
      - run: pnpm install --frozen-lockfile
  reusable:
    uses: owner/repo/.github/workflows/reusable.yml@immutable
`;
  assert.equal(containsGlobalNpmInstall(workflow), false);
});

test("extracts compatible nanoid 3.x floors and compares versions semantically", () => {
  assert.equal(nanoid3OverrideFloor("^3.3.18"), "3.3.18");
  assert.equal(nanoid3OverrideFloor("~3.3.19"), "3.3.19");
  assert.equal(nanoid3OverrideFloor(">=3.3.18 <4"), "3.3.18");
  assert.equal(nanoid3OverrideFloor("^3.3.17"), "3.3.17");
  assert.equal(nanoid3OverrideFloor("*"), null);
  assert.ok(compareVersions("3.3.17", "3.3.18") < 0);
  assert.ok(compareVersions("3.3.19", "3.3.18") > 0);
  assert.ok(compareVersions("3.10.0", "3.3.18") > 0);
  assert.equal(compareVersions("3.3.18", "3.3.18"), 0);
  assert.deepEqual(
    resolvedNanoid3Versions(
      "  nanoid@3.3.18:\n  nanoid@3.3.19:\n  nanoid@5.1.6:\n  nanoid@3.3.18:\n",
    ),
    ["3.3.18", "3.3.19"],
  );
});

test("devloops policy keeps supported explicit routing, provenance, dynamic cost, and mandatory lenses", async () => {
  const config = await text(".devloops");
  assert.match(config, /strategy:\n  default: github-first/);
  assert.match(config, /inputSource:\n  default: tracker/);
  assert.match(config, /maxCopilotRounds: 0/);
  assert.match(config, /requireFanoutProvenance: true/);
  assert.match(config, /dynamicAngles: true/);
  assert.match(
    config,
    /blockCleanOnFindingSeverities:\n      - must-fix\n      - worth-fixing-now/g,
  );
  for (const lens of [
    "pr-description",
    "pr-checklist-matrix",
    "correctness",
    "coverage",
    "security",
    "midnight-did-surface",
  ]) {
    assert.match(config, new RegExp(`- ${lens}`));
  }
  assert.doesNotMatch(config, /external-review/);
  assert.match(config, /independent-review/);
  assert.match(config, /not Pat and not a substitute/);
});

test("code-scanning supply-chain remediations do not regress", async () => {
  const [docsLinkWorkflow, packageJson, lockfile] = await Promise.all([
    text(".github/workflows/docs-link-check.yml"),
    JSON.parse(await text("package.json")),
    text("pnpm-lock.yaml"),
  ]);

  assert.equal(
    containsGlobalNpmInstall(docsLinkWorkflow),
    false,
    "published-docs workflow must not install npm packages globally",
  );

  const safeNanoid3Floor = "3.3.18";
  const overrideFloor = nanoid3OverrideFloor(
    packageJson.pnpm?.overrides?.nanoid,
  );
  assert.ok(
    overrideFloor != null &&
      compareVersions(overrideFloor, safeNanoid3Floor) >= 0,
    `root nanoid override must declare a compatible 3.x floor at or above ${safeNanoid3Floor}`,
  );

  const resolvedVersions = resolvedNanoid3Versions(lockfile);
  assert.ok(resolvedVersions.length > 0, "lockfile must resolve nanoid 3.x");
  for (const version of resolvedVersions) {
    assert.ok(
      compareVersions(version, safeNanoid3Floor) >= 0,
      `resolved nanoid ${version} is below the safe ${safeNanoid3Floor} floor`,
    );
  }
});

test("branch, runtime, local-validation, and exact-head review invariants stay documented", async () => {
  const [agent, ignore, packageJson, policy] = await Promise.all([
    text("AGENT.md"),
    text(".gitignore"),
    JSON.parse(await text("package.json")),
    JSON.parse(await text(".github/review-policy.json")),
  ]);
  assert.match(agent, /origin\/develop.*normal feature integration base/);
  assert.match(agent, /main.*default.*release branch/);
  assert.match(agent, /existing PR.*actual base/i);
  assert.match(agent, /records only `requested`/);
  assert.match(agent, /audit-pr-feedback\.mjs/);
  assert.match(agent, /verify every commit in the PR range/);
  assert.match(agent, /GPG or SSH signature/);
  assert.match(agent, /Policy-listed dependency bots/);
  assert.match(packageJson.scripts.verify, /coverage:all/);
  for (const runtimePath of [
    "/.pi-subagents/",
    "/.pi/runner-coordination/",
    "/.pi/dev-loop-retrospective-checkpoint.json",
  ]) {
    assert.match(ignore, new RegExp(runtimePath.replaceAll("/", "\\/")));
  }
  assert.deepEqual(policy.audit.requiredReviewerLogins, ["patextreme"]);
  assert.deepEqual(policy.commitIntegrity.acceptedSignatureTypes, [
    "GpgSignature",
    "SshSignature",
  ]);
  assert.deepEqual(policy.commitIntegrity.dcoExemptBots, [
    {
      authorLogin: "dependabot[bot]",
      signatureSignerLogins: ["web-flow"],
    },
    {
      authorLogin: "renovate[bot]",
      signatureSignerLogins: ["web-flow"],
    },
  ]);
});
