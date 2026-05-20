// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  computeJubjubDigestChallenge,
  decodeJubjubSignature,
  deriveJubjubPublicKey,
  deriveJubjubPublicKeyFromSeed,
  encodeJubjubSignature,
  JUBJUB_SIGNATURE_LENGTH_BYTES,
  payloadToJubjubDigest,
  signJubjubDigest,
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

  it("rejects tampered signatures", () => {
    const publicKey = deriveJubjubPublicKeyFromSeed(seed);
    const signature = signJubjubPayloadFromSeed(seed, payload);

    expect(
      verifyJubjubPayload(publicKey, payload, {
        ...signature,
        response: signature.response + 1n,
      }),
    ).toBe(false);
  });

  it("rejects the wrong public key", () => {
    const publicKey = deriveJubjubPublicKeyFromSeed(seed);
    const wrongPublicKey = deriveJubjubPublicKeyFromSeed(
      new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 11)),
    );
    const signature = signJubjubPayloadFromSeed(seed, payload);

    expect(verifyJubjubPayload(publicKey, payload, signature)).toBe(true);
    expect(verifyJubjubPayload(wrongPublicKey, payload, signature)).toBe(false);
  });

  it("preserves the 96-byte wire encoding", () => {
    const signature = signJubjubPayloadFromSeed(seed, payload);
    const encoded = encodeJubjubSignature(signature);

    expect(encoded).toHaveLength(96);
    expect(decodeJubjubSignature(encoded)).toEqual(signature);
  });

  it("rejects invalid signature lengths", () => {
    expect(() => decodeJubjubSignature(new Uint8Array(10))).toThrow(
      `Jubjub signature must be exactly ${JUBJUB_SIGNATURE_LENGTH_BYTES} bytes`,
    );
  });

  it("supports the direct signJubjubDigest path", () => {
    const secretScalar = 123456789n;
    const digest = payloadToJubjubDigest(payload);
    const publicKey = deriveJubjubPublicKey(secretScalar);
    const signature = signJubjubDigest(
      secretScalar,
      digest,
      new Uint8Array(32).fill(9),
    );

    expect(verifyJubjubPayload(publicKey, payload, signature)).toBe(true);
  });

  it("uses the Compact pure circuit as the challenge source of truth deterministically", () => {
    const publicKey = deriveJubjubPublicKeyFromSeed(seed);
    const signature = signJubjubPayloadFromSeed(seed, payload);
    const digest = payloadToJubjubDigest(payload);
    const challenge1 = computeJubjubDigestChallenge(
      signature.announcement,
      publicKey,
      digest,
    );
    const challenge2 = computeJubjubDigestChallenge(
      signature.announcement,
      publicKey,
      digest,
    );

    expect(challenge1).toEqual(challenge2);
  });
});
