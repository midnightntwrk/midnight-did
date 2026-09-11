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

import {
  expectedNpmIdentity,
  npmAuthorityPackages,
  verifyNpmPublishAuthority,
} from "./check-npm-publish-authority.mjs";
import { npmPackageRegistry } from "./did-workspace-catalog.mjs";

const token = "test-token-that-must-never-appear-in-errors";
const authorityScriptPath = fileURLToPath(
  new URL("./check-npm-publish-authority.mjs", import.meta.url),
);
const expectedWhoamiArgs = [
  "whoami",
  "--json",
  "--registry",
  npmPackageRegistry,
  "--loglevel=silent",
];
const expectedAccessArgs = [
  "access",
  "list",
  "packages",
  expectedNpmIdentity,
  "--json",
  "--registry",
  npmPackageRegistry,
  "--loglevel=silent",
];
const expectedEnvironmentKeys = [
  "HOME",
  "NODE_AUTH_TOKEN",
  "NPM_CONFIG_CACHE",
  "NPM_CONFIG_GLOBALCONFIG",
  "NPM_CONFIG_REGISTRY",
  "NPM_CONFIG_USERCONFIG",
  "PATH",
  "TMPDIR",
];

function completeAccess(overrides = {}) {
  return Object.fromEntries(
    npmAuthorityPackages.map((packageName) => [
      packageName,
      overrides[packageName] ?? "read-write",
    ]),
  );
}

function fixture(responses) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "npm-authority-test-"));
  const executable = path.join(root, "npm");
  const statePath = path.join(root, "state.json");
  const responsePath = path.join(root, "responses.json");
  fs.writeFileSync(statePath, JSON.stringify({ calls: [] }));
  fs.writeFileSync(responsePath, JSON.stringify(responses));
  fs.writeFileSync(
    executable,
    `#!${process.execPath}\n${String.raw`
const fs = require("node:fs");
const path = require("node:path");
const root = __dirname;
const statePath = path.join(root, "state.json");
const responsePath = path.join(root, "responses.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const responses = JSON.parse(fs.readFileSync(responsePath, "utf8"));
const response = responses[state.calls.length];
const mode = (value) => fs.statSync(value).mode & 0o777;
state.calls.push({
  argv: process.argv.slice(2),
  env: process.env,
  paths: {
    home: process.env.HOME,
    cache: process.env.NPM_CONFIG_CACHE,
    temporary: process.env.TMPDIR,
    userConfig: process.env.NPM_CONFIG_USERCONFIG,
    globalConfig: process.env.NPM_CONFIG_GLOBALCONFIG,
  },
  modes: {
    home: mode(process.env.HOME),
    cache: mode(process.env.NPM_CONFIG_CACHE),
    temporary: mode(process.env.TMPDIR),
    userConfig: mode(process.env.NPM_CONFIG_USERCONFIG),
    globalConfig: mode(process.env.NPM_CONFIG_GLOBALCONFIG),
  },
  userConfig: fs.readFileSync(process.env.NPM_CONFIG_USERCONFIG, "utf8"),
});
fs.writeFileSync(statePath, JSON.stringify(state));
if (response.removeExecutable) fs.unlinkSync(__filename);
if (response.type === "timeout") {
  setInterval(() => {}, 1000);
} else if (response.type === "failure") {
  if (response.stdout) process.stdout.write(response.stdout);
  process.stderr.write(response.stderr);
  process.exit(response.code || 1);
} else if (response.type === "bytes") {
  process.stdout.write(Buffer.from(response.bytes));
} else if (response.type === "repeat") {
  process.stdout.write(response.value.repeat(response.count));
} else if (response.type === "raw") {
  process.stdout.write(response.value);
} else {
  process.stdout.write(JSON.stringify(response.value));
}
`}`,
    { mode: 0o755 },
  );
  return {
    executable,
    path: root,
    readState: () => JSON.parse(fs.readFileSync(statePath, "utf8")),
    remove: () => fs.rmSync(root, { force: true, recursive: true }),
  };
}

