// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";
import {
  deriveJubjubPublicKeyFromSeed,
  type JubjubDigest,
  type JubjubSchnorrSignature,
  signJubjubDigestFromSeed
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";

export const deriveControllerPublicKey = (
  secretKey: Uint8Array
): JubjubPoint => {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
    throw new Error("DID controller secret key must be 32 bytes");
  }

  return deriveJubjubPublicKeyFromSeed(secretKey);
};

export const signControllerAuthorization = (
  secretKey: Uint8Array,
  digest: JubjubDigest
): JubjubSchnorrSignature => signJubjubDigestFromSeed(secretKey, digest);
