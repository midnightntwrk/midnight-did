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
const resolver = path.join(repoRoot, "scripts/release-resolve-context.sh");
const validator = path.join(repoRoot, "scripts/release-validate-context.sh");

function temporaryOutput() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-release-context-"),
  );
  const output = path.join(directory, "github-output");
  fs.writeFileSync(output, "");
  return { directory, output };
}

function releaseEnvironment({ event, ref, refName, refType, values = {} }) {
  const env = { ...process.env, ...values, GITHUB_EVENT_NAME: event };
  delete env.GITHUB_REF;
  delete env.GITHUB_REF_NAME;
  delete env.GITHUB_REF_TYPE;
  if (ref != null) env.GITHUB_REF = ref;
  if (refName != null) env.GITHUB_REF_NAME = refName;
  if (refType != null) env.GITHUB_REF_TYPE = refType;
  return env;
}

function runResolver({
  event = "workflow_dispatch",
  ref = "refs/heads/main",
  refName = "main",
  refType = "branch",
  channel = "rc",
  version = "0.6.0",
  rcIndex = "1",
} = {}) {
  const fixture = temporaryOutput();
  const result = spawnSync("bash", [resolver], {
    cwd: repoRoot,
    encoding: "utf8",
    env: releaseEnvironment({
      event,
      ref,
      refName,
      refType,
      values: {
        GITHUB_OUTPUT: fixture.output,
        DISPATCH_CHANNEL: channel,
        DISPATCH_VERSION: version,
        DISPATCH_RC_INDEX: rcIndex,
      },
    }),
  });
  const output = fs.readFileSync(fixture.output, "utf8");
  fs.rmSync(fixture.directory, { recursive: true, force: true });
  return { ...result, output };
}

function validatorEnvironment({
  event = "workflow_dispatch",
  ref = "refs/heads/main",
  refName = "main",
  refType = "branch",
  channel = "rc",
  baseVersion = "0.6.0",
  releaseVersion = "0.6.0-rc1",
  rcIndex = "1",
  runNumber = "42",
  sha = "abcdef1234567890abcdef1234567890abcdef12",
} = {}) {
  return releaseEnvironment({
    event,
    ref,
    refName,
    refType,
    values: {
      CHANNEL: channel,
      BASE_VERSION: baseVersion,
      RELEASE_VERSION: releaseVersion,
      RC_INDEX: rcIndex,
      GITHUB_RUN_NUMBER: runNumber,
      GITHUB_SHA: sha,
    },
  });
}

function runValidator(options = {}) {
  return spawnSync("bash", [validator], {
    cwd: repoRoot,
    encoding: "utf8",
    env: validatorEnvironment(options),
  });
}

function runValidatorBoundary(options = {}) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "did-release-boundary-"),
  );
  const marker = path.join(directory, "executed");
  const result = spawnSync(
    "bash",
    [
      "-c",
      'set -euo pipefail; "$1"; printf executed > "$2"',
      "release-boundary-test",
      validator,
      marker,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: validatorEnvironment(options),
    },
  );
  const executed = fs.existsSync(marker);
  fs.rmSync(directory, { recursive: true, force: true });
  return { ...result, executed };
}

function runOutputWriter(value) {
  const fixture = temporaryOutput();
  const result = spawnSync(
    "bash",
    [
      "-c",
      'source "$1"; write_github_output_record "$2" version "$3"',
      "release-output-writer-test",
      validator,
      fixture.output,
      value,
    ],
    { cwd: repoRoot, encoding: "utf8", env: process.env },
  );
  const output = fs.readFileSync(fixture.output, "utf8");
  fs.rmSync(fixture.directory, { recursive: true, force: true });
  return { ...result, output };
}

function assertRejectedWithoutOutput(options) {
  const result = runResolver(options);
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.output, "");
}

