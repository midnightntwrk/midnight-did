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
import { fileURLToPath, pathToFileURL } from "node:url";

import { runBoundedCommand } from "./run-bounded-command.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publisher = path.join(repoRoot, "scripts/publish-npm-packages.sh");
const version = "0.6.0";
const registry = "https://registry.npmjs.org/";
const defaultNpmTag = "snapshot";
const hostileOutput = "hostile-provider-secret-must-not-leak";
const repositoryUrl = "git+https://github.com/midnightntwrk/midnight-did.git";
const packageNames = [
  "@midnight-ntwrk/midnight-did-jubjub-schnorr",
  "@midnight-ntwrk/midnight-did-contract",
  "@midnight-ntwrk/midnight-did-domain",
  "@midnight-ntwrk/midnight-did",
  "@midnight-ntwrk/midnight-did-api",
];

const fakeNpm = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const statePath = require("node:path").join(__dirname, "..", "state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const call = {
  tool: "npm",
  args,
  nodeAuthTokenPresent: Object.hasOwn(process.env, "NODE_AUTH_TOKEN"),
  npmTokenPresent: Object.hasOwn(process.env, "NPM_TOKEN"),
  npmIdTokenPresent: Object.hasOwn(process.env, "NPM_ID_TOKEN"),
  nodeOptionsPresent: Object.hasOwn(process.env, "NODE_OPTIONS"),
  environmentKeys: Object.keys(process.env).sort(),
  npmrc: fs.readFileSync(process.env.NPM_CONFIG_USERCONFIG, "utf8"),
  globalNpmrc: fs.readFileSync(process.env.NPM_CONFIG_GLOBALCONFIG, "utf8"),
  npmrcPath: process.env.NPM_CONFIG_USERCONFIG,
  globalNpmrcPath: process.env.NPM_CONFIG_GLOBALCONFIG,
};
state.calls.push(call);
const fail = (message, code = 1) => { save(); process.stderr.write(message); process.exit(code); };
const maybeAdversarial = (operation, name) => {
  if (state.hangOperation === operation && state.hangPackage === name) {
    save();
    setInterval(() => {}, 1000);
    return true;
  }
  if (state.oversizedOperation === operation && state.oversizedPackage === name) {
    save();
    process.stdout.write("x".repeat(state.oversizedBytes || 131072));
    process.exit(0);
  }
  return false;
};
if (args[0] === "--version") {
  process.stdout.write(state.npmVersion);
  save();
  process.exit(0);
}
if (args[0] === "view") {
  const spec = args[1];
  const exactName = Object.keys(state.packages).find((name) => spec === name + "@" + state.version);
  if (exactName) {
    if (maybeAdversarial("view", exactName)) return;
    const pkg = state.packages[exactName];
    pkg.exactReads = (pkg.exactReads || 0) + 1;
    if (pkg.failExactReadAt === pkg.exactReads || pkg.target === "error") fail(state.hostileOutput);
    if (pkg.target === "absent") fail("npm error code E404\nnpm error 404 Not Found");
    process.stdout.write(JSON.stringify({ version: state.version, dist: { integrity: pkg.remoteIntegrity, tarball: pkg.remoteTarball } }));
    save();
    process.exit(0);
  }
  if (maybeAdversarial("view", spec)) return;
  const pkg = state.packages[spec];
  if (!pkg) fail("npm error code E404");
  if (args[2] === "name") {
    if (pkg.visibilityError) fail(state.hostileOutput);
    process.stdout.write(JSON.stringify(spec));
  } else if (args[2] === "dist-tags") {
    if (pkg.tagsError) fail(state.hostileOutput);
    process.stdout.write(pkg.malformedTags ? "{bad-json" : JSON.stringify(pkg.tags));
  } else fail("unsupported view");
  save();
  process.exit(0);
}
if (args[0] === "publish") {
  const tarball = args.at(-1);
  const entry = Object.entries(state.packages).find(([, pkg]) => pkg.localTarball === tarball);
  if (!entry) fail("unknown tarball");
  const [name, pkg] = entry;
  call.packageName = name;
  if (maybeAdversarial("publish", name)) return;
  const expected = ["publish", "--provenance", "--ignore-scripts", "--tag", state.npmTag, "--access", "public", "--registry", state.registry, tarball];
  if (args.length !== expected.length || args.some((arg, index) => arg !== expected[index])) fail("incorrect publish arguments");
  if (state.failPublish === name) fail(state.hostileOutput);
  pkg.target = "present";
  pkg.remoteIntegrity = pkg.corruptAfterPublish ? pkg.corruptIntegrity : pkg.localIntegrity;
  pkg.remoteTarball = pkg.corruptAfterPublish ? pkg.corruptTarball : pathToFileURL(tarball).href;
  pkg.tags[state.npmTag] = pkg.wrongTagAfterPublish ? "0.0.0-wrong" : state.version;
  save();
  if (state.lostResponse === name) { process.stderr.write(state.hostileOutput); process.exit(42); }
  process.exit(0);
}
fail("unsupported npm operation");
`;

const fakePnpm = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const statePath = require("node:path").join(__dirname, "..", "state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
state.calls.push({ tool: "pnpm", args: process.argv.slice(2) });
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
process.stderr.write("pnpm must not publish");
process.exit(99);
`;

