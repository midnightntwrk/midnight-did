#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let hasFailures = false;

const fail = (message) => {
  hasFailures = true;
  console.error(`[check-v8-migration-stance] ${message}`);
  process.exitCode = 1;
};

// This is a wording-anchored drift check, not a semantic proof. Keep fragments
// specific enough to catch source/doc drift without hiding important rewrites.
const read = (relativePath) => {
  try {
    return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(`${relativePath} is missing or unreadable`);
      return "";
    }

    throw error;
  }
};

const requireIncludes = (label, text, fragments) => {
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      fail(`${label} is missing required fragment: ${fragment}`);
    }
  }
};

const docPath = "docs/v8-ledger-state-migration.md";
const doc = read(docPath);
const compact = read("contract/src/did.compact");
const contractIndex = read("contract/src/index.ts");
const witnesses = read("contract/src/witnesses.ts");
const readme = read("README.md");
const backlog = read("docs/repository-maturity-backlog.md");

requireIncludes(docPath, doc, [
  "# v8 Ledger and State Migration Stance",
  "Legacy deployed DID state is not automatically migrated",
  "`typ`",
  "typ: VerificationMethodType",
  "ledger-operation-builder",
  "`DIDPrivateState`",
  "removeVerificationMethod",
  "non-batched",
  "migration utility",
  "Unsupported",
]);

requireIncludes("contract/src/did.compact", compact, [
  "struct VerificationMethod",
  "typ: VerificationMethodType",
  "struct Service",
  'typ: Opaque<"string">',
  "export circuit updateVerificationMethod",
  "export circuit removeVerificationMethod",
]);

requireIncludes("contract/src/witnesses.ts", witnesses, [
  "export type DIDPrivateState",
]);

if (contractIndex.includes("ledger-operation-builder")) {
  fail("contract/src/index.ts must not restore ledger-operation-builder export");
}

if (contractIndex.includes("MidnightDIDPrivateState")) {
  fail("contract/src/index.ts must not restore MidnightDIDPrivateState alias");
}

requireIncludes("README.md", readme, ["docs/v8-ledger-state-migration.md"]);
requireIncludes("docs/repository-maturity-backlog.md", backlog, [
  "62. ✅ **Done: Document the v8 ledger/state migration stance**",
  "docs/v8-ledger-state-migration.md",
]);

if (!hasFailures) {
  console.log("v8 migration stance validated");
}
