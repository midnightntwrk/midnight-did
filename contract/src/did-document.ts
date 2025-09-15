import { Buffer } from "buffer";
import { z } from "zod/v4-mini";

/** DID URL schema */
export const DIDURLSchema = z
  .string()
  .check(
    z.startsWith("did:"),
    z.minLength(5),
    z.refine((val) => val.split(":").length >= 3, "Invalid DID URL format")
  )
  .brand("DIDURL");
export type DIDURL = z.infer<typeof DIDURLSchema>;

export const KeyIDSchema = z
  .string()
  .check(
    z.regex(/^[a-zA-Z0-9.\-_:%]+$/), // conservative URI fragment charset
    z.minLength(1)
  )
  .brand("KeyID");

export type KeyID = z.infer<typeof KeyIDSchema>;

/** DID Key ID (e.g. did:example:123#key-1) */
export const DIDKeyIDSchema = DIDURLSchema.check(
  z.refine((val) => {
    const [_, fragment] = val.split("#");
    return KeyIDSchema.safeParse(fragment).success;
  }, "Invalid DID Key ID format: invalid or missing fragment")
).brand("DIDKeyID");

export type DIDKeyID = z.infer<typeof DIDKeyIDSchema>;

/** DID schema (no path/query/fragment) */
export const DIDStringSchema = z
  .string()
  .check(
    z.startsWith("did:"),
    z.minLength(5),
    z.refine((val) => val.split(":").length >= 3 && !/[/?#]/.test(val), {
      error: "Invalid DID format"
    })
  )
  .brand("DID");
export type DIDString = z.infer<typeof DIDStringSchema>;

/** Verification Method Types */
export enum VerificationMethodType {
  Undefined = "Undefined",
  JsonWebKey = "JsonWebKey"
}
export const VerificationMethodTypeSchema = z.enum(VerificationMethodType);

export enum KeyType {
  EC = "EC",
  RSA = "RSA",
  oct = "oct",
  OKP = "OKP"
}
export const KeyTypeSchema = z.enum(KeyType);

export enum CurveType {
  ed25519 = "ed25519",
  Jubjub = "Jubjub"
}
export const CurveTypeSchema = z.enum(CurveType);

export const PublicKeyJwkSchema = z.object({
  kty: KeyTypeSchema,
  crv: CurveTypeSchema,
  x: z.bigint(),
  y: z.bigint()
});

export type PublicKeyJwk = z.infer<typeof PublicKeyJwkSchema>;

/** Verification Method */
export const VerificationMethodSchema = z.object({
  id: DIDKeyIDSchema,
  type: VerificationMethodTypeSchema,
  controller: DIDStringSchema,
  publicKeyJwk: PublicKeyJwkSchema
});

export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

/** Verification Method Relation */
export enum VerificationMethodRelationType {
  Undefined = "Undefined",
  Authentication = "Authentication",
  AssertionMethod = "AssertionMethod",
  KeyAgreement = "KeyAgreement",
  CapabilityInvocation = "CapabilityInvocation",
  CapabilityDelegation = "CapabilityDelegation"
}

export const VerificationMethodRelationTypeSchema = z.enum(
  VerificationMethodRelationType
);

export type VerificationMethodRelation = z.infer<
  typeof VerificationMethodRelationTypeSchema
>;

/** Service Endpoint */
export const ServiceEndpointSchema = z.union([z.string(), z.array(z.string())]);
export type ServiceEndpoint = z.infer<typeof ServiceEndpointSchema>;

/** Service ID (not enforcing .url()) */
export const URISchema = z.string();

/** Service */
export const ServiceSchema = z.object({
  id: URISchema,
  type: z.union([z.string(), z.array(z.string())]),
  serviceEndpoint: ServiceEndpointSchema
});
export type Service = z.infer<typeof ServiceSchema>;

