import { z } from "zod/v4-mini";

/** DID URL schema */
export const DIDURLSchema = z
  .string()
  .check(
    z.startsWith("did:"),
    z.minLength(5),
    z.refine((val) => val.split(":").length >= 3, "Invalid DID URL format"),
  )
  .brand("DIDURL");
export type DIDURL = z.infer<typeof DIDURLSchema>;

export const KeyIDSchema = z
  .string()
  .check(
    z.regex(/^[a-zA-Z0-9.\-_:%]+$/), // conservative URI fragment charset
    z.minLength(1),
  )
  .brand("KeyID");

export type KeyID = z.infer<typeof KeyIDSchema>;

/** DID Key ID (e.g. did:example:123#key-1) */
export const DIDKeyIDSchema = DIDURLSchema.check(
  z.refine((val) => {
    const [_, fragment] = val.split("#");
    return KeyIDSchema.safeParse(fragment).success;
  }, "Invalid DID Key ID format: invalid or missing fragment"),
).brand("DIDKeyID");

export type DIDKeyID = z.infer<typeof DIDKeyIDSchema>;

/** DID schema (no path/query/fragment) */
export const DIDStringSchema = z
  .string()
  .check(
    z.startsWith("did:"),
    z.minLength(5),
    z.refine((val) => val.split(":").length >= 3 && !/[/?#]/.test(val), {
      error: "Invalid DID format",
    }),
  )
  .brand("DID");
export type DIDString = z.infer<typeof DIDStringSchema>;

/** Verification Method Types */
export enum VerificationMethodType {
  Undefined = "Undefined",
  JsonWebKey = "JsonWebKey",
}
export const VerificationMethodTypeSchema = z.enum(VerificationMethodType);

export enum KeyType {
  EC = "EC",
  RSA = "RSA",
  oct = "oct",
  OKP = "OKP",
}
export const KeyTypeSchema = z.enum(KeyType);

export enum CurveType {
  Ed25519 = "Ed25519",
  Jubjub = "Jubjub",
}
export const CurveTypeSchema = z.enum(CurveType);

// Base64url-encoded string (no padding). Conservative charset check only.
const Base64UrlStringSchema = z.string().check(z.regex(/^[A-Za-z0-9_-]*$/));

export const PublicKeyJwkSchema = z
  .looseObject({
    kty: KeyTypeSchema,
    crv: CurveTypeSchema,
    x: Base64UrlStringSchema,
    y: z.optional(z.any()),
  })
  .check(
    z.refine(
      (value) => value.kty !== KeyType.OKP || value.crv === CurveType.Ed25519,
      "OKP keys must use the Ed25519 curve",
    ),
  )
  .check(
    z.refine(
      (value) => value.kty !== KeyType.OKP || value.y === undefined,
      "OKP keys must not include a y coordinate",
    ),
  )
  .check(
    z.refine((value) => {
      if (value.kty === KeyType.OKP) return true;
      return (
        typeof value.y === "string" &&
        Base64UrlStringSchema.safeParse(value.y).success
      );
    }, "Non-OKP keys must include a y coordinate"),
  );

export type PublicKeyJwk = z.infer<typeof PublicKeyJwkSchema>;

/** Verification Method */
export const VerificationMethodSchema = z.object({
  id: DIDKeyIDSchema,
  type: VerificationMethodTypeSchema,
  controller: DIDStringSchema,
  publicKeyJwk: PublicKeyJwkSchema,
});

export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

/** Verification Method Relation */
export enum VerificationMethodRelationType {
  Undefined = "Undefined",
  Authentication = "Authentication",
  AssertionMethod = "AssertionMethod",
  KeyAgreement = "KeyAgreement",
  CapabilityInvocation = "CapabilityInvocation",
  CapabilityDelegation = "CapabilityDelegation",
}

export const VerificationMethodRelationTypeSchema = z.enum(
  VerificationMethodRelationType,
);

export type VerificationMethodRelation = z.infer<
  typeof VerificationMethodRelationTypeSchema
>;

/** Service Endpoint */
const isUri = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const URIStringSchema = z
  .string()
  .check(z.refine(isUri, "Invalid URI (must conform to RFC3986)"));

export const ServiceEndpointSchema = z.union([
  URIStringSchema,
  z.array(URIStringSchema),
]);
export type ServiceEndpoint = z.infer<typeof ServiceEndpointSchema>;

const hasUriScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

const isRelativeReference = (value: string) => {
  if (typeof value !== "string") return false;
  if (value.length === 0) return false;
  if (value.trim() !== value) return false;
  if (hasUriScheme.test(value)) return false;
  if (value.startsWith("//")) return false;
  try {
    new URL(value, "https://example.org");
    return true;
  } catch {
    return false;
  }
};

export const RelativeURLSchema = z
  .string()
  .check(
    z.refine(
      isRelativeReference,
      "Relative URL must be relative to the DID subject",
    ),
  )
  .brand("RelativeURL");
export type RelativeURL = z.infer<typeof RelativeURLSchema>;

export const ServiceIdSchema = z.union([DIDURLSchema, RelativeURLSchema]);
export type ServiceId = z.infer<typeof ServiceIdSchema>;

