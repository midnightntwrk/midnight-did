import { createHash } from "node:crypto";

import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";

import type { DIDProfile, PartyRole,Signer } from "../../agents/types.js";

const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

const padText = (value: string, length = 32): Uint8Array => {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length >= length) return bytes.subarray(0, length);
  const padded = new Uint8Array(length);
  padded.set(bytes);
  return padded;
};

const JUBJUB_FIELD_MODULUS =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

const mod = (value: bigint): bigint => {
  const reduced = value % JUBJUB_FIELD_MODULUS;
  return reduced >= 0n ? reduced : reduced + JUBJUB_FIELD_MODULUS;
};

const contractAddress = (label: string): { bytes: Uint8Array } => ({
  bytes: sha256(`contract:${label}`),
});

const createSigner = (
  label: string,
  secretKey: bigint,
  methodId = `#${label}-key-1`,
): Signer => ({
  label,
  secretKey,
  publicKey: ecMulGenerator(secretKey),
  verificationMethodRef: {
    didContractAddress: contractAddress(label),
    methodId: padText(methodId),
  },
});

const createDIDProfile = (
  role: PartyRole,
  label: string,
  secretKey: bigint,
): DIDProfile => ({
  role,
  label,
  signer: createSigner(label, secretKey),
});

const fill = (value: number, length = 32): Uint8Array =>
  new Uint8Array(length).fill(value);

export { createDIDProfile, createSigner, fill, JUBJUB_FIELD_MODULUS,mod, padText, sha256 };
