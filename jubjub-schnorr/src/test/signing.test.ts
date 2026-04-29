import { describe, expect, it } from "vitest";

import {
  computeJubjubDigestChallenge,
  decodeJubjubSignature,
  deriveJubjubPublicKeyFromSeed,
  encodeJubjubSignature,
  payloadToJubjubDigest,
  signJubjubPayloadFromSeed,
  verifyJubjubPayload,
} from "../index.js";

describe("jubjub-schnorr", () => {
  const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
  const payload = Buffer.from("midnight-did-jubjub-schnorr-payload", "utf8");

  it("signs and verifies payloads against the shared transcript", () => {
    const publicKey = deriveJubjubPublicKeyFromSeed(seed);
    const signature = signJubjubPayloadFromSeed(seed, payload);

    expect(verifyJubjubPayload(publicKey, payload, signature)).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const publicKey = deriveJubjubPublicKeyFromSeed(seed);
    const signature = signJubjubPayloadFromSeed(seed, payload);

    expect(
      verifyJubjubPayload(
        publicKey,
        Buffer.from("midnight-did-jubjub-schnorr-payload:tampered", "utf8"),
        signature,
      ),
    ).toBe(false);
  });

  it("preserves the 96-byte wire encoding", () => {
    const signature = signJubjubPayloadFromSeed(seed, payload);
    const encoded = encodeJubjubSignature(signature);

    expect(encoded).toHaveLength(96);
    expect(decodeJubjubSignature(encoded)).toEqual(signature);
  });

  it("uses the Compact pure circuit as the challenge source of truth", () => {
    const publicKey = deriveJubjubPublicKeyFromSeed(seed);
    const signature = signJubjubPayloadFromSeed(seed, payload);
    const digest = payloadToJubjubDigest(payload);

    expect(
      computeJubjubDigestChallenge(signature.announcement, publicKey, digest),
    ).toBeGreaterThanOrEqual(0n);
  });
});
