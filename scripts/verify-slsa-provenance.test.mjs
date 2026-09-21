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
const verifier = path.join(repoRoot, "scripts/verify-slsa-provenance.mjs");
const sha = "abcdef1234567890abcdef1234567890abcdef12";
const ref = "refs/heads/develop";
const repo = "midnightntwrk/midnight-did";
const builder =
  "https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@f7dd8c54c2067bafc12ca7a55595d5ee9b75204a";
const sourceUri = `git+https://github.com/${repo}@${ref}`;

function releaseInputs(channel) {
  return channel === "rc"
    ? { channel, rc_index: "2", version: "0.7.0" }
    : { channel, version: "0.7.0" };
}

function setup({ channel = "rc" } = {}) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-slsa-verifier-test-"),
  );
  const asset = path.join(root, "asset.tar.gz");
  const other = path.join(root, "manifest.json");
  const verifiedJson = path.join(root, "verified.json");
  fs.writeFileSync(asset, "asset\n");
  fs.writeFileSync(other, "{}\n");
  const subject = [asset, other].map((file) => ({
    name: path.basename(file),
    digest: {
      sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    },
  }));
  const inputs = releaseInputs(channel);
  const document = {
    verificationResult: {
      statement: {
        _type: "https://in-toto.io/Statement/v0.1",
        predicateType: "https://slsa.dev/provenance/v0.2",
        subject,
        predicate: {
          builder: { id: builder },
          buildType:
            "https://github.com/slsa-framework/slsa-github-generator/generic@v1",
          invocation: {
            configSource: {
              uri: sourceUri,
              digest: { sha1: sha },
              entryPoint: ".github/workflows/publish.yml",
            },
            parameters: { event_inputs: { ...inputs } },
            environment: {
              github_event_name: "workflow_dispatch",
              github_ref: ref,
              github_sha1: sha,
              github_event_payload: {
                inputs: { ...inputs },
                ref,
                repository: { full_name: repo },
              },
            },
          },
          materials: [{ uri: sourceUri, digest: { sha1: sha } }],
        },
      },
    },
  };
  return { asset, channel, document, other, root, verifiedJson };
}

