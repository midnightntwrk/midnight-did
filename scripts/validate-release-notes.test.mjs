#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readCanonicalReleaseNotes } from "./validate-release-notes.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "did-release-notes-"));
  return { notes: path.join(root, "notes.md"), root };
}

test("accepts valid UTF-8 with LF and exactly one terminal newline", () => {
  const item = fixture();
  try {
    fs.writeFileSync(item.notes, "### Changed\n\n- Reviewed.\n");
    assert.equal(
      readCanonicalReleaseNotes(item.notes),
      "### Changed\n\n- Reviewed.\n",
    );
  } finally {
    fs.rmSync(item.root, { force: true, recursive: true });
  }
});

test("rejects non-canonical release-note bytes", async (t) => {
  const cases = [
    ["invalid UTF-8", Buffer.from([0x23, 0x20, 0xc3, 0x28, 0x0a])],
    ["CRLF", Buffer.from("### Changed\r\n", "utf8")],
    ["missing terminal newline", Buffer.from("### Changed", "utf8")],
    ["repeated terminal newline", Buffer.from("### Changed\n\n", "utf8")],
  ];
  for (const [name, bytes] of cases) {
    await t.test(name, () => {
      const item = fixture();
      try {
        fs.writeFileSync(item.notes, bytes);
        assert.throws(() => readCanonicalReleaseNotes(item.notes));
      } finally {
        fs.rmSync(item.root, { force: true, recursive: true });
      }
    });
  }
});

test("rejects symlinks and non-regular paths", async (t) => {
  await t.test("symlink", () => {
    const item = fixture();
    try {
      const target = path.join(item.root, "target.md");
      fs.writeFileSync(target, "### Changed\n");
      fs.symlinkSync(target, item.notes);
      assert.throws(() => readCanonicalReleaseNotes(item.notes));
    } finally {
      fs.rmSync(item.root, { force: true, recursive: true });
    }
  });
  await t.test("directory", () => {
    const item = fixture();
    try {
      fs.mkdirSync(item.notes);
      assert.throws(() => readCanonicalReleaseNotes(item.notes));
    } finally {
      fs.rmSync(item.root, { force: true, recursive: true });
    }
  });
});