/** Service */
export const ServiceSchema = z.object({
  id: ServiceIdSchema,
  type: z.union([z.string(), z.array(z.string())]),
  serviceEndpoint: ServiceEndpointSchema,
});
export type Service = z.infer<typeof ServiceSchema>;

/** DID Document */
export const DIDDocumentSchema = z.looseObject({
  "@context": z.union([z.string(), z.array(z.string())]),
  id: DIDStringSchema,
  alsoKnownAs: z.nullish(z.array(DIDStringSchema)),
  controller: z.nullish(z.union([DIDStringSchema, z.array(DIDStringSchema)])),
  verificationMethod: z.nullish(z.array(VerificationMethodSchema)),
  authentication: z.nullish(z.array(DIDKeyIDSchema)),
  assertionMethod: z.nullish(z.array(DIDKeyIDSchema)),
  keyAgreement: z.nullish(z.array(DIDKeyIDSchema)),
  capabilityInvocation: z.nullish(z.array(DIDKeyIDSchema)),
  capabilityDelegation: z.nullish(z.array(DIDKeyIDSchema)),
  service: z.nullish(z.array(ServiceSchema)),
});

function validateDIDDocumentConsistency(doc: DIDDocument): DIDDocument {
  type ValidationIssue = { message: string; path: (string | number)[] };
  const issues: ValidationIssue[] = [];
  const verificationMethods = doc.verificationMethod ?? [];
  const seenVerificationMethodIds = new Map<string, number>();

  verificationMethods.forEach((vm, index) => {
    if (seenVerificationMethodIds.has(vm.id)) {
      issues.push({
        message: "verificationMethod ids must be unique",
        path: ["verificationMethod", index, "id"],
      });
    } else {
      seenVerificationMethodIds.set(vm.id, index);
    }
  });

  const ensureRelationConsistency = (
    relationName:
      | "authentication"
      | "assertionMethod"
      | "keyAgreement"
      | "capabilityInvocation"
      | "capabilityDelegation",
  ) => {
    const relationValues = doc[relationName];
    if (relationValues == null) return;
    const seen = new Set<string>();
    relationValues.forEach((value, index) => {
      if (seen.has(value)) {
        issues.push({
          message: `${relationName} must not contain duplicate entries`,
          path: [relationName, index],
        });
        return;
      }
      seen.add(value);
      if (!seenVerificationMethodIds.has(value)) {
        issues.push({
          message: `${relationName} references a verificationMethod id that does not exist`,
          path: [relationName, index],
        });
      }
    });
  };

  ensureRelationConsistency("authentication");
  ensureRelationConsistency("assertionMethod");
  ensureRelationConsistency("keyAgreement");
  ensureRelationConsistency("capabilityInvocation");
  ensureRelationConsistency("capabilityDelegation");

  const services = doc.service ?? [];
  const seenServiceIds = new Set<string>();
  services.forEach((service, index) => {
    if (seenServiceIds.has(service.id)) {
      issues.push({
        message: "service ids must be unique",
        path: ["service", index, "id"],
      });
    } else {
      seenServiceIds.add(service.id);
    }

    const endpoints = Array.isArray(service.serviceEndpoint)
      ? service.serviceEndpoint
      : [service.serviceEndpoint];
    const seenEndpoints = new Set<string>();
    endpoints.forEach((endpoint, endpointIndex) => {
      if (seenEndpoints.has(endpoint)) {
        issues.push({
          message: "serviceEndpoint values must be unique",
          path: ["service", index, "serviceEndpoint", endpointIndex],
        });
      } else {
        seenEndpoints.add(endpoint);
      }
    });
  });

  if (issues.length > 0) {
    const message = issues
      .map((issue) =>
        issue.path && issue.path.length > 0
          ? `${issue.message} at ${issue.path.join(".")}`
          : issue.message,
      )
      .join("; ");
    const error = new Error(message) as Error & {
      issues?: ValidationIssue[];
    };
    error.issues = issues;
    throw error;
  }
  return doc;
}
export type DIDDocument = z.infer<typeof DIDDocumentSchema>;

/** DID Document Metadata */
export const DIDDocumentMetadataSchema = z.looseObject({
  created: z.nullish(z.string()),
  updated: z.nullish(z.string()),
  deactivated: z.nullish(z.boolean()),
  versionId: z.nullish(z.string()),
  nextUpdate: z.nullish(z.string()),
  nextVersionId: z.nullish(z.string()),
  equivalentId: z.nullish(z.array(z.string())),
  canonicalId: z.nullish(z.string()),
});
export type DIDDocumentMetadata = z.infer<typeof DIDDocumentMetadataSchema>;

export const KnownDIDMediaTypesSchema = z.enum([
  "application/did+ld+json",
  "application/did+json",
  "application/ld+json",
  "application/json",
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
    error: z.nullish(z.string()),
  }),
});
export type DIDResolutionResult = z.infer<typeof DIDResolutionResultSchema>;

/** Parsing Helpers */
export const parseDIDDocument = (input: unknown) =>
  validateDIDDocumentConsistency(DIDDocumentSchema.parse(input));
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
  const doc = DIDDocumentSchema.parse({
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
    service: params.service ?? null,
  });
  return validateDIDDocumentConsistency(doc);
}
