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

import { pureCircuits } from "./managed/did/contract/index.js";

export const deriveControllerPublicKey = (
  secretKey: Uint8Array
): JubjubPoint => {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
    throw new Error("DID controller secret key must be 32 bytes");
  }

  return deriveJubjubPublicKeyFromSeed(secretKey);
};

export type ControllerAuthorizationContractId = { readonly bytes: Uint8Array };

export const controllerAuthorizationDigest = (
  contractId: ControllerAuthorizationContractId,
  expectedVersion: bigint
): JubjubDigest =>
  pureCircuits.controllerAuthorizationDigest(
    contractId,
    expectedVersion
  ) as JubjubDigest;

export const signControllerAuthorization = (
  secretKey: Uint8Array,
  contractId: ControllerAuthorizationContractId,
  expectedVersion: bigint
): JubjubSchnorrSignature =>
  signJubjubDigestFromSeed(
    secretKey,
    controllerAuthorizationDigest(contractId, expectedVersion)
  );
