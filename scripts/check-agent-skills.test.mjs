import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { checkAgentSkills } from "./check-agent-skills.mjs";

async function writeSkill(root, harness, content) {
  const directory = path.join(root, `.${harness}`, "skills", "example");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "SKILL.md"), content);
}

test("accepts byte-identical Codex and Claude skill mirrors", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skill-sync-"));
  try {
    await writeSkill(root, "codex", "# Same\n");
    await writeSkill(root, "claude", "# Same\n");
    assert.equal((await checkAgentSkills(root)).ok, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails on changed or missing mirror content", async (t) => {
  await t.test("different bytes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "skill-drift-"));
    try {
      await writeSkill(root, "codex", "# Codex\n");
      await writeSkill(root, "claude", "# Claude\n");
      const result = await checkAgentSkills(root);
      assert.equal(result.ok, false);
      assert.match(result.mismatches.join("; "), /copies differ/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await t.test("missing side", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "skill-missing-"));
    try {
      await writeSkill(root, "codex", "# Only\n");
      const result = await checkAgentSkills(root);
      assert.equal(result.ok, false);
      assert.match(result.mismatches.join("; "), /claude/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
