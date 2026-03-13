import { describe, expect, it } from "vitest";

import { UnsupportedCurveError } from "../errors.js";
import { deriveCurvePrivateFromSeed } from "../hd-derivation.js";

describe("deriveCurvePrivateFromSeed", () => {
  const seedHex =
    "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

  it("derives deterministic Ed25519 keys from seed", () => {
    const first = deriveCurvePrivateFromSeed({
      id: "ed",
      seedHex,
      kty: "OKP",
      crv: "Ed25519",
    });
    const second = deriveCurvePrivateFromSeed({
      id: "ed",
      seedHex,
      kty: "OKP",
      crv: "Ed25519",
    });

    expect(first.privateKey).toHaveLength(32);
    expect(Array.from(first.privateKey)).toEqual(Array.from(second.privateKey));
  });

  it("derives deterministic Jubjub and P-256 keys from seed", () => {
    const jubjub = deriveCurvePrivateFromSeed({
      id: "jj",
      seedHex,
      kty: "EC",
      crv: "Jubjub",
      account: 1,
      index: 2,
    });
    const p256 = deriveCurvePrivateFromSeed({
      id: "p256",
      seedHex,
      kty: "EC",
      crv: "P-256",
      account: 1,
      index: 2,
    });

    expect(jubjub.privateKey).toHaveLength(32);
    expect(p256.privateKey).toHaveLength(32);
    expect(Buffer.from(p256.privateKey).equals(Buffer.alloc(32))).toBe(false);
  });

  it("rejects invalid derivation parameters", () => {
    expect(() =>
      deriveCurvePrivateFromSeed({
        id: "bad-seed",
        seedHex: "zz",
        kty: "OKP",
        crv: "Ed25519",
      }),
    ).toThrow("seedHex must be a valid even-length hex string");

    expect(() =>
      deriveCurvePrivateFromSeed({
        id: "bad-index",
        seedHex,
        kty: "EC",
        crv: "Jubjub",
        account: -1,
      }),
    ).toThrow("account, index, and candidate must be non-negative integers");
  });

  it("rejects unsupported curves", () => {
    expect(() =>
      deriveCurvePrivateFromSeed({
        id: "bad-curve",
        seedHex,
        kty: "EC",
        crv: "X25519" as never,
      }),
    ).toThrow(UnsupportedCurveError);
  });
});
