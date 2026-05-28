// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import {
  CompactTypeBytes,
  CompactTypeVector,
  persistentHash
} from "@midnight-ntwrk/compact-runtime";

const bytes32 = new CompactTypeBytes(32);
const controllerKeyInput = new CompactTypeVector(2, bytes32);
const controllerKeyDomain = new Uint8Array([
  100, 105, 100, 58, 99, 111, 110, 116, 114, 111, 108, 108, 101, 114, 58, 112,
  107, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
]);

export const deriveControllerPublicKey = (
  secretKey: Uint8Array
): Uint8Array => {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
    throw new Error("DID controller secret key must be 32 bytes");
  }

  return persistentHash(controllerKeyInput, [controllerKeyDomain, secretKey]);
};
