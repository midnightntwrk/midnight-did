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

test("branch, runtime, local-validation, and exact-head review invariants stay documented", async () => {
  const [agent, ignore, packageJson, policy, prTemplate, contributing] =
    await Promise.all([
      text("AGENT.md"),
      text(".gitignore"),
      JSON.parse(await text("package.json")),
      JSON.parse(await text(".github/review-policy.json")),
      text(".github/pull_request_template.md"),
      text("CONTRIBUTING.md"),
    ]);
  assert.match(agent, /origin\/develop.*normal feature integration base/);
  assert.match(agent, /main.*default.*release branch/);
  assert.match(agent, /existing PR.*actual base/i);
  assert.match(agent, /records only `requested`/);
  assert.match(agent, /audit-pr-feedback\.mjs/);
  assert.match(agent, /verify every commit in the PR range/);
  assert.match(agent, /GPG signature/);
  assert.match(agent, /Every commit, including automation-authored commits/);
  assert.doesNotMatch(agent, /GPG or SSH signature/);
  assert.doesNotMatch(agent, /Policy-listed dependency bots/);
  assert.match(contributing, /Every PR commit, including automation-authored commits/);
  assert.doesNotMatch(contributing, /GPG or SSH signature/);
  assert.doesNotMatch(contributing, /exempt from the human DCO/);
  assert.match(prTemplate, /This PR starts as a draft/);
  assert.match(prTemplate, /Validate the current head first/);
  assert.match(prTemplate, /not put a review verdict, CI outcome, or copied SHA-bound evidence/);
  assert.match(packageJson.scripts.verify, /coverage:all/);
  for (const runtimePath of [
    "/.pi-subagents/",
    "/.pi/runner-coordination/",
    "/.pi/dev-loop-retrospective-checkpoint.json",
  ]) {
    assert.match(ignore, new RegExp(runtimePath.replaceAll("/", "\\/")));
  }
  assert.deepEqual(policy.audit.requiredReviewerLogins, ["patextreme"]);
  assert.deepEqual(policy.commitIntegrity.acceptedSignatureTypes, ["GpgSignature"]);
  assert.equal(Object.hasOwn(policy.commitIntegrity, "dcoExemptBots"), false);
});
