import { z } from "zod";

import { COMPACT_VALUE_ENCODING } from "./compact-value-codec.js";
import {
  Base64UrlSchema,
  HexBytesSchema,
  NonEmptyStringSchema,
  UriSchema,
} from "./shared.js";

export const MidnightCredentialFormatSchema = z.enum([
  "midnight_compact_vc",
  "midnight_compact_vp",
]);
export type MidnightCredentialFormat = z.infer<
  typeof MidnightCredentialFormatSchema
>;

export const MidnightCompactValueEncodingSchema = z.literal(
  COMPACT_VALUE_ENCODING,
);
export type MidnightCompactValueEncoding = z.infer<
  typeof MidnightCompactValueEncodingSchema
>;

export const MidnightCompactValuePayloadSchema = z.object({
  encoding: MidnightCompactValueEncodingSchema,
  payload: Base64UrlSchema,
});
export type MidnightCompactValuePayload = z.infer<
  typeof MidnightCompactValuePayloadSchema
>;

export const MidnightKeyTypeSchema = z.enum(["jubjub", "ed25519", "p256"]);
export type MidnightKeyType = z.infer<typeof MidnightKeyTypeSchema>;

export const MidnightDidMethodRefSchema = z.object({
  did: NonEmptyStringSchema,
  methodIndex: z.number().int().positive(),
  keyType: MidnightKeyTypeSchema,
});
export type MidnightDidMethodRef = z.infer<typeof MidnightDidMethodRefSchema>;

export const MidnightHolderBindingMethodSchema = z.enum([
  "explicit_did_method",
  "secret_commitment",
  "blinded_secret_commitment",
]);
export type MidnightHolderBindingMethod = z.infer<
  typeof MidnightHolderBindingMethodSchema
>;

export const MidnightHolderBindingSchema = z.object({
  method: MidnightHolderBindingMethodSchema,
  challenge: HexBytesSchema.or(Base64UrlSchema),
  holderDidMethod: MidnightDidMethodRefSchema.optional(),
  secretCommitment: HexBytesSchema.or(Base64UrlSchema).optional(),
  blindedCommitment: HexBytesSchema.or(Base64UrlSchema).optional(),
  verifierDomain: NonEmptyStringSchema.optional(),
});
export type MidnightHolderBinding = z.infer<
  typeof MidnightHolderBindingSchema
>;

export const MidnightCompactCredentialPayloadSchema = z.object({
  format: z.literal("midnight_compact_vc"),
  credentialFamily: NonEmptyStringSchema,
  schemaId: NonEmptyStringSchema,
  schemaVersion: NonEmptyStringSchema,
  credential: MidnightCompactValuePayloadSchema,
  credentialProof: MidnightCompactValuePayloadSchema,
  holderBinding: MidnightHolderBindingSchema.optional(),
});
export type MidnightCompactCredentialPayload = z.infer<
  typeof MidnightCompactCredentialPayloadSchema
>;

export const MidnightCompactPresentationPayloadSchema = z.object({
  format: z.literal("midnight_compact_vp"),
  presentationFamily: NonEmptyStringSchema,
  schemaId: NonEmptyStringSchema,
  schemaVersion: NonEmptyStringSchema,
  presentation: MidnightCompactValuePayloadSchema,
  credentialProof: MidnightCompactValuePayloadSchema,
  presentationProof: MidnightCompactValuePayloadSchema.optional(),
  holderBinding: MidnightHolderBindingSchema.optional(),
});
export type MidnightCompactPresentationPayload = z.infer<
  typeof MidnightCompactPresentationPayloadSchema
>;

export const MidnightCredentialRequestExtensionSchema = z.object({
  holderBinding: MidnightHolderBindingSchema,
  requestedClaims: z.array(NonEmptyStringSchema).default([]),
});
export type MidnightCredentialRequestExtension = z.infer<
  typeof MidnightCredentialRequestExtensionSchema
>;

export const MidnightPresentationRequestExtensionSchema = z.object({
  verifierDomain: NonEmptyStringSchema,
  challenge: HexBytesSchema.or(Base64UrlSchema),
  acceptedCredentialFamilies: z.array(NonEmptyStringSchema).min(1),
  requireSameHolder: z.boolean().default(false),
  predicateHints: z.array(UriSchema).default([]),
});
export type MidnightPresentationRequestExtension = z.infer<
  typeof MidnightPresentationRequestExtensionSchema
>;
