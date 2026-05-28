// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import {
  ecAdd,
  ecMul,
  ecMulGenerator,
  type JubjubPoint,
} from "@midnight-ntwrk/compact-runtime";

import { pureCircuits } from "./managed/jubjub-schnorr/contract/index.js";

export type JubjubDigest = [bigint, bigint, bigint, bigint];

export type JubjubSchnorrSignature = {
  announcement: JubjubPoint;
  response: bigint;
};

export const JUBJUB_ORDER =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;
export const TWO_248 =
  452312848583266388373324160190187140051835877600158453279131187530910662656n;
export const JUBJUB_SIGNATURE_LENGTH_BYTES = 96;

type NodeCrypto = Pick<
  typeof import("node:crypto"),
  "createHash" | "randomBytes"
>;

let nodeCrypto: NodeCrypto | undefined;

if (typeof process !== "undefined" && process.versions?.node) {
  const crypto = await import("node:crypto");
  nodeCrypto = {
    createHash: crypto.createHash,
    randomBytes: crypto.randomBytes,
  };
}

const getNodeCrypto = (): NodeCrypto => {
  if (!nodeCrypto) {
    throw new Error(
      "Jubjub Schnorr signing and payload hashing require Node.js node:crypto; use digest-level helpers in browser runtimes.",
    );
  }
  return nodeCrypto;
};

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const asciiBytes = (value: string): Uint8Array =>
  Uint8Array.from(value, (char) => char.charCodeAt(0));

const bytesToHex = (value: Uint8Array): string => {
  let hex = "";
  for (const byte of value) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
};

const bigintTo32Be = (value: bigint): Uint8Array => {
  const hex = value.toString(16).padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const bufferToBigint = (value: Uint8Array): bigint => {
  const hex = bytesToHex(value);
  return hex.length === 0 ? 0n : BigInt(`0x${hex}`);
};

const ensure32Bytes = (value: Uint8Array): Uint8Array => {
  if (value.length === 32) return value;
  if (value.length > 32) return value.subarray(0, 32);
  const result = new Uint8Array(32);
  result.set(value);
  return result;
};

const serializeDigest = (digest: JubjubDigest): Uint8Array =>
  concatBytes(digest.map((part) => bigintTo32Be(part)));

const sha256 = (input: Uint8Array): Uint8Array =>
  new Uint8Array(getNodeCrypto().createHash("sha256").update(input).digest());

const randomBytes32 = (): Uint8Array =>
  new Uint8Array(getNodeCrypto().randomBytes(32));

const hashToScalar = (input: Uint8Array): bigint =>
  bufferToBigint(sha256(input)) % JUBJUB_ORDER;

export const normalizeScalar = (value: bigint): bigint =>
  ((value % JUBJUB_ORDER) + JUBJUB_ORDER) % JUBJUB_ORDER;

export const seedBytesToJubjubSecretScalar = (seedBytes: Uint8Array): bigint =>
  hashToScalar(ensure32Bytes(seedBytes));

export const deriveJubjubPublicKey = (secretScalar: bigint): JubjubPoint =>
  ecMulGenerator(normalizeScalar(secretScalar));

export const deriveJubjubPublicKeyFromSeed = (
  seedBytes: Uint8Array,
): JubjubPoint =>
  deriveJubjubPublicKey(seedBytesToJubjubSecretScalar(seedBytes));

export const payloadToJubjubDigest = (payload: Uint8Array): JubjubDigest => {
  const digest = sha256(payload);
  return [
    bufferToBigint(digest.subarray(0, 8)),
    bufferToBigint(digest.subarray(8, 16)),
    bufferToBigint(digest.subarray(16, 24)),
    bufferToBigint(digest.subarray(24, 32)),
  ];
};

export const encodeJubjubSignature = (
  signature: JubjubSchnorrSignature,
): Uint8Array =>
  concatBytes([
    bigintTo32Be(signature.announcement.x),
    bigintTo32Be(signature.announcement.y),
    bigintTo32Be(signature.response),
  ]);

export const decodeJubjubSignature = (
  signature: Uint8Array,
): JubjubSchnorrSignature => {
  if (signature.length !== JUBJUB_SIGNATURE_LENGTH_BYTES) {
    throw new Error(
      `Jubjub signature must be exactly ${JUBJUB_SIGNATURE_LENGTH_BYTES} bytes`,
    );
  }
  return {
    announcement: {
      x: bufferToBigint(signature.subarray(0, 32)),
      y: bufferToBigint(signature.subarray(32, 64)),
    },
    response: bufferToBigint(signature.subarray(64, 96)),
  };
};

export const computeJubjubDigestChallenge = (
  announcement: JubjubPoint,
  publicKey: JubjubPoint,
  digest: JubjubDigest,
): bigint =>
  pureCircuits.schnorrChallengeDigest(
    announcement.x,
    announcement.y,
    publicKey.x,
    publicKey.y,
    digest,
  ) % TWO_248;

export const signJubjubDigest = (
  secretScalar: bigint,
  digest: JubjubDigest,
  nonceSeed?: Uint8Array,
): JubjubSchnorrSignature => {
  // Low-level API. If nonceSeed is omitted, this path uses fresh randomness.
  // DID-facing code should prefer the deterministic seed-based helpers.
  const sk = normalizeScalar(secretScalar);
  const publicKey = deriveJubjubPublicKey(sk);
  const seedMaterial =
    nonceSeed ??
    concatBytes([bigintTo32Be(sk), randomBytes32(), serializeDigest(digest)]);
  const nonce = hashToScalar(seedMaterial);
  const announcement = ecMulGenerator(nonce);
  const challenge = computeJubjubDigestChallenge(
    announcement,
    publicKey,
    digest,
  );
  const response = normalizeScalar(nonce + challenge * sk);
  return { announcement, response };
};

export const signJubjubDigestFromSeed = (
  seedBytes: Uint8Array,
  digest: JubjubDigest,
): JubjubSchnorrSignature => {
  const normalizedSeed = ensure32Bytes(seedBytes);
  return signJubjubDigest(
    seedBytesToJubjubSecretScalar(normalizedSeed),
    digest,
    concatBytes([
      asciiBytes("midnight-did:jubjub-schnorr:v1"),
      normalizedSeed,
      serializeDigest(digest),
    ]),
  );
};

export const signJubjubPayloadFromSeed = (
  seedBytes: Uint8Array,
  payload: Uint8Array,
): JubjubSchnorrSignature =>
  signJubjubDigestFromSeed(seedBytes, payloadToJubjubDigest(payload));

export const verifyJubjubDigest = (
  publicKey: JubjubPoint,
  digest: JubjubDigest,
  signature: JubjubSchnorrSignature,
): boolean => {
  const challenge = computeJubjubDigestChallenge(
    signature.announcement,
    publicKey,
    digest,
  );
  const lhs = ecMulGenerator(normalizeScalar(signature.response));
  const rhs = ecAdd(signature.announcement, ecMul(publicKey, challenge));
  return lhs.x === rhs.x && lhs.y === rhs.y;
};

export const verifyJubjubPayload = (
  publicKey: JubjubPoint,
  payload: Uint8Array,
  signature: JubjubSchnorrSignature,
): boolean =>
  verifyJubjubDigest(publicKey, payloadToJubjubDigest(payload), signature);
