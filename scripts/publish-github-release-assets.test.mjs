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
const githubSha = "abcdef1234567890abcdef1234567890abcdef12";
const githubRef = "refs/heads/develop";
const builderIdentity =
  "https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@f7dd8c54c2067bafc12ca7a55595d5ee9b75204a";

const fakeGh = `#!${process.execPath}
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const root = path.dirname(__dirname);
const statePath = path.join(root, "state.json");
const remote = path.join(root, "remote");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
state.calls.push(args);
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const fail = (text = state.hostileOutput) => { save(); process.stderr.write(text); process.exit(1); };
if (args[0] === "attestation" && args[1] === "verify") {
  if (state.attestationFailure) fail();
  const subjects = state.assets
    .filter((name) => name !== "multiple.intoto.jsonl")
    .map((name) => ({
      name,
      digest: { sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(remote, name))).digest("hex") },
    }));
  const inputs = { channel: "rc", rc_index: "2", version: "0.6.0" };
  const sourceUri = "git+https://github.com/midnightntwrk/midnight-did@refs/heads/develop";
  const statement = {
    _type: "https://in-toto.io/Statement/v0.1",
    predicateType: "https://slsa.dev/provenance/v0.2",
    subject: subjects,
    predicate: {
      builder: { id: ${JSON.stringify(builderIdentity)} },
      buildType: "https://github.com/slsa-framework/slsa-github-generator/generic@v1",
      invocation: {
        configSource: {
          uri: sourceUri,
          digest: { sha1: ${JSON.stringify(githubSha)} },
          entryPoint: ".github/workflows/publish.yml",
        },
        parameters: { event_inputs: inputs },
        environment: {
          github_event_name: "workflow_dispatch",
          github_ref: "refs/heads/develop",
          github_sha1: ${JSON.stringify(githubSha)},
          github_event_payload: {
            inputs,
            ref: "refs/heads/develop",
            repository: { full_name: "midnightntwrk/midnight-did" },
          },
        },
      },
      materials: [{ uri: sourceUri, digest: { sha1: ${JSON.stringify(githubSha)} } }],
    },
  };
  if (state.semanticMismatch) statement.predicate.builder.id = state.hostileOutput;
  save();
  process.stdout.write(JSON.stringify({ verificationResult: { statement } }));
  process.exit(0);
}
if (args[0] !== "release") fail();
if (args[1] === "view") {
  switch (state.viewMode) {
    case "auth": fail("HTTP 401: " + state.hostileOutput + "\\n");
    case "rate-limit": fail("API rate limit exceeded: " + state.hostileOutput + "\\n");
    case "server": fail("HTTP 503: " + state.hostileOutput + "\\n");
    case "near-not-found": fail("release not found: " + state.hostileOutput + "\\n");
    case "timeout": save(); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000); process.exit(0);
    case "output-limit": save(); process.stderr.write(state.hostileOutput.repeat(1000)); process.exit(1);
    case "malformed": save(); process.stdout.write("{bad-json" + state.hostileOutput); process.exit(0);
    default: break;
  }
  if (!state.exists) fail("release not found\\n");
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
  const checksum = path.join(assets, "SHA256SUMS.sha256");
  const provenance = path.join(assets, "multiple.intoto.jsonl");
  const notesFile = path.join(root, "notes.md");
  fs.writeFileSync(archive, "deterministic archive\n");
  fs.writeFileSync(manifest, "{}\n");
  fs.writeFileSync(
    checksum,
    `${createHash("sha256").update(fs.readFileSync(archive)).digest("hex")}  ${path.basename(archive)}\n`,
  );
  fs.writeFileSync(provenance, "signed provenance bundle\n");
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
    `#!/usr/bin/env bash\ncase "\${1:-}" in\n  scripts/run-bounded-command.mjs|scripts/classify-github-release-view.mjs|scripts/validate-release-notes.mjs|scripts/verify-github-release-state.mjs|scripts/verify-slsa-provenance.mjs) exec "\${REAL_NODE}" "$@" ;;\n  *) exit 0 ;;\nesac\n`,
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
      viewMode: "normal",
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
    provenance,
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