async function run(responses, options = {}) {
  const current = fixture(responses);
  try {
    const result = await verifyNpmPublishAuthority({
      token,
      npmExecutable: current.executable,
      ambientEnv: {
        PATH: "/hostile/path",
        BASH_ENV: "/tmp/hostile-bash-env",
        NODE_OPTIONS: "--require=/tmp/hostile-node-options.cjs",
        NPM_CONFIG_USERCONFIG: "/tmp/hostile-user.npmrc",
        npm_config_registry: "https://registry.invalid/",
        NPM_TOKEN: "hostile-token",
      },
      ...options,
    });
    return { result, state: current.readState() };
  } catch (error) {
    return { error, state: current.readState() };
  } finally {
    current.remove();
  }
}

function runCli(responses) {
  const current = fixture(responses);
  try {
    const result = spawnSync(process.execPath, [authorityScriptPath], {
      encoding: "utf8",
      env: {
        NODE_AUTH_TOKEN: token,
        PATH: current.path,
      },
      timeout: 5_000,
    });
    return { result, state: current.readState() };
  } finally {
    current.remove();
  }
}

function assertRedacted(error) {
  assert.ok(error instanceof Error);
  assert.doesNotMatch(
    String(error),
    /test-token|provider-secret|raw-provider/iu,
  );
  assert.doesNotMatch(
    error.stack ?? "",
    /test-token|provider-secret|raw-provider/iu,
  );
  assert.equal(Object.hasOwn(error, "cause"), false);
}

function assertNoMutations(state) {
  for (const call of state.calls) {
    assert.ok(
      call.argv[0] === "whoami" ||
        call.argv.slice(0, 3).join(" ") === "access list packages",
      `unexpected npm operation: ${call.argv.join(" ")}`,
    );
    assert.doesNotMatch(
      call.argv.join(" "),
      /\b(?:publish|unpublish|deprecate|dist-tag|adduser|login|logout|owner|team|token)\b/iu,
    );
  }
}

test("uses the canonical five-package catalog and succeeds only with read-write authority", async () => {
  assert.deepEqual(npmAuthorityPackages, [
    "@midnight-ntwrk/midnight-did-jubjub-schnorr",
    "@midnight-ntwrk/midnight-did-contract",
    "@midnight-ntwrk/midnight-did-domain",
    "@midnight-ntwrk/midnight-did",
    "@midnight-ntwrk/midnight-did-api",
  ]);
  const { result, state, error } = await run([
    { value: expectedNpmIdentity },
    { value: completeAccess() },
  ]);

  assert.equal(error, undefined);
  assert.deepEqual(result, {
    identity: expectedNpmIdentity,
    packages: [...npmAuthorityPackages],
    registry: npmPackageRegistry,
  });
  assert.equal(state.calls.length, 2);
  assert.deepEqual(state.calls[0].argv, expectedWhoamiArgs);
  assert.deepEqual(state.calls[1].argv, expectedAccessArgs);
  assertNoMutations(state);
});

test("passes an exact allowlisted environment and removes hostile ambient hooks and npm config", async () => {
  const { state, error } = await run([
    { value: expectedNpmIdentity },
    { value: completeAccess() },
  ]);
  assert.equal(error, undefined);

  for (const call of state.calls) {
    const childKeys = Object.keys(call.env).filter(
      (name) => name !== "__CF_USER_TEXT_ENCODING",
    );
    assert.deepEqual(childKeys.sort(), expectedEnvironmentKeys);
    assert.equal(call.env.NODE_AUTH_TOKEN, token);
    assert.equal(call.env.NPM_CONFIG_REGISTRY, npmPackageRegistry);
    assert.equal(call.env.PATH, "/hostile/path");
    for (const name of [
      "BASH_ENV",
      "NODE_OPTIONS",
      "NPM_TOKEN",
      "npm_config_registry",
    ]) {
      assert.equal(Object.hasOwn(call.env, name), false);
    }
    assert.match(
      call.userConfig,
      /^registry=https:\/\/registry\.npmjs\.org\/\n\/\/registry\.npmjs\.org\/:_authToken=\$\{NODE_AUTH_TOKEN\}\nalways-auth=true\n$/u,
    );
    assert.deepEqual(call.modes, {
      home: 0o700,
      cache: 0o700,
      temporary: 0o700,
      userConfig: 0o600,
      globalConfig: 0o600,
    });
    for (const isolatedPath of Object.values(call.paths)) {
      assert.equal(
        fs.existsSync(isolatedPath),
        false,
        `${isolatedPath} was not cleaned`,
      );
    }
  }
});

