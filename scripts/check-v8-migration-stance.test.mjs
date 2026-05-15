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

const createFixtureRoot = ({ doc }) => {
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
      "export circuit updateVerificationMethod",
      "export circuit removeVerificationMethod",
    ].join("\n"),
  );
  writeFixtureFile(
    rootDir,
    "contract/src/index.ts",
    "export type { DIDPrivateState } from './witnesses';\n",
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

test("v8 migration stance check can run outside the repository cwd", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "v8-migration-cwd-"));
  const result = runScript(SCRIPT_PATH, tempDir);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("v8 migration stance validated"));

  rmSync(tempDir, { recursive: true, force: true });
});

test("v8 migration stance check requires exact typ documentation", () => {
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
  const result = runScript(
    path.join(rootDir, "scripts/check-v8-migration-stance.mjs"),
    rootDir,
  );

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("missing required fragment: `typ`"));

  rmSync(rootDir, { recursive: true, force: true });
});

test("v8 migration stance check reports missing files without a node stack", () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), "v8-migration-missing-"));
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

  rmSync(rootDir, { recursive: true, force: true });
});
