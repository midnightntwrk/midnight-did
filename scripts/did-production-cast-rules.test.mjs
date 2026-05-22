import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findProductionCastViolations,
  isApiProductionSource,
  productionCastViolationsForSource,
  stripCommentsAndStrings,
} from "./did-production-cast-rules.mjs";

describe("DID production cast rules", () => {
  it("scans only production API TypeScript source", () => {
    assert.equal(isApiProductionSource("packages/api/src/wallet.ts"), true);
    assert.equal(
      isApiProductionSource("packages/api/src/test/wallet.test.ts"),
      false,
    );
    assert.equal(
      isApiProductionSource("packages/domain/src/schema.ts"),
      false,
    );
    assert.equal(isApiProductionSource("packages/api/src/wallet.js"), false);
  });

  it("ignores cast-looking text in comments and strings", () => {
    const source = `
      // const unsafe = value as any;
      /* const unsafe = value as unknown as Wallet; */
      const text = "do not flag as any inside a diagnostic";
      const template = \`do not flag as unknown as inside docs\`;
      const typed = value as WalletProvider;
    `;

    assert.equal(stripCommentsAndStrings(source).includes("as any"), false);
    assert.deepEqual(
      productionCastViolationsForSource("packages/api/src/wallet.ts", source),
      [],
    );
  });

  it("rejects production as-any casts", () => {
    assert.deepEqual(
      productionCastViolationsForSource(
        "packages/api/src/wallet.ts",
        "const unsafe = value as any;",
      ),
      [
        "packages/api/src/wallet.ts production API source must not use `as any` casts",
      ],
    );
  });

  it("rejects production double-unknown casts unless the file is allowlisted", () => {
    assert.deepEqual(
      productionCastViolationsForSource(
        "packages/api/src/wallet.ts",
        "const wallet = value as unknown as Wallet;",
      ),
      [
        "packages/api/src/wallet.ts production API source must not use `as unknown as` casts",
      ],
    );

    assert.deepEqual(
      productionCastViolationsForSource(
        "packages/api/src/contract-instance.ts",
        "const contract = value as unknown as CompiledContract;",
      ),
      [],
    );
  });

  it("finds violations across source paths and ignores tests", () => {
    const sources = new Map([
      ["packages/api/src/wallet.ts", "const unsafe = value as any;"],
      ["packages/api/src/test/wallet.test.ts", "const unsafe = value as any;"],
      ["packages/domain/src/schema.ts", "const unsafe = value as any;"],
    ]);

    assert.deepEqual(
      findProductionCastViolations([...sources.keys()], (sourcePath) => {
        const source = sources.get(sourcePath);
        assert.equal(typeof source, "string");
        return source;
      }),
      [
        "packages/api/src/wallet.ts production API source must not use `as any` casts",
      ],
    );
  });
});
