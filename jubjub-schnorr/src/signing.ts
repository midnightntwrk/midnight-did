// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import { createHash, randomBytes } from "node:crypto";

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

const bigintTo32Be = (value: bigint): Buffer => {
  const hex = value.toString(16).padStart(64, "0");
  return Buffer.from(hex, "hex");
};

const bufferToBigint = (value: Uint8Array): bigint => {
  const buffer = Buffer.from(value);
  return buffer.length === 0 ? 0n : BigInt(`0x${buffer.toString("hex")}`);
};

const ensure32Bytes = (value: Uint8Array): Buffer => {
  const buffer = Buffer.from(value);
  if (buffer.length === 32) return buffer;
  if (buffer.length > 32) return buffer.subarray(0, 32);
  return Buffer.concat([buffer, Buffer.alloc(32 - buffer.length)]);
};

const serializeDigest = (digest: JubjubDigest): Buffer =>
  Buffer.concat(digest.map((part) => bigintTo32Be(part)));

const hashToScalar = (input: Uint8Array): bigint =>
  bufferToBigint(createHash("sha256").update(input).digest()) % JUBJUB_ORDER;

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
  const digest = createHash("sha256").update(payload).digest();
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
  Buffer.concat([
    bigintTo32Be(signature.announcement.x),
    bigintTo32Be(signature.announcement.y),
    bigintTo32Be(signature.response),
  ]);

export const decodeJubjubSignature = (
  signature: Uint8Array,
): JubjubSchnorrSignature => {
  if (signature.length !== 96) {
    throw new Error("Jubjub signature must be exactly 96 bytes");
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
  const sk = normalizeScalar(secretScalar);
  const publicKey = deriveJubjubPublicKey(sk);
  const seedMaterial =
    nonceSeed ??
    Buffer.concat([bigintTo32Be(sk), randomBytes(32), serializeDigest(digest)]);
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
    Buffer.concat([
      Buffer.from("midnight-did:jubjub-schnorr:v1"),
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
