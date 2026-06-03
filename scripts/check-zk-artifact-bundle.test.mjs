#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checkerScript = path.join(repoRoot, "scripts/check-zk-artifact-bundle.mjs");

const sha256 = (filePath) =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const withTempDir = (callback) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "did-zk-check-test-"));
  try {
    return callback(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
};

const archiveContent = (tempRoot, contentRoot) => {
  const archivePath = path.join(tempRoot, "bundle.tar.gz");
  execFileSync("tar", ["-czf", archivePath, "-C", contentRoot, "."], {
    cwd: repoRoot,
    stdio: "pipe",
  });
  return archivePath;
};

const runChecker = (archivePath) =>
  spawnSync(process.execPath, [checkerScript, archivePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const runCheckerWithDoubleDash = (archivePath) =>
  spawnSync(process.execPath, [checkerScript, "--", archivePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const writeFixtureFile = (contentRoot, relativePath, content) => {
  const filePath = path.join(contentRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
};

const writeValidBundle = (tempRoot) => {
  const contentRoot = path.join(tempRoot, "content");
  fs.mkdirSync(contentRoot);

  const files = {
    prover: "keys/add.prover",
    verifier: "keys/add.verifier",
    zkir: "zkir/add.bzkir",
  };
  const sourceFiles = {
    prover: writeFixtureFile(contentRoot, files.prover, "prover-key"),
    verifier: writeFixtureFile(contentRoot, files.verifier, "verifier-key"),
    zkir: writeFixtureFile(contentRoot, files.zkir, "zkir"),
  };

  const manifest = {
    schema: "midnight-did-zk-artifacts",
    schemaVersion: 1,
    circuits: [
      {
        id: "add",
        files,
        sha256: Object.fromEntries(
          Object.entries(sourceFiles).map(([kind, filePath]) => [
            kind,
            sha256(filePath),
          ]),
        ),
        bytes: Object.fromEntries(
          Object.entries(sourceFiles).map(([kind, filePath]) => [
            kind,
            fs.statSync(filePath).size,
          ]),
        ),
      },
    ],
  };
  fs.writeFileSync(
    path.join(contentRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return archiveContent(tempRoot, contentRoot);
};

test("check-zk-artifact-bundle accepts a valid provider bundle", () =>
  withTempDir((tempRoot) => {
    const result = runChecker(writeValidBundle(tempRoot));

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 circuits verified/u);
  }));

test("check-zk-artifact-bundle accepts pnpm-style -- argument passthrough", () =>
  withTempDir((tempRoot) => {
    const result = runCheckerWithDoubleDash(writeValidBundle(tempRoot));

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 circuits verified/u);
  }));

test("check-zk-artifact-bundle reports a missing manifest even with earlier entry errors", () =>
  withTempDir((tempRoot) => {
    const contentRoot = path.join(tempRoot, "content");
    fs.mkdirSync(contentRoot);
    writeFixtureFile(contentRoot, "unexpected.txt", "not a provider bundle");

    const result = runChecker(archiveContent(tempRoot, contentRoot));
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 1, output);
    assert.match(output, /unexpected tar entry: unexpected\.txt/u);
    assert.match(output, /missing manifest\.json/u);
  }));
