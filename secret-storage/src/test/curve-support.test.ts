import { describe, expect, it } from "vitest";

import {
  generateCurveKey,
  importCurveKey,
  isPublicJwkLedgerCompatible,
  normalizePublicForLedger,
  signWithCurveKey,
  verifyWithPublicJwk,
} from "../curve-support.js";
import { UnsupportedCurveError } from "../errors.js";
import { deriveCurvePrivateFromSeed } from "../hd-derivation.js";

const payload = Buffer.from("midnight-did-secret-storage-payload", "utf8");
const seedHex =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

describe("curve-support", () => {
  it.each([
    ["OKP", "Ed25519"],
    ["EC", "P-256"],
    ["EC", "Jubjub"],
  ] as const)("generates, signs and verifies %s/%s keys", async (kty, crv) => {
    const generated = await generateCurveKey(kty, crv);
    const signature = await signWithCurveKey(generated.record, payload);

    expect(signature.length).toBeGreaterThan(0);
    await expect(
      verifyWithPublicJwk(generated.publicJwk, payload, signature),
    ).resolves.toBe(true);
    expect(isPublicJwkLedgerCompatible(generated.publicJwk)).toBe(true);
  });

  it.each([
    ["OKP", "Ed25519"],
    ["EC", "P-256"],
    ["EC", "Jubjub"],
  ] as const)(
    "imports supported private keys for %s/%s and verifies signatures",
    async (kty, crv) => {
      const privateKey =
        crv === "Jubjub"
          ? deriveCurvePrivateFromSeed({
              id: `${kty}-${crv}`,
              seedHex,
              kty,
              crv,
            }).privateKey
          : Buffer.from(
              (await generateCurveKey(kty, crv)).record.privateKey,
              "base64",
            );
      const imported = await importCurveKey({
        id: `${kty}-${crv}`,
        privateKey,
        kty,
        crv,
      });
      const signature = await signWithCurveKey(imported.record, payload);

      await expect(
        verifyWithPublicJwk(imported.publicJwk, payload, signature),
      ).resolves.toBe(true);
      expect(normalizePublicForLedger(imported.publicJwk)).toMatchObject({
        kty,
        crv,
        x: expect.any(BigInt),
        y: expect.any(BigInt),
      });
    },
  );

  it("detects ledger-incompatible public keys", () => {
    const oversized = {
      kty: "EC",
      crv: "P-256",
      x: Buffer.alloc(64, 0xff).toString("base64url"),
      y: Buffer.alloc(64, 0xff).toString("base64url"),
    } as const;

    expect(isPublicJwkLedgerCompatible(oversized)).toBe(false);
    expect(() => normalizePublicForLedger(oversized)).toThrow(
      "Public key is not representable in Midnight Compact fields",
    );
  });

  it("rejects unsupported curves and malformed Jubjub inputs", async () => {
    await expect(generateCurveKey("OKP", "P-256" as never)).rejects.toThrow(
      UnsupportedCurveError,
    );
    await expect(
      importCurveKey({
        id: "bad",
        privateKey: new Uint8Array(32),
        kty: "OKP",
        crv: "P-256" as never,
      }),
    ).rejects.toThrow(UnsupportedCurveError);
    await expect(
      verifyWithPublicJwk(
        { kty: "EC", crv: "Jubjub", x: "AA" },
        payload,
        new Uint8Array(96),
      ),
    ).rejects.toThrow("EC/Jubjub missing y coordinate");
    await expect(
      verifyWithPublicJwk(
        { kty: "EC", crv: "Jubjub", x: "AA", y: "AA" },
        payload,
        new Uint8Array(10),
      ),
    ).rejects.toThrow("Jubjub signature must be exactly 96 bytes");
  });
});