function run(
  fixture,
  {
    args = ["--notes-file", fixture.notesFile],
    provenance = true,
    env = {},
  } = {},
) {
  return spawnSync("bash", [publisher, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ARCHIVE: fixture.archive,
      ARCHIVE_NAME: path.basename(fixture.archive),
      BASE_VERSION: "0.6.0",
      CHANNEL: "rc",
      COSIGN_CERTIFICATE_IDENTITY: "https://github.com/example/workflow",
      GH_REPO: "midnightntwrk/midnight-did",
      GITHUB_REF: githubRef,
      GITHUB_SHA: githubSha,
      MANIFEST: fixture.manifest,
      NPM_ASSETS_DIR: "",
      PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`,
      PRERELEASE: String(fixture.prerelease),
      PROVENANCE_FILE: provenance ? fixture.provenance : "",
      RC_INDEX: "2",
      REAL_NODE: process.execPath,
      RELEASE_TAG: fixture.prerelease ? "v0.6.0-rc2" : "v0.6.0",
      SHA256: fixture.checksum,
      SIGNATURE_ASSETS_DIR: fixture.signatures,
      ...env,
    },
  });
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

function mutationCalls(fixture) {
  return readState(fixture).calls.filter((args) =>
    ["create", "edit", "upload"].includes(args[1]),
  );
}

async function withCreatedFixture(callback) {
  const fixture = setup();
  try {
    const initial = run(fixture);
    assert.equal(initial.status, 0, `${initial.stdout}\n${initial.stderr}`);
    const state = readState(fixture);
    state.calls = [];
    writeState(fixture, state);
    await callback(fixture);
  } finally {
    cleanup(fixture);
  }
}

test("confirmed exact release not found creates RC and final releases with reviewed bytes", async (t) => {
  for (const prerelease of [true, false]) {
    await t.test(prerelease ? "RC" : "final", () => {
      const fixture = setup({ prerelease });
      try {
        const result = run(fixture);
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
        const state = readState(fixture);
        assert.equal(state.body, fixture.notes);
        assert.equal(state.isPrerelease, prerelease);
        assert.deepEqual(
          state.assets.filter((name) => name === "multiple.intoto.jsonl"),
          ["multiple.intoto.jsonl"],
        );
        assert.equal(mutationCalls(fixture).length, 1);
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

test("ambiguous release-state failures never create and suppress provider output", async (t) => {
  const cases = [
    ["auth", {}],
    ["rate-limit", {}],
    ["server", {}],
    ["near-not-found", {}],
    ["timeout", { GH_RELEASE_READ_TIMEOUT_MS: "50" }],
    ["output-limit", { GH_RELEASE_OUTPUT_LIMIT_BYTES: "128" }],
    ["malformed", {}],
  ];
  for (const [viewMode, env] of cases) {
    await t.test(viewMode, () => {
      const fixture = setup();
      try {
        const state = readState(fixture);
        state.viewMode = viewMode;
        writeState(fixture, state);
        const result = run(fixture, { env });
        assert.notEqual(result.status, 0);
        assert.equal(mutationCalls(fixture).length, 0);
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

test("same-body rerun downloads and verifies canonical provenance without mutation", async () => {
  await withCreatedFixture((fixture) => {
    const rerun = run(fixture, { provenance: false });
    assert.equal(rerun.status, 0, `${rerun.stdout}\n${rerun.stderr}`);
    assert.equal(mutationCalls(fixture).length, 0);
    const calls = readState(fixture).calls;
    assert.ok(
      calls.some(
        (args) =>
          args[1] === "download" &&
          args[args.indexOf("--pattern") + 1] === "multiple.intoto.jsonl",
      ),
    );
    const verify = calls.find((args) => args[0] === "attestation");
    assert.deepEqual(verify.slice(0, 3), ["attestation", "verify", verify[2]]);
    assert.equal(
      verify[verify.indexOf("--bundle") + 1].endsWith("/multiple.intoto.jsonl"),
      true,
    );
    assert.equal(
      verify[verify.indexOf("--repo") + 1],
      "midnightntwrk/midnight-did",
    );
    assert.equal(
      verify[verify.indexOf("--cert-identity") + 1],
      builderIdentity,
    );
    assert.equal(
      verify[verify.indexOf("--cert-oidc-issuer") + 1],
      "https://token.actions.githubusercontent.com",
    );
    assert.equal(
      verify[verify.indexOf("--predicate-type") + 1],
      "https://slsa.dev/provenance/v0.2",
    );
  });
});

test("existing release requires exact canonical asset multiset", async (t) => {
  const mutations = [
    ["missing asset", (state) => state.assets.pop()],
    ["extra asset", (state) => state.assets.push("unexpected.txt")],
    ["duplicate asset", (state) => state.assets.push(state.assets[0])],
    [
      "missing canonical provenance",
      (state) => {
        state.assets = state.assets.filter(
          (name) => name !== "multiple.intoto.jsonl",
        );
      },
    ],
    [
      "noncanonical provenance",
      (state) => {
        state.assets = state.assets.map((name) =>
          name === "multiple.intoto.jsonl" ? "other.intoto.jsonl" : name,
        );
      },
    ],
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, async () => {
      await withCreatedFixture((fixture) => {
        const state = readState(fixture);
        mutate(state);
        writeState(fixture, state);
        const result = run(fixture, { provenance: false });
        assert.notEqual(result.status, 0);
        assert.equal(mutationCalls(fixture).length, 0);
      });
    });
  }
});

test("release body contract rejects CRLF creation and existing-body mismatch", async (t) => {
  await t.test("creation notes", () => {
    const fixture = setup({
      notes: "### Changed\r\n\r\n- Reviewed notes.\r\n",
    });
    try {
      const result = run(fixture);
      assert.notEqual(result.status, 0);
      assert.equal(mutationCalls(fixture).length, 0);
    } finally {
      cleanup(fixture);
    }
  });

  await t.test("existing body", async () => {
    await withCreatedFixture((fixture) => {
      const state = readState(fixture);
      state.body = state.body.replaceAll("\n", "\r\n");
      writeState(fixture, state);
      const result = run(fixture, { provenance: false });
      assert.notEqual(result.status, 0);
      assert.equal(mutationCalls(fixture).length, 0);
    });
  });
});

test("provenance provider and semantic verifier failures are suppressed", async (t) => {
  for (const mode of ["attestationFailure", "semanticMismatch"]) {
    await t.test(mode, async () => {
      await withCreatedFixture((fixture) => {
        const state = readState(fixture);
        state[mode] = true;
        writeState(fixture, state);
        const result = run(fixture, { provenance: false });
        assert.notEqual(result.status, 0);
        assert.doesNotMatch(
          `${result.stdout}${result.stderr}`,
          /must-not-leak/u,
        );
        assert.equal(mutationCalls(fixture).length, 0);
      });
    });
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

    const badArgument = run(fixture, {
      args: ["--notes-file", fixture.notesFile, "--upload", "x"],
    });
    assert.notEqual(badArgument.status, 0);
    assert.equal(fs.existsSync(injected), false);
  } finally {
    cleanup(fixture);
    fs.rmSync(injected, { force: true });
  }
});