test("preserves valid snapshot, RC, and final release context resolution", async (t) => {
  const cases = [
    {
      name: "trusted push snapshot",
      options: {
        event: "push",
        ref: "refs/heads/develop",
        refName: "develop",
        channel: "ignored",
        version: "ignored",
        rcIndex: "ignored",
      },
      output: "channel=snapshot\nversion=\nrc_index=\n",
    },
    {
      name: "manual snapshot",
      options: {
        ref: "refs/heads/develop",
        refName: "develop",
        channel: "snapshot",
        rcIndex: "",
      },
      output: "channel=snapshot\nversion=0.6.0\nrc_index=\n",
    },
    {
      name: "main RC",
      options: {},
      output: "channel=rc\nversion=0.6.0\nrc_index=1\n",
    },
    {
      name: "develop RC",
      options: {
        ref: "refs/heads/develop",
        refName: "develop",
        rcIndex: "12",
      },
      output: "channel=rc\nversion=0.6.0\nrc_index=12\n",
    },
    {
      name: "main final release",
      options: { channel: "release", rcIndex: "" },
      output: "channel=release\nversion=0.6.0\nrc_index=\n",
    },
  ];

  for (const { name, options, output } of cases) {
    await t.test(name, () => {
      const result = runResolver(options);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.equal(result.output, output);
    });
  }
});

test("manual dispatch requires one exact stable SemVer base", async (t) => {
  const invalidVersions = [
    "",
    "0.6",
    "v0.6.0",
    "00.6.0",
    "0.06.0",
    "0.6.00",
    "0.6.0-rc1",
    "0.6.0+build.1",
    " 0.6.0",
    "0.6.0 ",
    "0.6 .0",
    "\u00a00.6.0",
    "0.6.0\u2003",
    "0.6.0\t",
    "0.6.0\u0007",
    "0.6.0\u001b",
  ];

  for (const version of invalidVersions) {
    await t.test(JSON.stringify(version), () => {
      assertRejectedWithoutOutput({ version });
    });
  }
});

test("LF, CR/LF, and output-record injection fail before any output", async (t) => {
  for (const version of [
    "0.6.0\ninjected_key=injected_value",
    "0.6.0\r\ninjected_key=injected_value",
    "0.6.0\rinjected_key=injected_value",
  ]) {
    await t.test(JSON.stringify(version), () => {
      const result = runResolver({ version });
      assert.notEqual(result.status, 0);
      assert.equal(result.output, "");
      assert.doesNotMatch(result.output, /^injected_key=/mu);
    });
  }
});

test("every process-representable C0 or C1 control character is output-unsafe", async (t) => {
  const codePoints = [
    ...Array.from({ length: 31 }, (_, index) => index + 1),
    ...Array.from({ length: 33 }, (_, index) => index + 0x7f),
  ];
  for (const codePoint of codePoints) {
    await t.test(`U+${codePoint.toString(16).padStart(4, "0")}`, () => {
      const value = `0.6.0${String.fromCodePoint(codePoint)}`;
      assertRejectedWithoutOutput({ version: value });
      const writerResult = runOutputWriter(value);
      assert.notEqual(writerResult.status, 0);
      assert.equal(writerResult.output, "");
    });
  }
});

test("initial resolution requires an exact full branch ref and branch ref type", async (t) => {
  const invalidContexts = [
    {
      name: "tag named main",
      options: { ref: "refs/tags/main", refName: "main", refType: "tag" },
    },
    {
      name: "tag named develop",
      options: {
        ref: "refs/tags/develop",
        refName: "develop",
        refType: "tag",
        channel: "snapshot",
        rcIndex: "",
      },
    },
    {
      name: "final release with a mismatched develop full ref",
      options: {
        ref: "refs/heads/develop",
        refName: "main",
        channel: "release",
        rcIndex: "",
      },
    },
    {
      name: "snapshot with a mismatched main full ref",
      options: {
        ref: "refs/heads/main",
        refName: "develop",
        channel: "snapshot",
        rcIndex: "",
      },
    },
    { name: "missing full ref", options: { ref: null } },
    { name: "missing ref type", options: { refType: null } },
    { name: "invalid ref type", options: { refType: "tag" } },
  ];

  for (const { name, options } of invalidContexts) {
    await t.test(name, () => assertRejectedWithoutOutput(options));
  }
});