/** DID Document */
export const DIDDocumentSchema = z.looseObject({
  "@context": z.union([z.string(), z.array(z.string())]),
  id: DIDStringSchema,
  alsoKnownAs: z.nullish(z.array(DIDStringSchema)),
  controller: z.nullish(z.union([DIDStringSchema, z.array(DIDStringSchema)])),
  verificationMethod: z.nullish(z.array(VerificationMethodSchema)),
  authentication: z.nullish(z.array(z.string())),
  assertionMethod: z.nullish(z.array(z.string())),
  keyAgreement: z.nullish(z.array(z.string())),
  capabilityInvocation: z.nullish(z.array(z.string())),
  capabilityDelegation: z.nullish(z.array(z.string())),
  service: z.nullish(z.array(ServiceSchema))
});
export type DIDDocument = z.infer<typeof DIDDocumentSchema>;

/** DID Document Metadata */
export const DIDDocumentMetadataSchema = z.looseObject({
  created: z.nullish(z.string()),
  updated: z.nullish(z.string()),
  deactivated: z.nullish(z.boolean()),
  nextUpdate: z.nullish(z.string()),
  nextVersionId: z.nullish(z.string()),
  equivalentId: z.nullish(z.array(z.string())),
  canonicalId: z.nullish(z.string())
});
export type DIDDocumentMetadata = z.infer<typeof DIDDocumentMetadataSchema>;

export const KnownDIDMediaTypesSchema = z.enum([
  "application/did+ld+json",
  "application/did+json",
  "application/ld+json",
  "application/json"
]);

/** Known DID Media Types */
export type KnownDIDMediaTypes = z.infer<typeof KnownDIDMediaTypesSchema>;

/** DID Resolution Result */
export const DIDResolutionResultSchema = z.looseObject({
  "@context": z.nullish(z.union([z.string(), z.array(z.string())])),
  didDocument: z.nullish(DIDDocumentSchema),
  didDocumentMetadata: DIDDocumentMetadataSchema,
  didResolutionMetadata: z.object({
    contentType: z.nullish(KnownDIDMediaTypesSchema),
    error: z.nullish(z.string())
  })
});
export type DIDResolutionResult = z.infer<typeof DIDResolutionResultSchema>;

/** Parsing Helpers */
export const parseDIDDocument = (input: unknown) =>
  DIDDocumentSchema.parse(input);
export const parseDIDURL = (input: unknown) => DIDURLSchema.parse(input);
export const parseDIDKeyID = (input: unknown) => DIDKeyIDSchema.parse(input);
export const parseDID = (input: unknown) => DIDStringSchema.parse(input);
export const parseVerificationMethod = (input: unknown) =>
  VerificationMethodSchema.parse(input);
export const parseService = (input: unknown) => ServiceSchema.parse(input);
export const parseDIDResolutionResult = (input: unknown) =>
  DIDResolutionResultSchema.parse(input);
export const parseVerificationMethodType = (input: unknown) =>
  VerificationMethodTypeSchema.parse(input);
export const parseVerificationMethodRelation = (input: unknown) =>
  VerificationMethodRelationTypeSchema.parse(input);

/** Creation Helpers */
export function createVerificationMethod(params: {
  id: string;
  type: VerificationMethodType;
  controller: string;
  publicKeyJwk: PublicKeyJwk;
}): VerificationMethod {
  return VerificationMethodSchema.parse(params);
}

export function createService(params: {
  id: string;
  type: string | string[];
  serviceEndpoint: ServiceEndpoint;
}): Service {
  return ServiceSchema.parse(params);
}

export function createDIDDocument(params: {
  id: string;
  context?: string | string[];
  alsoKnownAs?: string[];
  controller?: string | string[];
  verificationMethod?: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  service?: Service[];
}): DIDDocument {
  return DIDDocumentSchema.parse({
    "@context": params.context ?? "https://www.w3.org/ns/did/v1",
    id: params.id,
    alsoKnownAs: params.alsoKnownAs ?? null,
    controller: params.controller ?? null,
    verificationMethod: params.verificationMethod ?? null,
    authentication: params.authentication ?? null,
    assertionMethod: params.assertionMethod ?? null,
    keyAgreement: params.keyAgreement ?? null,
    capabilityInvocation: params.capabilityInvocation ?? null,
    capabilityDelegation: params.capabilityDelegation ?? null,
    service: params.service ?? null
  });
}
