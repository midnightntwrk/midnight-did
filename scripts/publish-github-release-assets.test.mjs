#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publisher = path.join(
  repoRoot,
  "scripts/publish-github-release-assets.sh",
);
const hostileOutput = "hostile-github-provider-output-must-not-leak";

const fakeGh = `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const root = path.dirname(__dirname);
const statePath = path.join(root, "state.json");
const remote = path.join(root, "remote");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
state.calls.push(args);
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const fail = () => { save(); process.stderr.write(state.hostileOutput); process.exit(1); };
if (args[0] !== "release") fail();
if (args[1] === "view") {
  if (!state.exists) fail();
  if (state.malformedView) { save(); process.stdout.write("{bad-json" + state.hostileOutput); process.exit(0); }
  save();
  process.stdout.write(JSON.stringify({
    isDraft: state.isDraft,
    isPrerelease: state.isPrerelease,
    body: state.body,
    assets: state.assets.map((name) => ({ name })),
  }));
  process.exit(0);
}
if (args[1] === "create") {
  if (state.exists) fail();
  const optionNames = new Set(["--target", "--title", "--notes-file", "--repo"]);
  const assets = [];
  let notesFile = null;
  let prerelease = false;
  for (let index = 3; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--prerelease") { prerelease = true; continue; }
    if (optionNames.has(arg)) {
      const value = args[++index];
      if (arg === "--notes-file") notesFile = value;
      continue;
    }
    assets.push(arg);
  }
  if (notesFile == null || assets.length === 0) fail();
  fs.mkdirSync(remote, { recursive: true });
  for (const asset of assets) fs.copyFileSync(asset, path.join(remote, path.basename(asset)));
  state.exists = true;
  state.isDraft = false;
  state.isPrerelease = prerelease;
  state.body = fs.readFileSync(notesFile, "utf8");
  state.assets = assets.map((asset) => path.basename(asset));
  save();
  process.stdout.write(state.hostileOutput);
  process.exit(0);
}
if (args[1] === "download") {
  const pattern = args[args.indexOf("--pattern") + 1];
  const directory = args[args.indexOf("--dir") + 1];
  if (!state.exists || !state.assets.includes(pattern)) fail();
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(path.join(remote, pattern), path.join(directory, pattern));
  save();
  process.stdout.write(state.hostileOutput);
  process.exit(0);
}
fail();
`;

function setup({
  prerelease = true,
  notes = "### Changed\n\n- Reviewed notes.\n",
} = {}) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-github-release-test-"),
  );
  const bin = path.join(root, "bin");
  const assets = path.join(root, "assets");
  const signatures = path.join(root, "signatures");
  fs.mkdirSync(bin);
  fs.mkdirSync(assets);
  fs.mkdirSync(signatures);

  const archive = path.join(assets, "zk.tar.gz");
  const manifest = path.join(assets, "manifest.json");
  const checksum = path.join(assets, "SHA256SUMS");
  const notesFile = path.join(root, "notes.md");
  fs.writeFileSync(archive, "deterministic archive\n");
  fs.writeFileSync(manifest, "{}\n");
  fs.writeFileSync(
    checksum,
    `${createHash("sha256").update(fs.readFileSync(archive)).digest("hex")}  ${path.basename(archive)}\n`,
  );
  fs.writeFileSync(notesFile, notes);
  fs.writeFileSync(
    path.join(signatures, `${path.basename(archive)}.sig`),
    "signature\n",
  );
  fs.writeFileSync(
    path.join(signatures, `${path.basename(archive)}.pem`),
    "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----\n",
  );

  fs.writeFileSync(path.join(bin, "gh"), fakeGh, { mode: 0o755 });
  fs.writeFileSync(
    path.join(bin, "node"),
    `#!/usr/bin/env bash\ncase "\${1:-}" in\n  scripts/run-bounded-command.mjs|scripts/verify-github-release-state.mjs) exec "\${REAL_NODE}" "$@" ;;\n  *) exit 0 ;;\nesac\n`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(bin, "cosign"), "#!/usr/bin/env bash\nexit 0\n", {
    mode: 0o755,
  });

  const statePath = path.join(root, "state.json");
  fs.writeFileSync(
    statePath,
    JSON.stringify({
      assets: [],
      body: "",
      calls: [],
      exists: false,
      hostileOutput,
      isDraft: false,
      isPrerelease: prerelease,
    }),
  );
  return {
    archive,
    assets,
    bin,
    checksum,
    manifest,
    notes,
    notesFile,
    prerelease,
    root,
    signatures,
    statePath,
  };
}

