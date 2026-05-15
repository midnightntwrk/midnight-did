import { spawnSync } from "node:child_process";
import { strict as assert } from "node:assert";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import test from "node:test";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SCRIPT_PATH = path.join(ROOT_DIR, "scripts/check-v8-migration-stance.mjs");
const VALID_DOC = [
  "# v8 Ledger and State Migration Stance",
  "Legacy deployed DID state is not automatically migrated",
  "The Compact ledger structs use `typ` instead of `type`.",
  "ledger-operation-builder",
  "`DIDPrivateState`",
  "removeVerificationMethod",
  "non-batched",
  "migration utility",
  "Unsupported",
].join("\n");

const runScript = (scriptPath, cwd) =>
  spawnSync("node", [scriptPath], {
    cwd,
    encoding: "utf8",
    env: process.env,
  });

const writeFixtureFile = (rootDir, relativePath, content) => {
  const filePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
};

const createFixtureRoot = ({
  doc = VALID_DOC,
  contractIndex = 'export * from "./witnesses.js";\n',
} = {}) => {
  const rootDir = mkdtempSync(path.join(tmpdir(), "v8-migration-stance-"));
  writeFixtureFile(
    rootDir,
    "scripts/check-v8-migration-stance.mjs",
    readFileSync(SCRIPT_PATH, "utf8"),
  );
  writeFixtureFile(rootDir, "docs/v8-ledger-state-migration.md", doc);
  writeFixtureFile(
    rootDir,
    "contract/src/did.compact",
    [
      "struct VerificationMethod",
      "typ: VerificationMethodType",
      "struct Service",
      'typ: Opaque<"string">',
      "export circuit addVerificationMethod",
      "export circuit updateVerificationMethod",
      "export circuit removeVerificationMethod",
      "export circuit addVerificationMethodRelation",
      "export circuit removeVerificationMethodRelation",
      "export circuit addService",
      "export circuit updateService",
      "export circuit removeService",
      "export circuit addAlsoKnownAs",
      "export circuit removeAlsoKnownAs",
      "export circuit deactivate",
    ].join("\n"),
  );
  writeFixtureFile(
    rootDir,
    "contract/src/index.ts",
    contractIndex,
  );
  writeFixtureFile(
    rootDir,
    "contract/src/witnesses.ts",
    "export type DIDPrivateState = { readonly secretKey: Uint8Array };\n",
  );
  writeFixtureFile(
    rootDir,
    "README.md",
    "See docs/v8-ledger-state-migration.md\n",
  );
  writeFixtureFile(
    rootDir,
    "docs/repository-maturity-backlog.md",
    [
      "62. ✅ **Done: Document the v8 ledger/state migration stance**",
      "docs/v8-ledger-state-migration.md",
    ].join("\n"),
  );

  return rootDir;
};

test("v8 migration stance check can run outside the fixture cwd", (t) => {
  const rootDir = createFixtureRoot();
  const tempDir = mkdtempSync(path.join(tmpdir(), "v8-migration-cwd-"));
  t.after(() => {
    rmSync(rootDir, { recursive: true, force: true });
    rmSync(tempDir, { recursive: true, force: true });
  });
  const result = runScript(
    path.join(rootDir, "scripts/check-v8-migration-stance.mjs"),
    tempDir,
  );

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("v8 migration stance validated"));
});

test("v8 migration stance check requires exact typ documentation", (t) => {
  const rootDir = createFixtureRoot({
    doc: [
      "# v8 Ledger and State Migration Stance",
      "Legacy deployed DID state is not automatically migrated",
      "This fixture mentions type many times but omits the ledger literal.",
      "ledger-operation-builder",
      "`DIDPrivateState`",
      "removeVerificationMethod",
      "non-batched",
      "migration utility",
      "Unsupported",
    ].join("\n"),
  });
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const result = runScript(
    path.join(rootDir, "scripts/check-v8-migration-stance.mjs"),
    rootDir,
  );

  assert.equal(result.status, 1);
  assert.ok(
    result.stderr.includes(
      "missing required fragment: The Compact ledger structs use `typ` instead of `type`.",
    ),
    result.stderr,
  );
});

test("v8 migration stance check rejects restored forbidden exports", (t) => {
  for (const forbiddenExport of [
    'export * from "./ledger-operation-builder.js";',
    "export type MidnightDIDPrivateState = DIDPrivateState;",
  ]) {
    const rootDir = createFixtureRoot({
      contractIndex: ['export * from "./witnesses.js";', forbiddenExport].join(
        "\n",
      ),
    });
    t.after(() => rmSync(rootDir, { recursive: true, force: true }));
    const result = runScript(
      path.join(rootDir, "scripts/check-v8-migration-stance.mjs"),
      rootDir,
    );

    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes("contract/src/index.ts must not restore"),
      result.stderr,
    );
  }
});

test("v8 migration stance check ignores forbidden names outside export lines", (t) => {
  const rootDir = createFixtureRoot({
    contractIndex: [
      'export * from "./witnesses.js";',
      "// removed: ledger-operation-builder",
      "// removed: MidnightDIDPrivateState",
    ].join("\n"),
  });
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const result = runScript(
    path.join(rootDir, "scripts/check-v8-migration-stance.mjs"),
    rootDir,
  );

  assert.equal(result.status, 0, result.stderr);
});

test("v8 migration stance check requires DIDPrivateState re-export", (t) => {
  const rootDir = createFixtureRoot({
    contractIndex: "export const currentContractSurface = true;\n",
  });
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const result = runScript(
    path.join(rootDir, "scripts/check-v8-migration-stance.mjs"),
    rootDir,
  );

  assert.equal(result.status, 1);
  assert.ok(
    result.stderr.includes("contract/src/index.ts must re-export DIDPrivateState"),
    result.stderr,
  );
});

test("v8 migration stance check reports missing files without a node stack", (t) => {
  const rootDir = mkdtempSync(path.join(tmpdir(), "v8-migration-missing-"));
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  writeFixtureFile(
    rootDir,
    "scripts/check-v8-migration-stance.mjs",
    readFileSync(SCRIPT_PATH, "utf8"),
  );
  const result = runScript(
    path.join(rootDir, "scripts/check-v8-migration-stance.mjs"),
    rootDir,
  );

  assert.equal(result.status, 1);
  assert.ok(
    result.stderr.includes(
      "[check-v8-migration-stance] docs/v8-ledger-state-migration.md is missing or unreadable",
    ),
    result.stderr,
  );
  assert.ok(!result.stderr.includes("Error: ENOENT"), result.stderr);
});
