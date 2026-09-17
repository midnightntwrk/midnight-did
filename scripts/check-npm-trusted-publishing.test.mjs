#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  trustedPublishingMinimumNpmVersion,
  trustedPublishingPackages,
  verifyNpmTrustedPublishingPrerequisites,
} from "./check-npm-trusted-publishing.mjs";
import { npmPackageRegistry } from "./did-workspace-catalog.mjs";

const repoRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const secret = "provider-secret-must-never-be-printed";

function baselineEnvironment(overrides = {}) {
  return {
    PATH: process.env.PATH ?? "",
    HOME: os.tmpdir(),
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "midnightntwrk/midnight-did",
    GITHUB_REF: "refs/heads/develop",
    GITHUB_REF_TYPE: "branch",
    GITHUB_WORKFLOW_REF:
      "midnightntwrk/midnight-did/.github/workflows/publish.yml@refs/heads/develop",
    RUNNER_ENVIRONMENT: "github-hosted",
    NPM_TRUSTED_PUBLISHING_ENVIRONMENT: "npm-release",
    ACTIONS_ID_TOKEN_REQUEST_URL: `https://oidc.invalid/${secret}`,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: secret,
    ...overrides,
  };
}

function createFakeNpm(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "npm-trusted-provider-"));
  const executable = path.join(root, "npm");
  const statePath = path.join(root, "state.json");
  const optionsPath = path.join(root, "options.json");
  fs.writeFileSync(statePath, JSON.stringify({ calls: [] }));
  fs.writeFileSync(optionsPath, JSON.stringify(options));
  fs.writeFileSync(
    executable,
    `#!${process.execPath}\n${String.raw`
const fs = require("node:fs");
const path = require("node:path");
const statePath = path.join(__dirname, "state.json");
const options = JSON.parse(fs.readFileSync(path.join(__dirname, "options.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
const call = {
  args,
  env: process.env,
  npmrc: fs.readFileSync(process.env.NPM_CONFIG_USERCONFIG, "utf8"),
  npmrcPath: process.env.NPM_CONFIG_USERCONFIG,
};
state.calls.push(call);
fs.writeFileSync(statePath, JSON.stringify(state));
const index = state.calls.length - 1;
if (options.timeoutAt === index) setInterval(() => {}, 1000);
else if (options.failAt === index) { process.stderr.write(options.stderr || "provider failure"); process.exit(23); }
else if (options.oversizedAt === index) process.stdout.write("x".repeat(options.oversizedBytes || 4096));
else if (options.rawAt === index) process.stdout.write(options.raw);
else if (args[0] === "--version") process.stdout.write(options.version || "11.5.1\n");
else if (args[0] === "view") process.stdout.write(JSON.stringify(args[1]));
else { process.stderr.write("unsupported operation"); process.exit(2); }
`}`,
    { mode: 0o755 },
  );
  return {
    executable,
    root,
    state: () => JSON.parse(fs.readFileSync(statePath, "utf8")),
    remove: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

async function run({ environment, providerOptions, options = {} } = {}) {
  const provider = createFakeNpm(providerOptions);
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "npm-trusted-temp-"),
  );
  try {
    const result = await verifyNpmTrustedPublishingPrerequisites({
      ambientEnv: environment ?? baselineEnvironment(),
      cwd: repoRoot,
      npmExecutable: provider.executable,
      temporaryRoot,
      ...options,
    });
    return { result, state: provider.state(), temporaryRoot };
  } catch (error) {
    return { error, state: provider.state(), temporaryRoot };
  } finally {
    provider.remove();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function assertRedacted(error) {
  assert.ok(error instanceof Error);
  assert.doesNotMatch(
    `${error.message}\n${error.stack ?? ""}`,
    /provider-secret|raw-provider/iu,
  );
  assert.equal(Object.hasOwn(error, "cause"), false);
}

function assertNoNpm(state) {
  assert.deepEqual(state.calls, []);
}

test("checks npm >=11.5.1 and public readability for the canonical five packages", async () => {
  assert.equal(trustedPublishingMinimumNpmVersion, "11.5.1");
  assert.deepEqual(trustedPublishingPackages, [
    "@midnight-ntwrk/midnight-did-jubjub-schnorr",
    "@midnight-ntwrk/midnight-did-contract",
    "@midnight-ntwrk/midnight-did-domain",
    "@midnight-ntwrk/midnight-did",
    "@midnight-ntwrk/midnight-did-api",
  ]);
  const { result, state, error } = await run();
  assert.equal(error, undefined);
  assert.equal(result.npmVersion, "11.5.1");
  assert.deepEqual(result.packages, trustedPublishingPackages);
  assert.deepEqual(
    state.calls.map(({ args }) => args),
    [
      ["--version"],
      ...trustedPublishingPackages.map((name) => [
        "view",
        name,
        "name",
        "--json",
        "--registry",
        npmPackageRegistry,
        "--loglevel=silent",
      ]),
    ],
  );
  for (const call of state.calls) {
    assert.equal(call.npmrc, `registry=${npmPackageRegistry}\n`);
    assert.equal(Object.hasOwn(call.env, "NODE_AUTH_TOKEN"), false);
    assert.equal(Object.hasOwn(call.env, "NPM_TOKEN"), false);
    assert.equal(
      Object.hasOwn(call.env, "ACTIONS_ID_TOKEN_REQUEST_TOKEN"),
      false,
    );
    assert.equal(fs.existsSync(call.npmrcPath), false);
  }
});

test("success notice honestly states that npm-side mapping cannot be pre-verified", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/check-npm-trusted-publishing.mjs"),
    "utf8",
  );
  assert.match(
    source,
    /npm-side trusted-publisher mapping was not verified and cannot be verified without an actual publish/iu,
  );
  assert.doesNotMatch(source, /decode.*JWT|request.*JWT/iu);
});

test("rejects alternate authentication and runtime injection before invoking npm", async (t) => {
  for (const [name, value] of [
    ["NODE_AUTH_TOKEN", secret],
    ["NPM_TOKEN", secret],
    ["NPM_ID_TOKEN", secret],
    ["NODE_AUTH_TOKEN", ""],
    ["NPM_CONFIG__PASSWORD", secret],
    ["NPM_CONFIG_USERNAME", secret],
    ["NPM_CONFIG_OTP", "123456"],
    ["NPM_CONFIG_CERT", secret],
    ["NPM_CONFIG_KEY", secret],
    ["NODE_OPTIONS", `--require=${secret}`],
    ["NPM_REGISTRY", "https://registry.invalid/"],
    ["NPM_CONFIG_REGISTRY", "https://registry.invalid/"],
  ]) {
    await t.test(`${name} present`, async () => {
      const { error, state } = await run({
        environment: baselineEnvironment({ [name]: value }),
      });
      assertRedacted(error);
      assertNoNpm(state);
    });
  }
});

test("rejects ambient npm authentication configuration before invoking npm", async (t) => {
  for (const environment of [
    baselineEnvironment({ NPM_CONFIG__AUTH: secret }),
    baselineEnvironment({ npm_config_auth_token: secret }),
    baselineEnvironment({ NPM_CONFIG_CERTFILE: secret }),
    baselineEnvironment({ NPM_CONFIG_KEYFILE: secret }),
  ]) {
    await t.test("authentication environment", async () => {
      const { error, state } = await run({ environment });
      assertRedacted(error);
      assertNoNpm(state);
    });
  }

  await t.test("credential-bearing npmrc", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "npmrc-auth-test-"));
    const npmrc = path.join(root, "user.npmrc");
    fs.writeFileSync(npmrc, `//registry.npmjs.org/:_authToken=${secret}\n`);
    try {
      const { error, state } = await run({
        environment: baselineEnvironment({
          HOME: root,
          NPM_CONFIG_USERCONFIG: npmrc,
        }),
      });
      assertRedacted(error);
      assertNoNpm(state);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

test("requires the exact npmjs registry when an ambient registry is declared", async () => {
  const { error } = await run({
    environment: baselineEnvironment({
      NPM_REGISTRY: npmPackageRegistry,
      NPM_CONFIG_REGISTRY: npmPackageRegistry,
    }),
  });
  assert.equal(error, undefined);
});

test("accepts setup-node's inert token placeholder only when no token variable exists", async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "npmrc-placeholder-test-"),
  );
  const npmrc = path.join(root, "user.npmrc");
  fs.writeFileSync(
    npmrc,
    "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\n",
  );
  try {
    const { error } = await run({
      environment: baselineEnvironment({
        HOME: root,
        NPM_CONFIG_USERCONFIG: npmrc,
      }),
    });
    assert.equal(error, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed on wrong repository, workflow, ref, environment, event host, or OIDC context", async (t) => {
  const cases = {
    repository: { GITHUB_REPOSITORY: "other/repo" },
    workflow: {
      GITHUB_WORKFLOW_REF:
        "midnightntwrk/midnight-did/.github/workflows/other.yml@refs/heads/develop",
    },
    workflowRef: {
      GITHUB_WORKFLOW_REF:
        "midnightntwrk/midnight-did/.github/workflows/publish.yml@refs/heads/main",
    },
    environment: { NPM_TRUSTED_PUBLISHING_ENVIRONMENT: "other" },
    tag: {
      GITHUB_REF: "refs/tags/develop",
      GITHUB_REF_TYPE: "tag",
      GITHUB_WORKFLOW_REF:
        "midnightntwrk/midnight-did/.github/workflows/publish.yml@refs/tags/develop",
    },
    feature: {
      GITHUB_REF: "refs/heads/feature",
      GITHUB_WORKFLOW_REF:
        "midnightntwrk/midnight-did/.github/workflows/publish.yml@refs/heads/feature",
    },
    selfHosted: { RUNNER_ENVIRONMENT: "self-hosted" },
    notActions: { GITHUB_ACTIONS: "false" },
    missingOidcUrl: { ACTIONS_ID_TOKEN_REQUEST_URL: "" },
    missingOidcToken: { ACTIONS_ID_TOKEN_REQUEST_TOKEN: "" },
  };
  for (const [label, overrides] of Object.entries(cases)) {
    await t.test(label, async () => {
      const { error, state } = await run({
        environment: baselineEnvironment(overrides),
      });
      assertRedacted(error);
      assertNoNpm(state);
    });
  }
});

test("rejects old and malformed npm versions before public metadata reads", async (t) => {
  for (const version of [
    "11.5.0",
    "10.99.99",
    "not-a-version",
    "11.5",
    "011.5.1",
    "11.5.1-beta.1",
    "999999999999999999999999.5.1",
  ]) {
    await t.test(version, async () => {
      const { error, state } = await run({ providerOptions: { version } });
      assertRedacted(error);
      assert.equal(state.calls.length, 1);
      assert.deepEqual(state.calls[0].args, ["--version"]);
    });
  }
});

test("suppresses hostile provider output on failure and malformed metadata", async (t) => {
  for (const providerOptions of [
    { failAt: 3, stderr: `raw-provider ${secret}` },
    { rawAt: 2, raw: `raw-provider ${secret}` },
    { rawAt: 5, raw: "{not-json" },
  ]) {
    await t.test(JSON.stringify(Object.keys(providerOptions)), async () => {
      const { error } = await run({ providerOptions });
      assertRedacted(error);
    });
  }
});

test("bounds provider output, times out, and cleans temporary state", async (t) => {
  await t.test("oversized", async () => {
    const { error } = await run({
      providerOptions: { oversizedAt: 1, oversizedBytes: 2048 },
      options: { outputLimit: 1024 },
    });
    assertRedacted(error);
    assert.match(error.message, /output.*limit/iu);
  });
  await t.test("timeout", async () => {
    const { error } = await run({
      providerOptions: { timeoutAt: 1 },
      options: { timeoutMs: 250 },
    });
    assertRedacted(error);
    assert.match(error.message, /timed out/iu);
  });
});