test("rejects a missing credential before invoking npm", async () => {
  const { error, state } = await run([], { token: "" });
  assertRedacted(error);
  assert.equal(error.message, "The npm release credential is unavailable.");
  assert.deepEqual(state.calls, []);
});

test("rejects wrong and missing npm identities without querying package access", async (t) => {
  for (const [response, expectedMessage] of [
    [
      { value: "another-user" },
      "The authenticated npm identity is not authorized for release.",
    ],
    [
      { value: null },
      "The authenticated npm identity is not authorized for release.",
    ],
    [
      { value: { username: expectedNpmIdentity } },
      "The authenticated npm identity is not authorized for release.",
    ],
    [{ type: "raw", value: "" }, "npm returned invalid authority evidence."],
  ]) {
    await t.test(JSON.stringify(response), async () => {
      const { error, state } = await run([response]);
      assertRedacted(error);
      assert.equal(error.message, expectedMessage);
      assert.equal(state.calls.length, 1);
      assertNoMutations(state);
    });
  }
});

test("rejects missing and read-only canonical package authority", async (t) => {
  const missing = completeAccess();
  delete missing[npmAuthorityPackages[2]];
  const readOnly = completeAccess({ [npmAuthorityPackages[4]]: "read-only" });
  for (const access of [missing, readOnly]) {
    await t.test(JSON.stringify(access), async () => {
      const { error, state } = await run([
        { value: expectedNpmIdentity },
        { value: access },
      ]);
      assertRedacted(error);
      assert.equal(
        error.message,
        "The npm release identity lacks required package authority.",
      );
      assertNoMutations(state);
    });
  }
});

test("rejects duplicate decoded JSON keys", async () => {
  const packageName = npmAuthorityPackages[0];
  const duplicate = JSON.stringify(completeAccess()).replace(
    `{\"${packageName}\":\"read-write\"`,
    `{\"${packageName}\":\"read-write\",\"${packageName.replace("midnight", "mid\\u006eight")}\":\"read-write\"`,
  );
  const { error, state } = await run([
    { value: expectedNpmIdentity },
    { type: "raw", value: duplicate },
  ]);
  assertRedacted(error);
  assertNoMutations(state);
});

test("rejects invalid UTF-8 authority evidence", async () => {
  const { error, state } = await run([
    { value: expectedNpmIdentity },
    { type: "bytes", bytes: [0xc3, 0x28] },
  ]);
  assertRedacted(error);
  assertNoMutations(state);
});

test("rejects trailing and concatenated JSON values", async (t) => {
  for (const value of [
    `${JSON.stringify(completeAccess())}x`,
    `${JSON.stringify(completeAccess())}${JSON.stringify(completeAccess())}`,
  ]) {
    await t.test(value.at(-1), async () => {
      const { error, state } = await run([
        { value: expectedNpmIdentity },
        { type: "raw", value },
      ]);
      assertRedacted(error);
      assertNoMutations(state);
    });
  }
});

test("rejects non-object and non-string package authority values", async (t) => {
  for (const access of [
    ["read-write"],
    "read-write",
    null,
    {
      ...completeAccess(),
      [npmAuthorityPackages[0]]: { access: "read-write" },
    },
  ]) {
    await t.test(JSON.stringify(access), async () => {
      const { error, state } = await run([
        { value: expectedNpmIdentity },
        { value: access },
      ]);
      assertRedacted(error);
      assertNoMutations(state);
    });
  }
});

