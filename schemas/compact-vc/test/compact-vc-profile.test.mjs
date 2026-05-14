import assert from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  compactVcCanonicalDigest,
  compactVcEnvelope,
  stableCanonicalJson,
} from "../src/index.mjs";

const fixturesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

const vectors = JSON.parse(
  readFileSync(path.join(fixturesRoot, "hash-vectors.json"), "utf8"),
);

test("compact VC schema helpers produce deterministic canonical JSON", () => {
  const original = {
    z: 3,
    a: 1,
    m: {
      z: "last",
      a: "first",
    },
    b: [3, 2, 1],
    c: "x",
  };
  const reordered = {
    c: "x",
    b: [3, 2, 1],
    a: 1,
    m: {
      a: "first",
      z: "last",
    },
    z: 3,
  };

  assert.strictEqual(stableCanonicalJson(original), stableCanonicalJson(reordered));
});

test("compact VC schema helpers calculate stable hash for known fixtures", () => {
  for (const vector of vectors) {
    const rawPayload = JSON.parse(
      readFileSync(path.join(fixturesRoot, vector.fixture), "utf8"),
    );
    const envelope = compactVcEnvelope(rawPayload);
    const digest = compactVcCanonicalDigest(envelope);
    assert.strictEqual(digest, vector.expectedSha256Hex);
  }
});
