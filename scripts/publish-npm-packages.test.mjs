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

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publisher = path.join(repoRoot, "scripts/publish-npm-packages.sh");
const version = "0.6.0";
const registry = "https://registry.invalid/";
const packageNames = [
  "@midnight-ntwrk/midnight-did-jubjub-schnorr",
  "@midnight-ntwrk/midnight-did-contract",
  "@midnight-ntwrk/midnight-did-domain",
  "@midnight-ntwrk/midnight-did",
  "@midnight-ntwrk/midnight-did-api",
];

const fakeNpm = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const statePath = process.env.FAKE_REGISTRY_STATE;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const fail = (message, code = 1) => { console.error(message); save(); process.exit(code); };
const call = { tool: "npm", args, npmrc: process.env.NPM_CONFIG_USERCONFIG };
state.calls.push(call);
const command = args[0];
if (command === "view") {
  const spec = args[1];
  const exactName = Object.keys(state.packages).find((name) => spec === name + "@" + state.version);
  if (exactName) {
    const pkg = state.packages[exactName];
    pkg.exactViewCount = (pkg.exactViewCount || 0) + 1;
    if (pkg.failExactViewAt === pkg.exactViewCount || pkg.target === "error") fail("E500 mocked read failure");
    if (pkg.target === "absent" || pkg.target === "e404") fail("npm error code E404\nnpm error 404 Not Found", 1);
    console.log(JSON.stringify({ name: exactName, version: state.version, dist: { integrity: pkg.remoteIntegrity, tarball: pkg.remoteTarball } }));
    save();
    process.exit(0);
  }
  const pkg = state.packages[spec];
  if (!pkg) fail("E404 unknown package");
  if (args[2] === "name") {
    if (pkg.visibility === "e404") fail("npm error code E404\nnpm error 404 Not Found");
    if (pkg.visibility === "error") fail("E500 mocked package read failure");
    console.log(JSON.stringify(spec));
  } else if (args[2] === "dist-tags") {
    if (pkg.tagsError) fail("E500 mocked tags read failure");
    console.log(JSON.stringify(pkg.tags));
  } else {
    fail("unsupported mocked npm view: " + args.join(" "));
  }
  save();
  process.exit(0);
}
if (command === "access" && args[1] === "get" && args[2] === "status") {
  const name = args[3];
  const expectedArgs = ["access", "get", "status", name, "--json", "--loglevel=error", "--registry", state.registry];
  if (!Object.hasOwn(state.packages, name) || args.length !== expectedArgs.length || args.some((arg, index) => arg !== expectedArgs[index])) {
    fail("unsupported mocked npm access get command; expected exact package and flags: " + expectedArgs.join(" "));
  }
  const pkg = state.packages[name];
  pkg.accessReadCount = (pkg.accessReadCount || 0) + 1;
  if (pkg.failAccessReadAt === pkg.accessReadCount || pkg.access === "error") fail("E403 mocked access read failure");
  const response = pkg.accessResponses?.[pkg.accessReadCount - 1];
  if (response && typeof response === "object" && Object.hasOwn(response, "rawOutput")) {
    call.accessOutput = response.rawOutput;
    process.stdout.write(response.rawOutput);
  } else if (response && typeof response === "object" && Object.hasOwn(response, "rawJson")) {
    call.accessOutput = response.rawJson;
    console.log(response.rawJson);
  } else {
    const accessResponse = response === undefined ? { [name]: pkg.access } : response;
    call.accessResponse = accessResponse;
    console.log(JSON.stringify(accessResponse));
  }
  save();
  process.exit(0);
}
if (command === "access" && args[1] === "set" && args[2] === "status=public") {
  const name = args[3];
  const pkg = state.packages[name];
  pkg.access = pkg.afterSetAccess || "public";
  if (pkg.access === "error-after-set") pkg.access = "error";
  save();
  process.exit(0);
}
if (command === "dist-tag" && args[1] === "add") {
  const [name, targetVersion] = args[2].split(/@(?=[^@]+$)/);
  state.packages[name].tags[args[3]] = targetVersion;
  save();
  process.exit(0);
}
if (command === "dist-tag" && args[1] === "rm") {
  delete state.packages[args[2]].tags[args[3]];
  save();
  process.exit(0);
}
fail("unsupported mocked npm command: " + args.join(" "));
`;

const fakePnpm = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const statePath = process.env.FAKE_REGISTRY_STATE;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
const tarball = args.at(-1);
const entry = Object.entries(state.packages).find(([, pkg]) => pkg.localTarball === tarball);
if (!entry) { console.error("unknown packed tarball: " + tarball); process.exit(1); }
const [name, pkg] = entry;
state.calls.push({ tool: "pnpm", args, packageName: name, npmrc: process.env.NPM_CONFIG_USERCONFIG });
pkg.target = "present";
pkg.remoteIntegrity = pkg.corruptAfterPublish ? pkg.corruptIntegrity : pkg.localIntegrity;
pkg.remoteTarball = pkg.corruptAfterPublish ? pkg.corruptTarball : pathToFileURL(tarball).href;
const tagIndex = args.indexOf("--tag");
pkg.tags[args[tagIndex + 1]] = state.version;
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
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

function makeTarball(root, name, content = name) {
  const source = fs.mkdtempSync(path.join(root, "package-source-"));
  const packageRoot = path.join(source, "package");
  fs.mkdirSync(packageRoot);
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    `${JSON.stringify({ name, version })}\n`,
  );
  fs.writeFileSync(path.join(packageRoot, "index.js"), `${content}\n`);
  const destination = path.join(root, tarballName(name));
  const result = spawnSync(
    "tar",
    ["-czf", destination, "-C", source, "package"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return destination;
}

function integrity(file) {
  return `sha512-${createHash("sha512").update(fs.readFileSync(file)).digest("base64")}`;
}

function setup({
  states = {},
  access = {},
  accessResponses = {},
  tags = {},
  corruptAfterPublish = [],
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "did-npm-publish-test-"));
  const assets = path.join(root, "assets");
  const bin = path.join(root, "bin");
  fs.mkdirSync(assets);
  fs.mkdirSync(bin);
  for (const [name, source] of [
    ["npm", fakeNpm],
    ["pnpm", fakePnpm],
    ["curl", fakeCurl],
  ]) {
    const executable = path.join(bin, name);
    fs.writeFileSync(executable, source, { mode: 0o755 });
  }
  const packages = {};
  for (const name of packageNames) {
    const localTarball = makeTarball(assets, name);
    const corruptTarball = makeTarball(root, name, `${name}-different`);
    packages[name] = {
      visibility: "ok",
      target: states[name] ?? "absent",
      access: access[name] ?? "public",
      accessResponses: accessResponses[name],
      tags: { ...(tags[name] ?? {}) },
      localTarball,
      localIntegrity: integrity(localTarball),
      remoteIntegrity: integrity(localTarball),
      remoteTarball: pathToFileURL(localTarball).href,
      corruptAfterPublish: corruptAfterPublish.includes(name),
      corruptIntegrity: integrity(corruptTarball),
      corruptTarball: pathToFileURL(corruptTarball).href,
    };
  }
  const statePath = path.join(root, "state.json");
  fs.writeFileSync(
    statePath,
    JSON.stringify({ version, registry, calls: [], packages }, null, 2),
  );
  return { root, assets, bin, statePath, packages };
}

function run(fixture, env = {}) {
  const sentinel = "sentinel-token-must-not-leak";
  const result = spawnSync("bash", [publisher], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`,
      FAKE_REGISTRY_STATE: fixture.statePath,
      VERSION: version,
      NPM_TAG: "snapshot",
      NPM_ACCESS: "public",
      NPM_ASSETS_DIR: fixture.assets,
      NPM_REGISTRY: registry,
      NODE_AUTH_TOKEN: sentinel,
      ...env,
    },
  });
  const state = JSON.parse(fs.readFileSync(fixture.statePath, "utf8"));
  return { ...result, state, sentinel };
}