test("bounds provider output with only the allowlisted operation name", async (t) => {
  for (const [responses, expectedMessage] of [
    [
      [{ type: "repeat", value: "untrusted-operation-label", count: 100 }],
      "The npm identity command output exceeded the output limit.",
    ],
    [
      [
        { value: expectedNpmIdentity },
        { type: "repeat", value: "untrusted-operation-label", count: 100 },
      ],
      "The npm package authority command output exceeded the output limit.",
    ],
  ]) {
    await t.test(expectedMessage, async () => {
      const { error, state } = await run(responses, { outputLimit: 1024 });
      assertRedacted(error);
      assert.equal(error.message, expectedMessage);
      assert.doesNotMatch(String(error), /untrusted-operation-label/u);
      assertNoMutations(state);
    });
  }
});

test("times out npm with only the allowlisted operation name and cleans isolated state", async (t) => {
  for (const [responses, expectedMessage] of [
    [[{ type: "timeout" }], "The npm identity command timed out."],
    [
      [{ value: expectedNpmIdentity }, { type: "timeout" }],
      "The npm package authority command timed out.",
    ],
  ]) {
    await t.test(expectedMessage, async () => {
      const temporaryRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "npm-authority-timeout-test-"),
      );
      try {
        const { error, state } = await run(responses, {
          temporaryRoot,
          timeoutMs: 500,
        });
        assertRedacted(error);
        assert.equal(error.message, expectedMessage);
        assert.equal(
          fs.readdirSync(temporaryRoot).length,
          0,
          "the authority checker must remove its temporary directory",
        );
        for (const call of state.calls) {
          for (const isolatedPath of Object.values(call.paths)) {
            assert.equal(fs.existsSync(isolatedPath), false);
          }
        }
        assertNoMutations(state);
      } finally {
        fs.rmSync(temporaryRoot, { force: true, recursive: true });
      }
    });
  }
});

test("redacts malformed provider stdout", async () => {
  const { error, state } = await run([
    {
      type: "raw",
      value: `raw-provider-error provider-secret ${token}`,
    },
  ]);
  assertRedacted(error);
  assert.equal(error.message, "npm returned invalid authority evidence.");
  assertNoMutations(state);
});

test("redacts provider failures and uses only allowlisted operation names", async (t) => {
  const capturedOutput = `raw-provider-error provider-secret ${token} untrusted-operation-label`;
  for (const [responses, expectedMessage] of [
    [
      [
        {
          type: "failure",
          stdout: capturedOutput,
          stderr: capturedOutput,
          code: 23,
        },
      ],
      "The npm identity command failed.",
    ],
    [
      [
        { value: expectedNpmIdentity },
        {
          type: "failure",
          stdout: capturedOutput,
          stderr: capturedOutput,
          code: 23,
        },
      ],
      "The npm package authority command failed.",
    ],
  ]) {
    await t.test(expectedMessage, async () => {
      const { error, state } = await run(responses);
      assertRedacted(error);
      assert.equal(error.message, expectedMessage);
      assert.doesNotMatch(String(error), /untrusted-operation-label/u);
      assert.equal(Object.hasOwn(error, "cause"), false);
      assertNoMutations(state);
    });
  }
});

test("the CLI never logs captured npm output or an injected operation label", () => {
  const capturedOutput = `raw-provider-error provider-secret ${token} ::error::untrusted-operation-label`;
  const { result, state } = runCli([
    { value: expectedNpmIdentity },
    {
      type: "failure",
      stdout: capturedOutput,
      stderr: capturedOutput,
      code: 23,
    },
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "[npm-release-authority] The npm package authority command failed.\n",
  );
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /raw-provider|provider-secret|test-token|untrusted-operation-label|::error::/u,
  );
  assertNoMutations(state);
});

test("redacts npm process start failures and identifies the closed operation", async (t) => {
  await t.test("npm identity", async () => {
    const { error, state } = await run([], {
      npmExecutable: "/missing/provider-secret/npm",
    });
    assertRedacted(error);
    assert.equal(error.message, "The npm identity command failed.");
    assert.deepEqual(state.calls, []);
  });

  await t.test("npm package authority", async () => {
    const { error, state } = await run([
      { value: expectedNpmIdentity, removeExecutable: true },
    ]);
    assertRedacted(error);
    assert.equal(error.message, "The npm package authority command failed.");
    assert.equal(state.calls.length, 1);
    assertNoMutations(state);
  });
});
