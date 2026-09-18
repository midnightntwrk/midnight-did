import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertCurrentBaselineMatchesEvidence,
  buildCompatibilityPage,
  loadCompatibilityBaselines,
  readCurrentCompatibilityEvidence,
} from "./sync-compatibility.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const evidenceFixturePaths = [
  ".nvmrc",
  ".github/workflows/ci.yml",
  ".github/workflows/publish.yml",
  ".github/workflows/quality.yml",
  "package.json",
  "packages/api/package.json",
  "packages/contract/package.json",
  "packages/contract/src/did.compact",
  "packages/did/package.json",
  "packages/domain/package.json",
  "packages/jubjub-schnorr/package.json",
  "packages/jubjub-schnorr/src/jubjub-schnorr.compact",
];

const evidenceFixture = async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "did-compatibility-test-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  await Promise.all(
    evidenceFixturePaths.map(async (relativePath) => {
      const target = path.join(root, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(repoRoot, relativePath), target);
    }),
  );
  return root;
};

const updateManifest = async (root, relativePath, update) => {
  const filePath = path.join(root, relativePath);
  const manifest = JSON.parse(await readFile(filePath, "utf8"));
  update(manifest);
  await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

const replaceFixtureText = async (root, relativePath, before, after) => {
  const filePath = path.join(root, relativePath);
  const source = await readFile(filePath, "utf8");
  assert.match(source, new RegExp(before.replaceAll(".", "\\."), "u"));
  await writeFile(filePath, source.replace(before, after), "utf8");
};

test("extracts the current compatibility row from repository evidence", async () => {
  const evidence = await readCurrentCompatibilityEvidence();

  assert.equal(evidence.version, "0.6.0");
  assert.equal(evidence.nodeMajor, "24");
  assert.equal(evidence.pnpm, "10.34.5");
  assert.equal(evidence.compactCompiler, "0.31.1");
  assert.equal(evidence.didLanguagePragma, ">= 0.20");
  assert.equal(evidence.jubjubLanguagePragma, ">= 0.22");
  assert.equal(evidence.compactRuntime, "0.16.0");
  assert.equal(evidence.compactJs, "2.5.0");
  assert.equal(evidence.ledger, "@midnight-ntwrk/ledger-v8@8.1.0");
  assert.equal(evidence.midnightJsFamily, "4.0.2");
  assert.equal(evidence.proofServer, "midnightntwrk/proof-server:8.0.3");
  assert.deepEqual(
    new Set(Object.values(evidence.packageVersions)),
    new Set(["0.6.0"]),
  );
});

test("fails when duplicated authoritative current pins disagree", async (t) => {
  const cases = [
    {
      name: "Compact compiler workflow constants",
      mutate: (root) =>
        replaceFixtureText(
          root,
          ".github/workflows/quality.yml",
          "COMPACT_COMPILER_VERSION: 0.31.1",
          "COMPACT_COMPILER_VERSION: 0.31.2",
        ),
      error: /Compact compiler pins disagree/u,
    },
    {
      name: "ledger package manifests",
      mutate: (root) =>
        updateManifest(root, "packages/api/package.json", (manifest) => {
          manifest.dependencies["@midnight-ntwrk/ledger-v8"] = "8.2.0";
        }),
      error: /dependency @midnight-ntwrk\/ledger-v8 pins disagree/u,
    },
    {
      name: "Midnight JS package manifests",
      mutate: (root) =>
        updateManifest(root, "packages/api/package.json", (manifest) => {
          manifest.dependencies["@midnight-ntwrk/midnight-js-contracts"] =
            "4.0.3";
        }),
      error: /Midnight JS package family pins disagree/u,
    },
    {
      name: "wallet SDK package manifests",
      mutate: (root) =>
        updateManifest(root, "packages/api/package.json", (manifest) => {
          manifest.dependencies["@midnight-ntwrk/wallet-sdk-dust-wallet"] =
            "3.0.1";
        }),
      error:
        /wallet SDK dependency @midnight-ntwrk\/wallet-sdk-dust-wallet pins disagree/u,
    },
    {
      name: "Compact runtime package manifests",
      mutate: (root) =>
        updateManifest(root, "packages/domain/package.json", (manifest) => {
          manifest.dependencies["@midnight-ntwrk/compact-runtime"] = "0.16.1";
        }),
      error: /dependency @midnight-ntwrk\/compact-runtime pins disagree/u,
    },
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, async (subtest) => {
      const root = await evidenceFixture(subtest);
      await fixtureCase.mutate(root);
      await assert.rejects(
        () => readCurrentCompatibilityEvidence(root),
        fixtureCase.error,
      );
    });
  }
});

test("loads the reviewed baseline from its repository-relative data file", async () => {
  const source = await loadCompatibilityBaselines();

  assert.equal(source.currentRelease, "0.6.0");
  assert.equal(source.baselines.at(-1).version, source.currentRelease);
});

test("fails closed when a current repository pin drifts from reviewed baseline data", async () => {
  const evidence = await readCurrentCompatibilityEvidence();
  const source = await loadCompatibilityBaselines();
  const current = source.baselines.find(
    ({ version }) => version === source.currentRelease,
  );
  const drifted = structuredClone(evidence);
  drifted.compactCompiler = "0.31.2";

  assert.throws(
    () => assertCurrentBaselineMatchesEvidence(drifted, current),
    /stale for: compactCompiler/u,
  );
});

test("generated compatibility page records status semantics and 0.5 manifest caveat", async () => {
  const { content } = await buildCompatibilityPage();

  assert.match(content, /\*\*Current\*\* means the latest published/u);
  assert.match(
    content,
    /Compatibility reference\*\* records a\s+legacy release/u,
  );
  assert.match(content, /no continuing-support implication/u);
  assert.match(content, /v0\.5\.0.*a14267cec3c1ab7e00bb0f058a54267d913a321b/u);
  assert.match(content, /v0\.6\.0.*8f788e2ef5652fa7f9cfdc71a3cac40d5f3683bf/u);
  assert.match(content, /source tag reports version\n`0\.4\.0`/u);
  assert.match(content, /does not infer\nsupport for newer Node/u);
});

test("committed compatibility page matches generated repository evidence", async () => {
  const [{ content }, committed] = await Promise.all([
    buildCompatibilityPage(),
    readFile("docs-site/guide/compatibility.md", "utf8"),
  ]);

  assert.equal(committed, content);
});
