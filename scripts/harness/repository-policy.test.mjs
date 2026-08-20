import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function text(relative) {
  return readFile(path.join(root, relative), "utf8");
}

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

test("pnpm supply-chain policy stays strict with only reviewed exact-version exclusions", async () => {
  const workspace = await text("pnpm-workspace.yaml");
  assert.match(workspace, /^trustPolicy: no-downgrade$/m);

  const exclusions = workspace.match(
    /^trustPolicyExclude:\n((?: {2}.*(?:\n|$))*)/m,
  );
  assert.ok(exclusions, "trustPolicyExclude must remain explicit");
  assert.deepEqual(
    [...exclusions[1].matchAll(/^  - (\S+)$/gm)].map((match) => match[1]),
    ["tinyexec@1.2.2", "pino@9.14.0"],
  );
  assert.match(
    exclusions[1],
    /pino@9\.14\.0[\s\S]*already-locked[\s\S]*integrity matches npm[\s\S]*signed upstream tag commit 339f1d6c899fa584324e15c587fbd811664dd07c[\s\S]*lacks[\s\S]*trusted-publisher provenance used by pino@9\.13\.1/,
  );
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
