// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
import { CompactTypeBytes, CompactTypeVector, persistentHash } from "@midnight-ntwrk/compact-runtime";
const bytes32 = new CompactTypeBytes(32);
const controllerKeyInput = new CompactTypeVector(2, bytes32);
const controllerKeyDomainLabel = "did:controller:pk";
const padAscii32 = (value) => {
    if (value.length > 32) {
        throw new Error("DID controller key domain label exceeds 32 bytes");
    }
    const padded = new Uint8Array(32);
    for (let index = 0; index < value.length; index += 1) {
        const codePoint = value.charCodeAt(index);
        if (codePoint > 0x7f) {
            throw new Error("DID controller key domain label must be ASCII");
        }
        padded[index] = codePoint;
    }
    return padded;
};
// Mirrors the Compact `pad(32, "did:controller:pk")` controller-key domain.
const controllerKeyDomain = padAscii32(controllerKeyDomainLabel);
export const deriveControllerPublicKey = (secretKey) => {
    if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
        throw new Error("DID controller secret key must be 32 bytes");
    }
    return persistentHash(controllerKeyInput, [controllerKeyDomain, secretKey]);
};
//# sourceMappingURL=controller-key.js.map