test("event, channel, and RC-index guards fail closed", async (t) => {
  const invalidContexts = [
    { event: "pull_request" },
    { event: "push", ref: "refs/heads/main", refName: "main" },
    {
      ref: "refs/heads/feature",
      refName: "feature",
      channel: "snapshot",
      rcIndex: "",
    },
    {
      ref: "refs/heads/develop",
      refName: "develop",
      channel: "snapshot",
      rcIndex: "1",
    },
    { ref: "refs/heads/feature", refName: "feature", channel: "rc" },
    {
      ref: "refs/heads/develop",
      refName: "develop",
      channel: "release",
      rcIndex: "",
    },
    { channel: "release", rcIndex: "1" },
    { channel: "unsupported" },
    { rcIndex: "" },
    { rcIndex: "0" },
    { rcIndex: "01" },
    { rcIndex: "1.0" },
    { rcIndex: "1\nextra=record" },
  ];

  for (const options of invalidContexts) {
    await t.test(JSON.stringify(options), () => {
      assertRejectedWithoutOutput(options);
    });
  }
});

test("process environment rejects NUL before the resolver process can start", () => {
  assert.throws(
    () =>
      spawnSync("bash", [resolver], {
        env: { ...process.env, DISPATCH_VERSION: "0.6.0\0injected" },
      }),
    /null bytes|NUL/iu,
  );
});

test("privileged-boundary validator accepts valid main and develop branch contexts", async (t) => {
  const validContexts = [
    {},
    {
      event: "workflow_dispatch",
      ref: "refs/heads/develop",
      refName: "develop",
      channel: "rc",
      releaseVersion: "0.6.0-rc12",
      rcIndex: "12",
    },
    {
      event: "workflow_dispatch",
      ref: "refs/heads/main",
      refName: "main",
      channel: "release",
      releaseVersion: "0.6.0",
      rcIndex: "",
    },
    {
      event: "push",
      ref: "refs/heads/develop",
      refName: "develop",
      channel: "snapshot",
      releaseVersion: "0.6.0-snapshot.42.abcdef123456",
      rcIndex: "",
    },
  ];

  for (const context of validContexts) {
    await t.test(JSON.stringify(context), () => {
      const result = runValidator(context);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    });
  }
});

test("invalid boundary context cannot execute its wrapped privileged command", async (t) => {
  const invalidContexts = [
    { releaseVersion: "0.6.0-rc2" },
    { baseVersion: "0.6.1" },
    {
      channel: "release",
      releaseVersion: "0.6.0",
      rcIndex: "",
      ref: "refs/heads/develop",
      refName: "main",
    },
    {
      name: "tag named main",
      ref: "refs/tags/main",
      refName: "main",
      refType: "tag",
    },
    {
      name: "tag named develop",
      ref: "refs/tags/develop",
      refName: "develop",
      refType: "tag",
      channel: "snapshot",
      rcIndex: "",
      releaseVersion: "0.6.0-snapshot.42.abcdef123456",
      event: "push",
    },
    { refType: null },
    { refType: "tag" },
    {
      channel: "snapshot",
      releaseVersion: "0.6.0-snapshot.42.abcdef123456",
      rcIndex: "",
      ref: "refs/heads/main",
      refName: "develop",
      event: "push",
    },
    {
      channel: "snapshot",
      releaseVersion: "0.6.0-snapshot.43.abcdef123456",
      rcIndex: "",
      ref: "refs/heads/develop",
      refName: "develop",
      event: "push",
    },
    {
      channel: "snapshot",
      releaseVersion: "0.6.0-snapshot.42.000000000000",
      rcIndex: "",
      ref: "refs/heads/develop",
      refName: "develop",
      event: "push",
    },
    { event: "pull_request" },
  ];

  for (const context of invalidContexts) {
    await t.test(JSON.stringify(context), () => {
      const result = runValidatorBoundary(context);
      assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.equal(result.executed, false);
    });
  }
});