function readState(fixture) {
  return JSON.parse(fs.readFileSync(fixture.statePath, "utf8"));
}

function writeState(fixture, state) {
  fs.writeFileSync(fixture.statePath, JSON.stringify(state, null, 2));
}

function run(fixture, args = ["--notes-file", fixture.notesFile]) {
  return spawnSync("bash", [publisher, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ARCHIVE: fixture.archive,
      ARCHIVE_NAME: path.basename(fixture.archive),
      COSIGN_CERTIFICATE_IDENTITY: "https://github.com/example/workflow",
      GH_REPO: "midnightntwrk/midnight-did",
      GITHUB_SHA: "abcdef1234567890abcdef1234567890abcdef12",
      MANIFEST: fixture.manifest,
      NPM_ASSETS_DIR: "",
      PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`,
      PRERELEASE: String(fixture.prerelease),
      PROVENANCE_FILE: "",
      REAL_NODE: process.execPath,
      RELEASE_TAG: fixture.prerelease ? "v0.6.0-rc2" : "v0.6.0",
      SHA256: fixture.checksum,
      SIGNATURE_ASSETS_DIR: fixture.signatures,
    },
  });
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

test("initial RC and final creation use only the reviewed notes file body", async (t) => {
  for (const prerelease of [true, false]) {
    await t.test(prerelease ? "RC" : "final", () => {
      const fixture = setup({ prerelease });
      try {
        const result = run(fixture);
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
        const state = readState(fixture);
        assert.equal(state.body, fixture.notes);
        assert.equal(state.isPrerelease, prerelease);
        assert.equal(
          state.calls.filter((args) => args[1] === "create").length,
          1,
        );
        assert.doesNotMatch(
          `${result.stdout}${result.stderr}`,
          /must-not-leak/u,
        );
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("same-body rerun is idempotent and never edits or uploads the release", () => {
  const fixture = setup();
  try {
    const initial = run(fixture);
    assert.equal(initial.status, 0, initial.stderr);
    const state = readState(fixture);
    state.calls = [];
    writeState(fixture, state);

    const rerun = run(fixture);
    assert.equal(rerun.status, 0, `${rerun.stdout}\n${rerun.stderr}`);
    const calls = readState(fixture).calls;
    assert.equal(calls.filter((args) => args[1] === "create").length, 0);
    assert.equal(calls.filter((args) => args[1] === "edit").length, 0);
    assert.equal(calls.filter((args) => args[1] === "upload").length, 0);
  } finally {
    cleanup(fixture);
  }
});

test("existing release body mismatch fails closed before every mutation", () => {
  const fixture = setup();
  try {
    assert.equal(run(fixture).status, 0);
    const state = readState(fixture);
    state.body = "different body\n";
    state.calls = [];
    writeState(fixture, state);

    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /body differs from the reviewed changelog notes/u,
    );
    assert.equal(
      readState(fixture).calls.some((args) =>
        ["create", "edit", "upload"].includes(args[1]),
      ),
      false,
    );
  } finally {
    cleanup(fixture);
  }
});

test("malformed provider state fails closed without leaking provider output", () => {
  const fixture = setup();
  try {
    assert.equal(run(fixture).status, 0);
    const state = readState(fixture);
    state.malformedView = true;
    state.calls = [];
    writeState(fixture, state);

    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /must-not-leak/u);
    assert.equal(
      readState(fixture).calls.some((args) =>
        ["create", "edit", "upload"].includes(args[1]),
      ),
      false,
    );
  } finally {
    cleanup(fixture);
  }
});

test("notes content and path injection attempts remain data, not shell commands", () => {
  const fixture = setup({
    notes: "### Changed\n\n- `$(touch injected)`; ${HOME}; && touch injected\n",
  });
  const injected = path.join(repoRoot, "injected");
  fs.rmSync(injected, { force: true });
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(readState(fixture).body, fixture.notes);
    assert.equal(fs.existsSync(injected), false);

    const badArgument = run(fixture, [
      "--notes-file",
      fixture.notesFile,
      "--upload",
      "x",
    ]);
    assert.notEqual(badArgument.status, 0);
    assert.equal(fs.existsSync(injected), false);
  } finally {
    cleanup(fixture);
    fs.rmSync(injected, { force: true });
  }
});