function mutations(calls) {
  return calls.filter(
    ({ tool, args }) =>
      tool === "pnpm" ||
      (tool === "npm" && args[0] === "access" && args[1] === "set") ||
      (tool === "npm" && args[0] === "dist-tag"),
  );
}

function accessReads(calls) {
  return calls.filter(
    ({ tool, args }) =>
      tool === "npm" &&
      args[0] === "access" &&
      args[1] === "get" &&
      args[2] === "status",
  );
}

function expectedAccessReadArgs(packageName) {
  return [
    "access",
    "get",
    "status",
    packageName,
    "--json",
    "--loglevel=error",
    "--registry",
    registry,
  ];
}

function assertExactAccessReads(calls, expectedPackages) {
  assert.deepEqual(
    calls.map(({ args }) => args),
    expectedPackages.map(expectedAccessReadArgs),
  );
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

test("fake npm rejects incomplete or incorrect access-get commands", async (t) => {
  const requestedPackage = packageNames[0];
  const cases = [
    [
      "missing --json",
      [
        "access",
        "get",
        "status",
        requestedPackage,
        "--loglevel=error",
        "--registry",
        registry,
      ],
    ],
    [
      "wrong registry",
      [
        "access",
        "get",
        "status",
        requestedPackage,
        "--json",
        "--loglevel=error",
        "--registry",
        "https://wrong-registry.invalid/",
      ],
    ],
    [
      "wrong package",
      [
        "access",
        "get",
        "status",
        "@midnight-ntwrk/not-requested",
        "--json",
        "--loglevel=error",
        "--registry",
        registry,
      ],
    ],
    [
      "wrong flag order",
      [
        "access",
        "get",
        "status",
        requestedPackage,
        "--loglevel=error",
        "--json",
        "--registry",
        registry,
      ],
    ],
  ];

  for (const [label, args] of cases) {
    await t.test(label, () => {
      const fixture = setup();
      try {
        const result = spawnSync(path.join(fixture.bin, "npm"), args, {
          encoding: "utf8",
          env: {
            ...process.env,
            FAKE_REGISTRY_STATE: fixture.statePath,
          },
        });
        assert.notEqual(result.status, 0);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, /expected exact package and flags/iu);
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("local inventory failure occurs before any registry command", () => {
  const fixture = setup();
  try {
    fs.rmSync(fixture.packages[packageNames.at(-1)].localTarball);
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.state.calls, []);
    assert.match(result.stderr, /packed npm asset|inventory/iu);
  } finally {
    cleanup(fixture);
  }
});

test("late all-five remote read failure performs no mutation", () => {
  const fixture = setup();
  try {
    fixture.packages[packageNames.at(-1)].target = "error";
    fs.writeFileSync(
      fixture.statePath,
      JSON.stringify(
        { version, registry, calls: [], packages: fixture.packages },
        null,
        2,
      ),
    );
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(mutations(result.state.calls), []);
  } finally {
    cleanup(fixture);
  }
});

test("ambiguous package visibility fails closed without mutation", () => {
  const fixture = setup();
  try {
    fixture.packages[packageNames[0]].visibility = "e404";
    fs.writeFileSync(
      fixture.statePath,
      JSON.stringify(
        { version, registry, calls: [], packages: fixture.packages },
        null,
        2,
      ),
    );
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(mutations(result.state.calls), []);
    assert.match(result.stderr, /ambiguous|authorization/iu);
  } finally {
    cleanup(fixture);
  }
});

test("invalid or ambiguous access evidence fails closed without mutation", async (t) => {
  const requestedPackage = packageNames[2];
  const cases = [
    ["bare string", "public"],
    ["malformed JSON", { rawJson: "{" }],
    ["null", null],
    ["number", 1],
    ["boolean", true],
    ["array", ["public"]],
    ["object-valued status", { [requestedPackage]: { status: "public" } }],
    ["number-valued status", { [requestedPackage]: 1 }],
    ["missing key", {}],
    ["wrong key", { "@midnight-ntwrk/not-requested": "public" }],
    [
      "multiple keys",
      {
        [requestedPackage]: "public",
        "@midnight-ntwrk/not-requested": "private",
      },
    ],
    ["empty status", { [requestedPackage]: "" }],
    ["restricted status", { [requestedPackage]: "restricted" }],
    ["unknown status", { [requestedPackage]: "unlisted" }],
  ];

  for (const [label, response] of cases) {
    await t.test(label, () => {
      const fixture = setup({
        accessResponses: { [requestedPackage]: [response] },
      });
      try {
        const result = run(fixture);
        assert.notEqual(result.status, 0);
        assert.deepEqual(mutations(result.state.calls), []);
        assert.match(result.stderr, /npm access status/iu);
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("zero-byte access-status output on the fifth probe fails under set -e before mutation", () => {
  const fifthPackage = packageNames.at(-1);
  const fixture = setup({
    access: { [packageNames[0]]: "private" },
    accessResponses: {
      [fifthPackage]: [{ rawOutput: "" }],
    },
  });
  try {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(mutations(result.state.calls), []);
    assert.equal(
      result.state.calls.filter(({ tool }) => tool === "pnpm").length,
      0,
    );
    assert.equal(
      result.state.calls.filter(
        ({ tool, args }) => tool === "pnpm" && args[0] === "publish",
      ).length,
      0,
    );
    assert.equal(
      result.state.calls.filter(
        ({ tool, args }) =>
          tool === "npm" && args[0] === "access" && args[1] === "set",
      ).length,
      0,
    );
    assert.equal(
      result.state.calls.filter(
        ({ tool, args }) => tool === "npm" && args[0] === "dist-tag",
      ).length,
      0,
    );
    assert.match(result.stderr, /npm access status/iu);
  } finally {
    cleanup(fixture);
  }
});

test("multiple access-status JSON documents on the fifth probe fail before mutation", () => {
  const fifthPackage = packageNames.at(-1);
  const fixture = setup({
    access: { [packageNames[0]]: "private" },
    accessResponses: {
      [fifthPackage]: [
        {
          rawJson: `${JSON.stringify({ [fifthPackage]: "public" })}\n${JSON.stringify({ [fifthPackage]: "private" })}`,
        },
      ],
    },
  });
  try {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(mutations(result.state.calls), []);
    assert.equal(
      result.state.calls.filter(({ tool }) => tool === "pnpm").length,
      0,
    );
    assert.equal(
      result.state.calls.filter(
        ({ tool, args }) =>
          tool === "npm" && args[0] === "access" && args[1] === "set",
      ).length,
      0,
    );
    assert.equal(
      result.state.calls.filter(
        ({ tool, args }) => tool === "npm" && args[0] === "dist-tag",
      ).length,
      0,
    );
    const accessReads = result.state.calls.filter(
      ({ tool, args }) =>
        tool === "npm" &&
        args[0] === "access" &&
        args[1] === "get" &&
        args[2] === "status",
    );
    assert.deepEqual(
      accessReads.map(({ args }) => args[3]),
      packageNames,
    );
    assert.match(result.stderr, /npm access status/iu);
  } finally {
    cleanup(fixture);
  }
});

test("mismatched existing payload fails before producer or metadata mutation", () => {
  const fixture = setup({ states: { [packageNames[1]]: "present" } });
  try {
    const pkg = fixture.packages[packageNames[1]];
    pkg.remoteIntegrity = pkg.corruptIntegrity;
    pkg.remoteTarball = pkg.corruptTarball;
    fs.writeFileSync(
      fixture.statePath,
      JSON.stringify(
        { version, registry, calls: [], packages: fixture.packages },
        null,
        2,
      ),
    );
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(mutations(result.state.calls), []);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /differs|identity|payload/iu,
    );
  } finally {
    cleanup(fixture);
  }
});

test("none-present state publishes all packages in catalog order with provenance", () => {
  const fixture = setup();
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const publishes = result.state.calls.filter(({ tool }) => tool === "pnpm");
    assert.deepEqual(
      publishes.map(({ packageName }) => packageName),
      packageNames,
    );
    for (const { args } of publishes) {
      assert.equal(args[0], "publish");
      assert.ok(args.includes("--provenance"));
      assert.ok(args.includes("--access"));
      assert.ok(args.includes("public"));
    }
  } finally {
    cleanup(fixture);
  }
});

test("matching partial state publishes only missing packages in catalog order", () => {
  const fixture = setup({
    states: { [packageNames[0]]: "present", [packageNames[2]]: "present" },
    tags: {
      [packageNames[0]]: { snapshot: version },
      [packageNames[2]]: { snapshot: version },
    },
  });
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const publishes = result.state.calls.filter(({ tool }) => tool === "pnpm");
    assert.deepEqual(
      publishes.map(({ packageName }) => packageName),
      [packageNames[1], packageNames[3], packageNames[4]],
    );
  } finally {
    cleanup(fixture);
  }
});

test("all-present immutable rerun publishes nothing and avoids redundant metadata writes", () => {
  const states = Object.fromEntries(
    packageNames.map((name) => [name, "present"]),
  );
  const tags = Object.fromEntries(
    packageNames.map((name) => [name, { snapshot: version, latest: "0.5.0" }]),
  );
  const fixture = setup({ states, tags });
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(mutations(result.state.calls), []);
    for (const name of packageNames) {
      assert.ok(
        result.state.packages[name].exactViewCount >= 3,
        `${name} should be verified in preflight, post-publish, and final read-back`,
      );
    }
  } finally {
    cleanup(fixture);
  }
});

test("exact-key public access is a no-op", () => {
  const fixture = setup();
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(
      result.state.calls.some(
        ({ tool, args }) =>
          tool === "npm" && args[0] === "access" && args[1] === "set",
      ),
      false,
    );
  } finally {
    cleanup(fixture);
  }
});

test("exact-key private access is set once, read back public, then published", () => {
  const privatePackage = packageNames[0];
  const fixture = setup({ access: { [privatePackage]: "private" } });
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const calls = result.state.calls;
    const accessSets = calls.filter(
      ({ tool, args }) =>
        tool === "npm" && args[0] === "access" && args[1] === "set",
    );
    assert.equal(accessSets.length, 1);
    assert.equal(accessSets[0].args[3], privatePackage);
    assert.equal(result.state.packages[privatePackage].accessReadCount, 3);
    for (const packageName of packageNames.slice(1)) {
      assert.equal(result.state.packages[packageName].accessReadCount, 2);
    }

    const allAccessReads = accessReads(calls);
    assert.equal(allAccessReads.length, 11);

    const setIndex = calls.indexOf(accessSets[0]);
    const firstPublishIndex = calls.findIndex(({ tool }) => tool === "pnpm");
    assert.ok(setIndex >= 0);
    assert.ok(firstPublishIndex > setIndex);

    const preflightAccessReads = accessReads(calls.slice(0, setIndex));
    assertExactAccessReads(preflightAccessReads, packageNames);

    const reconciliationAccessReads = accessReads(
      calls.slice(setIndex + 1, firstPublishIndex),
    );
    assertExactAccessReads(reconciliationAccessReads, [privatePackage]);
    assert.deepEqual(reconciliationAccessReads[0].accessResponse, {
      [privatePackage]: "public",
    });
    assert.ok(calls.indexOf(reconciliationAccessReads[0]) > setIndex);
    assert.ok(calls.indexOf(reconciliationAccessReads[0]) < firstPublishIndex);

    const lastPublishIndex = calls.findLastIndex(({ tool }) => tool === "pnpm");
    const finalAccessReads = allAccessReads.slice(6);
    assertExactAccessReads(finalAccessReads, packageNames);
    assert.ok(
      finalAccessReads.every(
        (accessRead) => calls.indexOf(accessRead) > lastPublishIndex,
      ),
    );
  } finally {
    cleanup(fixture);
  }
});

test("failed or still-private reconciliation read-back stops before publish", async (t) => {
  for (const [label, afterSetAccess] of [
    ["failed read-back", "error-after-set"],
    ["still-private read-back", "private"],
  ]) {
    await t.test(label, () => {
      const fixture = setup({ access: { [packageNames[0]]: "private" } });
      try {
        fixture.packages[packageNames[0]].afterSetAccess = afterSetAccess;
        fs.writeFileSync(
          fixture.statePath,
          JSON.stringify(
            { version, registry, calls: [], packages: fixture.packages },
            null,
            2,
          ),
        );
        const result = run(fixture);
        assert.notEqual(result.status, 0);
        assert.equal(
          result.state.calls.filter(({ tool }) => tool === "pnpm").length,
          0,
        );
        assert.equal(
          result.state.calls.filter(
            ({ tool, args }) =>
              tool === "npm" && args[0] === "access" && args[1] === "set",
          ).length,
          1,
        );
      } finally {
        cleanup(fixture);
      }
    });
  }
});

test("post-publish all-five verification blocks tag mutation on a corrupt payload", () => {
  const fixture = setup({ corruptAfterPublish: [packageNames[3]] });
  try {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.equal(
      result.state.calls.some(
        ({ tool, args }) => tool === "npm" && args[0] === "dist-tag",
      ),
      false,
    );
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /differs|identity|payload/iu,
    );
  } finally {
    cleanup(fixture);
  }
});

test("temporary npmrc is removed and token is absent from logs", () => {
  const fixture = setup();
  try {
    const result = run(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(
      `${result.stdout}\n${result.stderr}`,
      new RegExp(result.sentinel, "u"),
    );
    const npmrcPaths = new Set(
      result.state.calls.map(({ npmrc }) => npmrc).filter(Boolean),
    );
    assert.equal(npmrcPaths.size, 1);
    for (const npmrc of npmrcPaths) assert.equal(fs.existsSync(npmrc), false);
  } finally {
    cleanup(fixture);
  }
});