const fakeCurl = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");
const args = process.argv.slice(2);
const output = args[args.indexOf("--output") + 1];
const url = args.find((arg) => arg.startsWith("file:"));
if (!url || !output) process.exit(2);
fs.copyFileSync(fileURLToPath(url), output);
`;

function tarballName(name) {
  return `${name.replace(/^@/u, "").replaceAll("/", "-")}-${version}.tgz`;
}

function makeTarball(root, name, content = name, manifestOverrides = {}) {
  const source = fs.mkdtempSync(path.join(root, "source-"));
  const packageRoot = path.join(source, "package");
  const workspace = {
    "@midnight-ntwrk/midnight-did-jubjub-schnorr": "packages/jubjub-schnorr",
    "@midnight-ntwrk/midnight-did-contract": "packages/contract",
    "@midnight-ntwrk/midnight-did-domain": "packages/domain",
    "@midnight-ntwrk/midnight-did": "packages/did",
    "@midnight-ntwrk/midnight-did-api": "packages/api",
  }[name];
  fs.mkdirSync(packageRoot);
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    `${JSON.stringify({
      name,
      version,
      publishConfig: { access: "public", registry },
      repository: { type: "git", url: repositoryUrl, directory: workspace },
      ...manifestOverrides,
    })}\n`,
  );
  fs.writeFileSync(path.join(packageRoot, "index.js"), `${content}\n`);
  const destination = path.join(root, tarballName(name));
  const packed = spawnSync(
    "tar",
    ["-czf", destination, "-C", source, "package"],
    { encoding: "utf8" },
  );
  assert.equal(packed.status, 0, packed.stderr);
  fs.rmSync(source, { force: true, recursive: true });
  return destination;
}

function integrity(file) {
  return `sha512-${createHash("sha512").update(fs.readFileSync(file)).digest("base64")}`;
}

function setup({
  states = {},
  tags = {},
  corruptAfterPublish = [],
  wrongTagAfterPublish = [],
  npmTag = defaultNpmTag,
  npmVersion = "11.5.1\n",
  manifestOverrides = {},
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "did-npm-publish-test-"));
  const assets = path.join(root, "assets");
  const bin = path.join(root, "bin");
  fs.mkdirSync(assets);
  fs.mkdirSync(bin);
  for (const [name, contents] of [
    ["npm", fakeNpm],
    ["pnpm", fakePnpm],
    ["curl", fakeCurl],
  ]) {
    fs.writeFileSync(path.join(bin, name), contents, { mode: 0o755 });
  }
  const packages = {};
  for (const name of packageNames) {
    const localTarball = makeTarball(
      assets,
      name,
      name,
      manifestOverrides[name],
    );
    const corruptTarball = makeTarball(root, name, `${name}-corrupt`);
    packages[name] = {
      target: states[name] ?? "absent",
      tags: { ...(tags[name] ?? {}) },
      localTarball,
      localIntegrity: integrity(localTarball),
      remoteIntegrity: integrity(localTarball),
      remoteTarball: pathToFileURL(localTarball).href,
      corruptIntegrity: integrity(corruptTarball),
      corruptTarball: pathToFileURL(corruptTarball).href,
      corruptAfterPublish: corruptAfterPublish.includes(name),
      wrongTagAfterPublish: wrongTagAfterPublish.includes(name),
    };
  }
  const statePath = path.join(root, "state.json");
  const state = {
    version,
    registry,
    npmTag,
    hostileOutput,
    npmVersion,
    calls: [],
    packages,
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  return { root, assets, bin, statePath, state };
}

function persist(fixture) {
  fs.writeFileSync(fixture.statePath, JSON.stringify(fixture.state, null, 2));
}

function run(fixture, overrides = {}) {
  const env = {
    ...process.env,
    PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`,
    VERSION: version,
    NPM_TAG: fixture.state.npmTag,
    NPM_ASSETS_DIR: fixture.assets,
    NPM_REGISTRY: registry,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "test-oidc-request-token",
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://oidc.invalid/token",
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/develop",
    GITHUB_REF_NAME: "develop",
    GITHUB_REF_TYPE: "branch",
    GITHUB_REPOSITORY: "midnightntwrk/midnight-did",
    GITHUB_REPOSITORY_ID: "123456",
    GITHUB_REPOSITORY_OWNER_ID: "654321",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "123",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_SHA: "abcdef1234567890abcdef1234567890abcdef12",
    GITHUB_WORKFLOW: "Publish npmjs Packages and ZK Artifacts",
    GITHUB_WORKFLOW_REF:
      "midnightntwrk/midnight-did/.github/workflows/publish.yml@refs/heads/develop",
    GITHUB_WORKFLOW_SHA: "abcdef1234567890abcdef1234567890abcdef12",
    RUNNER_ENVIRONMENT: "github-hosted",
  };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  delete env.NPM_ID_TOKEN;
  delete env.NODE_OPTIONS;
  delete env.NPM_CONFIG__PASSWORD;
  delete env.NPM_CONFIG_USERNAME;
  delete env.NPM_CONFIG_OTP;
  delete env.NPM_CONFIG_CERT;
  delete env.NPM_CONFIG_KEY;
  delete env.NPM_CONFIG_REGISTRY;
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  const result = spawnSync("bash", [publisher], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    timeout: 15_000,
  });
  return {
    ...result,
    state: JSON.parse(fs.readFileSync(fixture.statePath, "utf8")),
  };
}