function run(fixture, { channel = fixture.channel, rcIndex } = {}) {
  fs.writeFileSync(fixture.verifiedJson, JSON.stringify(fixture.document));
  return spawnSync(
    process.execPath,
    [
      verifier,
      "--verified-json",
      fixture.verifiedJson,
      "--asset",
      fixture.asset,
      "--asset",
      fixture.other,
      "--github-sha",
      sha,
      "--source-ref",
      ref,
      "--source-repo",
      repo,
      "--builder-id",
      builder,
      "--entry-point",
      ".github/workflows/publish.yml",
      "--channel",
      channel,
      "--version",
      "0.7.0",
      ...(rcIndex === undefined
        ? channel === "rc"
          ? ["--rc-index", "2"]
          : []
        : ["--rc-index", rcIndex]),
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
}

function mutatePath(root, pathParts, value) {
  let target = root;
  for (const part of pathParts.slice(0, -1)) target = target[part];
  target[pathParts.at(-1)] = value;
}

test("accepts exact RC and final SLSA v0.2 statements", async (t) => {
  for (const channel of ["rc", "release"]) {
    await t.test(channel, () => {
      const fixture = setup({ channel });
      try {
        const result = run(fixture);
        assert.equal(result.status, 0, result.stderr);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("models omitted final rc_index separately from RC input", async (t) => {
  const cases = [
    [
      "final empty rc_index argument",
      setup({ channel: "release" }),
      { rcIndex: "" },
    ],
    ["final statement extra rc_index", setup({ channel: "release" }), null],
    ["RC statement missing rc_index", setup(), null],
  ];
  cases[1][1].document.verificationResult.statement.predicate.invocation.parameters.event_inputs.rc_index =
    "";
  cases[1][1].document.verificationResult.statement.predicate.invocation.environment.github_event_payload.inputs.rc_index =
    "";
  delete cases[2][1].document.verificationResult.statement.predicate.invocation
    .parameters.event_inputs.rc_index;
  delete cases[2][1].document.verificationResult.statement.predicate.invocation
    .environment.github_event_payload.inputs.rc_index;
  for (const [name, fixture, options] of cases) {
    await t.test(name, () => {
      try {
        assert.notEqual(run(fixture, options ?? {}).status, 0);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects extra, duplicate, missing, and mismatched subjects", async (t) => {
  const cases = [
    [
      "extra",
      (statement) =>
        statement.subject.push({
          name: "extra",
          digest: { sha256: "0".repeat(64) },
        }),
    ],
    [
      "duplicate",
      (statement) =>
        statement.subject.push(structuredClone(statement.subject[0])),
    ],
    ["missing", (statement) => statement.subject.pop()],
    [
      "digest mismatch",
      (statement) => {
        statement.subject[0].digest.sha256 = "0".repeat(64);
      },
    ],
    [
      "digest algorithm extra",
      (statement) => {
        statement.subject[0].digest.sha512 = "0".repeat(128);
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const fixture = setup();
      try {
        mutate(fixture.document.verificationResult.statement);
        assert.notEqual(run(fixture).status, 0);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects malformed verified output", () => {
  const fixture = setup();
  try {
    fixture.document = "not a verification result";
    assert.notEqual(run(fixture).status, 0);
    fs.writeFileSync(fixture.verifiedJson, "{bad json");
    const args = [
      verifier,
      "--verified-json",
      fixture.verifiedJson,
      "--asset",
      fixture.asset,
      "--github-sha",
      sha,
      "--source-ref",
      ref,
      "--source-repo",
      repo,
      "--builder-id",
      builder,
      "--entry-point",
      ".github/workflows/publish.yml",
      "--channel",
      "rc",
      "--version",
      "0.7.0",
      "--rc-index",
      "2",
    ];
    assert.notEqual(
      spawnSync(process.execPath, args, { cwd: repoRoot }).status,
      0,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects source, builder, workflow, event, input, and predicate mismatches", async (t) => {
  const base = ["verificationResult", "statement"];
  const cases = [
    ["statement type", [...base, "_type"], "https://in-toto.io/Statement/v1"],
    [
      "predicate type",
      [...base, "predicateType"],
      "https://slsa.dev/provenance/v1",
    ],
    ["builder", [...base, "predicate", "builder", "id"], "wrong"],
    ["build type", [...base, "predicate", "buildType"], "wrong"],
    [
      "source uri",
      [...base, "predicate", "invocation", "configSource", "uri"],
      "wrong",
    ],
    [
      "source digest",
      [...base, "predicate", "invocation", "configSource", "digest", "sha1"],
      "0".repeat(40),
    ],
    [
      "entry point",
      [...base, "predicate", "invocation", "configSource", "entryPoint"],
      "wrong.yml",
    ],
    [
      "event",
      [...base, "predicate", "invocation", "environment", "github_event_name"],
      "push",
    ],
    [
      "source ref",
      [...base, "predicate", "invocation", "environment", "github_ref"],
      "refs/heads/main",
    ],
    [
      "github sha",
      [...base, "predicate", "invocation", "environment", "github_sha1"],
      "0".repeat(40),
    ],
    [
      "repository",
      [
        ...base,
        "predicate",
        "invocation",
        "environment",
        "github_event_payload",
        "repository",
        "full_name",
      ],
      "other/repo",
    ],
    [
      "release input",
      [
        ...base,
        "predicate",
        "invocation",
        "parameters",
        "event_inputs",
        "channel",
      ],
      "release",
    ],
    [
      "payload input",
      [
        ...base,
        "predicate",
        "invocation",
        "environment",
        "github_event_payload",
        "inputs",
        "version",
      ],
      "9.9.9",
    ],
    ["material", [...base, "predicate", "materials", 0, "uri"], "wrong"],
    [
      "material SHA",
      [...base, "predicate", "materials", 0, "digest", "sha1"],
      "0".repeat(40),
    ],
  ];
  for (const [name, pathParts, value] of cases) {
    await t.test(name, () => {
      const fixture = setup();
      try {
        mutatePath(fixture.document, pathParts, value);
        assert.notEqual(run(fixture).status, 0);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects missing or extra input keys and material cardinality", async (t) => {
  const cases = [
    [
      "missing input key",
      (statement) => {
        delete statement.predicate.invocation.parameters.event_inputs.version;
      },
    ],
    [
      "extra input key",
      (statement) => {
        statement.predicate.invocation.parameters.event_inputs.extra = "x";
      },
    ],
    [
      "payload extra input key",
      (statement) => {
        statement.predicate.invocation.environment.github_event_payload.inputs.extra =
          "x";
      },
    ],
    [
      "extra material",
      (statement) => {
        statement.predicate.materials.push(
          structuredClone(statement.predicate.materials[0]),
        );
      },
    ],
    [
      "missing material",
      (statement) => {
        statement.predicate.materials = [];
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const fixture = setup();
      try {
        mutate(fixture.document.verificationResult.statement);
        assert.notEqual(run(fixture).status, 0);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});
