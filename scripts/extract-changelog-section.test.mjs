#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extractor = path.join(repoRoot, "scripts/extract-changelog-section.mjs");
const expectedBody = "### Changed\n\n- Reviewed release note.\n";

function changelog({
  heading = "## [0.6.0] - 2026-09-18",
  body = expectedBody,
  unreleased = "## [Unreleased]\n\n",
} = {}) {
  return `# Changelog\n\n${unreleased}${heading}\n\n${body}\n## [0.5.0] - 2026-08-03\n\n### Added\n\n- Older note.\n`;
}

function fixture(source = changelog()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "did-changelog-test-"));
  fs.mkdirSync(path.join(root, "dist"));
  fs.writeFileSync(path.join(root, "CHANGELOG.md"), source);
  return root;
}

function run(root, { version = "0.6.0", output = "dist/notes.md" } = {}) {
  return spawnSync(
    process.execPath,
    [extractor, "--version", version, "--output-file", output],
    { cwd: root, encoding: "utf8" },
  );
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("extracts the exact base-version body for RC and final release notes", async (t) => {
  for (const [name, heading, unreleased] of [
    ["RC from versioned Unreleased", "## [0.6.0] - Unreleased", ""],
    [
      "final from dated section with standard Unreleased section",
      "## [0.6.0] - 2026-09-14",
      "## [Unreleased]\n\n",
    ],
  ]) {
    await t.test(name, () => {
      const root = fixture(changelog({ heading, unreleased }));
      try {
        const result = run(root);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(
          fs.readFileSync(path.join(root, "dist/notes.md"), "utf8"),
          expectedBody,
        );
      } finally {
        cleanup(root);
      }
    });
  }
});

test("fails closed for missing, duplicate, empty, and malformed sections", async (t) => {
  const cases = [
    ["missing", changelog(), { version: "0.7.0" }],
    [
      "duplicate",
      `${changelog()}\n## [0.6.0] - 2026-09-14\n\n${expectedBody}`,
      {},
    ],
    ["empty", changelog({ body: "" }), {}],
    ["heading-only", changelog({ body: "### Changed\n" }), {}],
    ["bad target heading", changelog({ heading: "## 0.6.0 - Unreleased" }), {}],
    [
      "duplicate target with standard Unreleased present",
      `${changelog()}\n## [0.6.0] - 2026-09-19\n\n${expectedBody}`,
      {},
    ],
    [
      "duplicate standard Unreleased section",
      changelog({ unreleased: "## [Unreleased]\n\n## [Unreleased]\n\n" }),
      {},
    ],
    ["unexpected boundary", `${changelog()}\n## Security notes\n`, {}],
    ["invalid date", changelog({ heading: "## [0.6.0] - 2026-02-30" }), {}],
    ["control character", changelog().replace("Reviewed", "Reviewed\r"), {}],
  ];
  for (const [name, source, options] of cases) {
    await t.test(name, () => {
      const root = fixture(source);
      try {
        const result = run(root, options);
        assert.notEqual(result.status, 0);
        assert.equal(fs.existsSync(path.join(root, "dist/notes.md")), false);
      } finally {
        cleanup(root);
      }
    });
  }
});

test("rejects invalid versions and shell or option injection without execution", async (t) => {
  for (const version of [
    "v0.6.0",
    "0.6.0-rc1",
    "0.6.0\n## [9.9.9] - Unreleased",
    "0.6.0;touch injected",
    "$(touch injected)",
    "--help",
  ]) {
    await t.test(JSON.stringify(version), () => {
      const root = fixture();
      try {
        const result = run(root, { version });
        assert.notEqual(result.status, 0);
        assert.equal(fs.existsSync(path.join(root, "injected")), false);
      } finally {
        cleanup(root);
      }
    });
  }
});

test("rejects unsafe, missing-parent, symlink, and injection output paths", async (t) => {
  const root = fixture();
  const outside = path.join(path.dirname(root), "outside-notes.md");
  const marker = path.join(root, "injected");
  fs.symlinkSync(path.dirname(root), path.join(root, "linked"));
  fs.symlinkSync(outside, path.join(root, "dist/symlink.md"));
  try {
    for (const output of [
      outside,
      "../outside-notes.md",
      "missing/notes.md",
      "linked/notes.md",
      "dist/symlink.md",
      "dist/notes.txt",
      "dist/notes.md;touch-injected.md",
      "$(touch injected).md",
      "--notes.md",
      "CHANGELOG.md",
    ]) {
      const result = run(root, { output });
      assert.notEqual(result.status, 0, output);
    }
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.existsSync(outside), false);
  } finally {
    cleanup(root);
    fs.rmSync(outside, { force: true });
  }
});