function publishCalls(state) {
  return state.calls.filter(
    ({ tool, args }) => tool === "npm" && args[0] === "publish",
  );
}

function assertNoAdministration(state) {
  for (const call of state.calls) {
    assert.ok(!["access", "dist-tag"].includes(call.args[0]));
    assert.notEqual(call.tool, "pnpm");
  }
}

function assertAuthFreeAndClean(state) {
  for (const call of state.calls.filter(({ tool }) => tool === "npm")) {
    assert.equal(call.nodeAuthTokenPresent, false);
    assert.equal(call.npmTokenPresent, false);
    assert.equal(call.npmIdTokenPresent, false);
    assert.equal(call.nodeOptionsPresent, false);
    assert.equal(call.npmrc, `registry=${registry}\nignore-scripts=true\n`);
    assert.equal(call.globalNpmrc, "");
    assert.doesNotMatch(`${call.npmrc}${call.globalNpmrc}`, /auth|token/iu);
    assert.equal(fs.existsSync(call.npmrcPath), false);
    assert.equal(fs.existsSync(call.globalNpmrcPath), false);
    const allowed = new Set([
      "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
      "ACTIONS_ID_TOKEN_REQUEST_URL",
      "CI",
      "GITHUB_ACTIONS",
      "GITHUB_EVENT_NAME",
      "GITHUB_REF",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_RUN_ATTEMPT",
      "GITHUB_RUN_ID",
      "GITHUB_SERVER_URL",
      "GITHUB_SHA",
      "GITHUB_WORKFLOW_REF",
      "RUNNER_ENVIRONMENT",
      "HOME",
      "NPM_CONFIG_CACHE",
      "NPM_CONFIG_GLOBALCONFIG",
      "NPM_CONFIG_REGISTRY",
      "NPM_CONFIG_USERCONFIG",
      "PATH",
      "TMPDIR",
      "__CF_USER_TEXT_ENCODING",
    ]);
    assert.deepEqual(
      call.environmentKeys.filter((name) => !allowed.has(name)),
      [],
    );
  }
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

function matchingPresent(
  names = packageNames,
  tag = defaultNpmTag,
  latest = tag === "latest" ? version : "0.5.0",
) {
  return {
    npmTag: tag,
    states: Object.fromEntries(names.map((name) => [name, "present"])),
    tags: Object.fromEntries(
      names.map((name) => [name, { [tag]: version, latest }]),
    ),
  };
}

test("rejects ambient npm tokens before any npm invocation", async (t) => {
  for (const [name, value] of [
    ["NODE_AUTH_TOKEN", hostileOutput],
    ["NPM_TOKEN", hostileOutput],
    ["NPM_ID_TOKEN", hostileOutput],
    ["NODE_AUTH_TOKEN", ""],
    ["npm_config_auth_token", hostileOutput],
    ["NPM_CONFIG__PASSWORD", hostileOutput],
    ["NPM_CONFIG_USERNAME", hostileOutput],
    ["NPM_CONFIG_OTP", "123456"],
    ["NPM_CONFIG_CERT", hostileOutput],
    ["NPM_CONFIG_KEY", hostileOutput],
    ["NODE_OPTIONS", `--require=${hostileOutput}`],
    ["NPM_REGISTRY", "https://registry.example/"],
    ["NPM_CONFIG_REGISTRY", "https://registry.example/"],
  ]) {
    await t.test(`${name} present`, () => {
      const fixture = setup();
      try {
        const result = run(fixture, { [name]: value });
        assert.notEqual(result.status, 0);
        assert.deepEqual(result.state.calls, []);
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

test("rejects missing, extra, or malformed packed inventory before npm", async (t) => {
  for (const scenario of ["missing", "extra", "malformed"]) {
    await t.test(scenario, () => {
      const fixture = setup();
      try {
        if (scenario === "missing")
          fs.rmSync(fixture.state.packages[packageNames.at(-1)].localTarball);
        if (scenario === "extra")
          fs.copyFileSync(
            fixture.state.packages[packageNames[0]].localTarball,
            path.join(fixture.assets, "extra.tgz"),
          );
        if (scenario === "malformed")
          fs.writeFileSync(
            fixture.state.packages[packageNames[0]].localTarball,
            "not a tarball",
          );
        const result = run(fixture);
        assert.notEqual(result.status, 0);
        assert.deepEqual(result.state.calls, []);
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("rejects packed publish authority metadata drift before npm", async (t) => {
  const packageName = packageNames[2];
  for (const [label, manifestOverrides] of [
    ["name", { name: "@midnight-ntwrk/wrong" }],
    [
      "registry",
      { publishConfig: { access: "public", registry: "https://invalid/" } },
    ],
    ["access", { publishConfig: { access: "restricted", registry } }],
    [
      "repository",
      {
        repository: {
          type: "git",
          url: "git+https://github.com/other/repo.git",
          directory: "packages/domain",
        },
      },
    ],
  ]) {
    await t.test(label, () => {
      const fixture = setup({
        manifestOverrides: { [packageName]: manifestOverrides },
      });
      try {
        const result = run(fixture);
        assert.notEqual(result.status, 0);
        assert.deepEqual(result.state.calls, []);
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("all-absent state publishes all five with exact npm arguments in dependency order", () => {
  const fixture = setup();
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const publishes = publishCalls(result.state);
    assert.deepEqual(
      publishes.map(({ packageName }) => packageName),
      packageNames,
    );
    const versionChecks = result.state.calls.filter(
      ({ tool, args }) => tool === "npm" && args[0] === "--version",
    );
    assert.equal(versionChecks.length, 1);
    assert.ok(
      result.state.calls.indexOf(versionChecks[0]) <
        result.state.calls.indexOf(publishes[0]),
    );
    for (const call of publishes) {
      const tarball = result.state.packages[call.packageName].localTarball;
      assert.deepEqual(call.args, [
        "publish",
        "--provenance",
        "--ignore-scripts",
        "--tag",
        fixture.state.npmTag,
        "--access",
        "public",
        "--registry",
        registry,
        tarball,
      ]);
    }
    assertNoAdministration(result.state);
    assertAuthFreeAndClean(result.state);
  } finally {
    cleanup(fixture);
  }
});

test("old npm fails at the publication boundary before the first publish", () => {
  const fixture = setup({ npmVersion: "11.5.0\n" });
  try {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(publishCalls(result.state), []);
    assert.match(
      result.stderr,
      /npm 11\.5\.1 or newer.*publication boundary/iu,
    );
  } finally {
    cleanup(fixture);
  }
});

test("all-present matching rerun publishes nothing and completes final readback", () => {
  const fixture = setup(matchingPresent());
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(publishCalls(result.state), []);
    for (const name of packageNames)
      assert.ok(result.state.packages[name].exactReads >= 2);
    assert.match(
      result.stdout,
      /Final all-five public metadata, payload, and dist-tag verification succeeded/u,
    );
    assertNoAdministration(result.state);
  } finally {
    cleanup(fixture);
  }
});

test("partial recovery publishes only missing packages when every existing payload and tag matches", () => {
  const existing = [packageNames[0], packageNames[2]];
  const fixture = setup(matchingPresent(existing));
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(
      publishCalls(result.state).map(({ packageName }) => packageName),
      [packageNames[1], packageNames[3], packageNames[4]],
    );
    assertNoAdministration(result.state);
  } finally {
    cleanup(fixture);
  }
});

test("existing payload mismatch fails before any mutation", () => {
  const fixture = setup(matchingPresent([packageNames[1]]));
  try {
    const pkg = fixture.state.packages[packageNames[1]];
    pkg.remoteIntegrity = pkg.corruptIntegrity;
    pkg.remoteTarball = pkg.corruptTarball;
    persist(fixture);
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(publishCalls(result.state), []);
    assertNoAdministration(result.state);
  } finally {
    cleanup(fixture);
  }
});

test("missing or wrong requested tag on an existing version fails before publication", async (t) => {
  for (const tags of [
    {},
    { [defaultNpmTag]: "0.0.0-wrong" },
    { latest: version },
  ]) {
    await t.test(JSON.stringify(tags), () => {
      const fixture = setup({
        states: { [packageNames[3]]: "present" },
        tags: { [packageNames[3]]: tags },
      });
      try {
        const result = run(fixture);
        assert.notEqual(result.status, 0);
        assert.deepEqual(publishCalls(result.state), []);
        assertNoAdministration(result.state);
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("non-latest target owning latest fails before publication", () => {
  const fixture = setup({
    states: { [packageNames[0]]: "present" },
    tags: {
      [packageNames[0]]: { [defaultNpmTag]: version, latest: version },
    },
  });
  try {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(publishCalls(result.state), []);
    assertNoAdministration(result.state);
  } finally {
    cleanup(fixture);
  }
});

test("late all-five read failures and malformed tags fail before publication with hostile output suppressed", async (t) => {
  for (const mode of ["target", "visibility", "tags", "malformedTags"]) {
    await t.test(mode, () => {
      const fixture = setup();
      try {
        const pkg = fixture.state.packages[packageNames.at(-1)];
        if (mode === "target") pkg.target = "error";
        else pkg[mode === "visibility" ? "visibilityError" : mode] = true;
        persist(fixture);
        const result = run(fixture);
        assert.notEqual(result.status, 0);
        assert.deepEqual(publishCalls(result.state), []);
        assert.doesNotMatch(
          `${result.stdout}${result.stderr}`,
          /must-not-leak/u,
        );
        assertNoAdministration(result.state);
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("publish failure stops immediately, invokes no later package, and suppresses provider output", () => {
  const fixture = setup();
  try {
    fixture.state.failPublish = packageNames[2];
    persist(fixture);
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(
      publishCalls(result.state).map(({ packageName }) => packageName),
      packageNames.slice(0, 3),
    );
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /must-not-leak/u);
    assertNoAdministration(result.state);
  } finally {
    cleanup(fixture);
  }
});

test("retry recognizes a publish that succeeded despite a lost response and continues safely", () => {
  const fixture = setup();
  try {
    fixture.state.lostResponse = packageNames[1];
    persist(fixture);
    const first = run(fixture);
    assert.notEqual(first.status, 0);
    assert.deepEqual(
      publishCalls(first.state).map(({ packageName }) => packageName),
      packageNames.slice(0, 2),
    );

    fixture.state = first.state;
    fixture.state.calls = [];
    delete fixture.state.lostResponse;
    persist(fixture);
    const retry = run(fixture);
    assert.equal(retry.status, 0, `${retry.stdout}\n${retry.stderr}`);
    assert.deepEqual(
      publishCalls(retry.state).map(({ packageName }) => packageName),
      packageNames.slice(2),
    );
    assertNoAdministration(retry.state);
  } finally {
    cleanup(fixture);
  }
});

test("corrupt payload or wrong tag on the first successful publish blocks every dependent package", async (t) => {
  for (const [label, options] of [
    ["payload", { corruptAfterPublish: [packageNames[0]] }],
    ["tag", { wrongTagAfterPublish: [packageNames[0]] }],
  ]) {
    await t.test(label, () => {
      const fixture = setup(options);
      try {
        const result = run(fixture);
        assert.notEqual(result.status, 0);
        assert.deepEqual(
          publishCalls(result.state).map(({ packageName }) => packageName),
          [packageNames[0]],
        );
        assertNoAdministration(result.state);
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("snapshot, RC, and latest support fresh, partial, lost-response, and idempotent publication", async (t) => {
  for (const tag of ["snapshot", "rc", "latest"]) {
    await t.test(tag, async (t) => {
      const previousLatest = "0.5.0";
      const initialTags = Object.fromEntries(
        packageNames.map((name) => [name, { latest: previousLatest }]),
      );

      await t.test("fresh and idempotent rerun", () => {
        const fixture = setup({ npmTag: tag, tags: initialTags });
        try {
          const fresh = run(fixture);
          assert.equal(fresh.status, 0, `${fresh.stdout}\n${fresh.stderr}`);
          assert.equal(publishCalls(fresh.state).length, 5);
          for (const pkg of Object.values(fresh.state.packages)) {
            assert.equal(pkg.tags[tag], version);
            assert.equal(
              pkg.tags.latest,
              tag === "latest" ? version : previousLatest,
            );
          }

          fixture.state = fresh.state;
          fixture.state.calls = [];
          persist(fixture);
          const rerun = run(fixture);
          assert.equal(rerun.status, 0, `${rerun.stdout}\n${rerun.stderr}`);
          assert.deepEqual(publishCalls(rerun.state), []);
        } finally {
          cleanup(fixture);
        }
      });

      await t.test("partial recovery", () => {
        const fixture = setup({
          ...matchingPresent(packageNames.slice(0, 2), tag),
          tags: {
            ...initialTags,
            ...matchingPresent(packageNames.slice(0, 2), tag).tags,
          },
        });
        try {
          const result = run(fixture);
          assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
          assert.deepEqual(
            publishCalls(result.state).map(({ packageName }) => packageName),
            packageNames.slice(2),
          );
        } finally {
          cleanup(fixture);
        }
      });

      await t.test("lost response recovery", () => {
        const fixture = setup({ npmTag: tag, tags: initialTags });
        try {
          fixture.state.lostResponse = packageNames[0];
          persist(fixture);
          const first = run(fixture);
          assert.notEqual(first.status, 0);
          assert.deepEqual(
            publishCalls(first.state).map(({ packageName }) => packageName),
            [packageNames[0]],
          );

          fixture.state = first.state;
          fixture.state.calls = [];
          delete fixture.state.lostResponse;
          persist(fixture);
          const retry = run(fixture);
          assert.equal(retry.status, 0, `${retry.stdout}\n${retry.stderr}`);
          assert.deepEqual(
            publishCalls(retry.state).map(({ packageName }) => packageName),
            packageNames.slice(1),
          );
        } finally {
          cleanup(fixture);
        }
      });
    });
  }
});

test("bounded provider runner terminates a hanging subprocess", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bounded-provider-test-"));
  const outputFile = path.join(root, "output");
  try {
    const started = Date.now();
    const result = await runBoundedCommand({
      command: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"],
      outputFile,
      outputLimit: 1024,
      timeoutMs: 500,
    });
    assert.equal(result.reason, "timeout");
    assert.ok(Date.now() - started < 5_000);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed on oversized registry output before publication", () => {
  const fixture = setup();
  try {
    fixture.state.oversizedOperation = "view";
    fixture.state.oversizedPackage = packageNames[0];
    fixture.state.oversizedBytes = 128 * 1024;
    persist(fixture);
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(publishCalls(result.state), []);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /x{100}/u);
  } finally {
    cleanup(fixture);
  }
});

test("fails closed on oversized publish output before any dependent package", () => {
  const fixture = setup();
  try {
    fixture.state.oversizedOperation = "publish";
    fixture.state.oversizedPackage = packageNames[0];
    fixture.state.oversizedBytes = 128 * 1024;
    persist(fixture);
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(
      publishCalls(result.state).map(({ packageName }) => packageName),
      [packageNames[0]],
    );
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /x{100}/u);
  } finally {
    cleanup(fixture);
  }
});

test("publisher has one bounded npm publish call site and bounded tarball downloads", () => {
  const source = fs.readFileSync(publisher, "utf8");
  assert.equal(
    (
      source.match(
        /run_bounded_npm publish "\$\{publish_output\}" publish --provenance --ignore-scripts/gu,
      ) ?? []
    ).length,
    1,
  );
  assert.match(source, /verify_npm_version_at_publication_boundary/u);
  assert.match(source, /trusted_publishing_minimum_npm_version="11\.5\.1"/u);
  assert.match(source, /run_bounded_npm[\s\S]*publish/u);
  assert.match(source, /--connect-timeout/u);
  assert.match(source, /--max-time/u);
  assert.match(source, /--max-filesize/u);
  assert.match(source, /env -i/u);
  assert.doesNotMatch(source, /\bnpm\s+(?:access|dist-tag)\b/u);
  assert.doesNotMatch(source, /\bpnpm\s+publish\b/u);
  assert.doesNotMatch(
    source,
    /_authToken|NODE_AUTH_TOKEN=.*\$\{|NPM_TOKEN=.*\$\{/u,
  );
});
