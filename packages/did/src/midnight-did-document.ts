import {
  CurveType,
  DIDDocument,
  DIDDocumentSchema,
  DIDKeyID,
  KeyType,
  resolveDIDURLReference,
  Service,
  URIString,
  validateDIDDocumentConsistency,
  VerificationMethod,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { z } from "zod/v4-mini";

import {
  MidnightDIDSchema,
  type MidnightDIDString,
  parseMidnightDIDString,
} from "./midnight.js";

/**
 * Midnight DID Document
 *
 * This is a specialized version of DIDDocument that enforces
 * the constraints specified in the Midnight DID Method Specification.
 *
 * Key differences from generic W3C DID Core:
 * - @context MUST be an array with at least 2 specific URIs
 * - id MUST be a valid Midnight DID (did:midnight:<network>:<identifier>)
 * - controller MUST equal the DID subject (single-controller model)
 * - verificationMethod type MUST be JsonWebKey only
 * - Only OKP (Ed25519/X25519/BLS12381G1/BLS12381G2) and EC (Jubjub/P-256/secp256k1) key types are supported
 * - Embedded verification methods are NOT supported (referenced only)
 */

const REQUIRED_CONTEXTS = [
  "https://www.w3.org/ns/did/v1",
  "https://w3id.org/security/jwk/v1",
] as const;

/** Midnight-specific verification method validation */
const MidnightVerificationMethodSchema = z
  .looseObject({
    id: z.string(),
    type: z.string(),
    controller: z.string(),
    publicKeyJwk: z.looseObject({
      kty: z.string(),
      crv: z.string(),
      x: z.string(),
      y: z.optional(z.string()),
    }),
  })
  .check(
    z.refine(
      (vm) => vm.type === VerificationMethodType.JsonWebKey,
      "Midnight DID only supports JsonWebKey verification method type",
    ),
    z.refine((vm) => {
      const kty = vm.publicKeyJwk.kty;
      return kty === KeyType.OKP || kty === KeyType.EC;
    }, "Midnight DID only supports OKP (Ed25519/X25519/BLS12381G1/BLS12381G2) or EC (Jubjub/P-256/secp256k1) key types"),
    z.refine((vm) => {
      const { kty, crv } = vm.publicKeyJwk;
      if (kty === KeyType.OKP) {
        return (
          crv === CurveType.Ed25519 ||
          crv === CurveType.X25519 ||
          crv === CurveType.BLS12381G1 ||
          crv === CurveType.BLS12381G2
        );
      }
      if (kty === KeyType.EC) {
        return (
          crv === CurveType.Jubjub ||
          crv === CurveType.P256 ||
          crv === CurveType.Secp256k1
        );
      }
      return false;
    }, "OKP keys must use Ed25519, X25519, BLS12381G1, or BLS12381G2 curve; EC keys must use Jubjub, P-256, or secp256k1 curve"),
    z.refine((vm) => {
      // Verification methods must be referenceable by a fragment.
      const id = vm.id;
      return id.includes("#") && !id.endsWith("#");
    }, "Midnight DID does not support embedded verification methods - use referenced methods with fragments"),
  );

/** Midnight DID Document Schema with method-specific constraints */
export const MidnightDIDDocumentSchema = DIDDocumentSchema.check(
  z.refine(
    (doc) => Array.isArray(doc["@context"]),
    "@context must be an array for Midnight DID Documents",
  ),
  z.refine(
    (doc) => Array.isArray(doc["@context"]) && doc["@context"].length >= 2,
    "@context must contain at least 2 entries for Midnight DID Documents",
  ),
  z.refine(
    (doc) =>
      Array.isArray(doc["@context"]) &&
      doc["@context"][0] === REQUIRED_CONTEXTS[0],
    `First @context entry must be '${REQUIRED_CONTEXTS[0]}'`,
  ),
  z.refine(
    (doc) =>
      Array.isArray(doc["@context"]) &&
      doc["@context"][1] === REQUIRED_CONTEXTS[1],
    `Second @context entry must be '${REQUIRED_CONTEXTS[1]}'`,
  ),
  z.refine(
    (doc) => MidnightDIDSchema.safeParse(doc.id).success,
    "id must be a valid Midnight DID (did:midnight:<network>:<identifier>)",
  ),
  z.refine((doc) => {
    // Controller must equal subject (single-controller model), comparing the
    // canonical DID spellings so case-only differences are accepted.
    if (!doc.controller) return true; // Optional, but if present must match
    const parsedId = MidnightDIDSchema.safeParse(doc.id);
    if (!parsedId.success) return true;
    const canonicalId = parsedId.data;
    if (typeof doc.controller === "string") {
      const parsedController = MidnightDIDSchema.safeParse(doc.controller);
      return parsedController.success && parsedController.data === canonicalId;
    }
    // If array, it must have exactly one canonical entry equal to id.
    if (!Array.isArray(doc.controller) || doc.controller.length !== 1) {
      return false;
    }
    const parsedController = MidnightDIDSchema.safeParse(doc.controller[0]);
    return parsedController.success && parsedController.data === canonicalId;
  }, "controller must equal DID subject for Midnight DID (single-controller model)"),
  z.refine((doc) => {
    // All verification methods must be JsonWebKey and use supported key types
    if (!doc.verificationMethod) return true;
    return doc.verificationMethod.every(
      (vm) => MidnightVerificationMethodSchema.safeParse(vm).success,
    );
  }, "All verification methods must meet Midnight DID requirements (JsonWebKey type, OKP/EC keys, referenced only)"),
);

/**
 * Midnight DID Document type
 *
 * Extends the generic DIDDocument with Midnight-specific constraints
 */
const referenceSubject = (value: string): string | undefined => {
  if (!value.startsWith("did:")) return undefined;
  const boundary = value.search(/[/?#]/u);
  return boundary === -1 ? value : value.slice(0, boundary);
};

const canonicalizeMidnightReference = (
  value: string,
  did: MidnightDIDString,
): string => resolveDIDURLReference(value, did);

const canonicalizeMidnightServiceReference = (
  value: string,
  did: MidnightDIDString,
): string => {
  if (value.endsWith("#")) {
    throw new Error(`service id '${value}' must identify a service`);
  }
  let resolved: string;
  try {
    resolved = resolveDIDURLReference(value, did);
  } catch (error) {
    if (error instanceof Error && error.message.includes("current DID")) {
      throw new Error(`service id '${value}' must be subject-bound`);
    }
    throw error;
  }
  if (resolved === did) {
    throw new Error(`service id '${value}' must identify a service`);
  }
  return resolved;
};

const normalizeMidnightDocumentReferences = (
  doc: DIDDocument,
  did: MidnightDIDString,
): DIDDocument => {
  const verificationMethod = doc.verificationMethod?.map((method) => {
    let id: string;
    try {
      id = canonicalizeMidnightReference(method.id, did);
    } catch (error) {
      if (error instanceof Error && error.message.includes("current DID")) {
        throw new Error(
          `verificationMethod id '${method.id}' must be subject-bound`,
        );
      }
      throw error;
    }
    if (id.startsWith("did:") && referenceSubject(id) !== did) {
      throw new Error(
        `verificationMethod id '${method.id}' must be subject-bound`,
      );
    }
    const controller = MidnightDIDSchema.safeParse(method.controller);
    if (!controller.success || controller.data !== did) {
      throw new Error(
        `verificationMethod controller '${method.controller}' must equal DID subject`,
      );
    }
    return { ...method, id, controller: did };
  });

  const normalizeReferences = (values: string[] | undefined) =>
    values?.map((value) => canonicalizeMidnightReference(value, did));

  return {
    ...doc,
    verificationMethod,
    authentication: normalizeReferences(doc.authentication),
    assertionMethod: normalizeReferences(doc.assertionMethod),
    keyAgreement: normalizeReferences(doc.keyAgreement),
    capabilityInvocation: normalizeReferences(doc.capabilityInvocation),
    capabilityDelegation: normalizeReferences(doc.capabilityDelegation),
    service: doc.service?.map((service) => ({
      ...service,
      id: canonicalizeMidnightServiceReference(service.id, did),
    })),
  } as unknown as DIDDocument;
};

export type MidnightDIDDocument = {
  "@context": [string, string, ...string[]]; // At least 2 entries required
  id: MidnightDIDString;
  alsoKnownAs?: URIString[];
  controller?: MidnightDIDString | MidnightDIDString[]; // Must equal id if present
  verificationMethod?: VerificationMethod[];
  authentication?: DIDKeyID[];
  assertionMethod?: DIDKeyID[];
  keyAgreement?: DIDKeyID[];
  capabilityInvocation?: DIDKeyID[];
  capabilityDelegation?: DIDKeyID[];
  service?: Service[];
};

const projectMidnightDIDDocument = (
  doc: DIDDocument,
  id: MidnightDIDString,
): MidnightDIDDocument =>
  ({
    "@context": doc["@context"] as [string, string, ...string[]],
    id,
    ...(doc.alsoKnownAs === undefined || doc.alsoKnownAs.length === 0
      ? {}
      : { alsoKnownAs: doc.alsoKnownAs }),
    ...(doc.controller === undefined ? {} : { controller: doc.controller }),
    ...(doc.verificationMethod === undefined ||
    doc.verificationMethod.length === 0
      ? {}
      : { verificationMethod: doc.verificationMethod }),
    ...(doc.authentication === undefined
      ? {}
      : { authentication: doc.authentication }),
    ...(doc.assertionMethod === undefined
      ? {}
      : { assertionMethod: doc.assertionMethod }),
    ...(doc.keyAgreement === undefined
      ? {}
      : { keyAgreement: doc.keyAgreement }),
    ...(doc.capabilityInvocation === undefined
      ? {}
      : { capabilityInvocation: doc.capabilityInvocation }),
    ...(doc.capabilityDelegation === undefined
      ? {}
      : { capabilityDelegation: doc.capabilityDelegation }),
    ...(doc.service === undefined || doc.service.length === 0
      ? {}
      : { service: doc.service }),
  }) as MidnightDIDDocument;

/**
 * Create a Midnight DID Document
 *
 * This function creates a DID Document that conforms to the
 * Midnight DID Method Specification.
 *
 * @param params - Document parameters
 * @returns A validated Midnight DID Document
 * @throws {Error} If the document doesn't meet Midnight DID requirements
 *
 * @example
 * ```typescript
 * const doc = createMidnightDIDDocument({
 *   id: "did:midnight:testnet:c569622e7f33d2d020ba1cae242e6077268941327846d62d8cbf0cc923ae41f6",
 *   verificationMethod: [{
 *     id: "#key-1",
 *     type: "JsonWebKey",
 *     controller: "did:midnight:testnet:c569622e7f33d2d020ba1cae242e6077268941327846d62d8cbf0cc923ae41f6",
 *     publicKeyJwk: {
 *       kty: "OKP",
 *       crv: "Ed25519",
 *       x: "VCpo2LMLhn6iWku8MKvSLg2ZAoC-nlOyPVQaO3FxVeQ"
 *     }
 *   }],
 *   authentication: ["#key-1"]
 * });
 * ```
 */
export function createMidnightDIDDocument(params: {
  id: MidnightDIDString;
  additionalContexts?: string[];
  alsoKnownAs?: URIString[];
  verificationMethod?: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  service?: Service[];
}): MidnightDIDDocument {
  const canonicalId = parseMidnightDIDString(params.id);
  const doc = {
    "@context": [
      REQUIRED_CONTEXTS[0],
      REQUIRED_CONTEXTS[1],
      ...(params.additionalContexts ?? []),
    ],
    id: canonicalId,
    ...(params.alsoKnownAs === undefined
      ? {}
      : { alsoKnownAs: params.alsoKnownAs }),
    controller: canonicalId, // Always equals subject for Midnight DID
    ...(params.verificationMethod === undefined
      ? {}
      : { verificationMethod: params.verificationMethod }),
    ...(params.authentication === undefined
      ? {}
      : { authentication: params.authentication }),
    ...(params.assertionMethod === undefined
      ? {}
      : { assertionMethod: params.assertionMethod }),
    ...(params.keyAgreement === undefined
      ? {}
      : { keyAgreement: params.keyAgreement }),
    ...(params.capabilityInvocation === undefined
      ? {}
      : { capabilityInvocation: params.capabilityInvocation }),
    ...(params.capabilityDelegation === undefined
      ? {}
      : { capabilityDelegation: params.capabilityDelegation }),
    ...(params.service === undefined ? {} : { service: params.service }),
  };

  const parsed = validateDIDDocumentConsistency(
    normalizeMidnightDocumentReferences(
      MidnightDIDDocumentSchema.parse(doc) as DIDDocument,
      canonicalId,
    ),
    { normalizeServiceEndpoints: false },
  );
  return projectMidnightDIDDocument(parsed, canonicalId);
}

/**
 * Parse and validate a Midnight DID Document
 *
 * @param input - The input to parse
 * @returns A validated Midnight DID Document
 * @throws {Error} If the input doesn't meet Midnight DID requirements
 */
export const parseMidnightDIDDocument = (
  input: unknown,
): MidnightDIDDocument => {
  const parsed = MidnightDIDDocumentSchema.parse(input) as DIDDocument;
  const id = parseMidnightDIDString(parsed.id);
  const controller =
    parsed.controller === undefined
      ? undefined
      : Array.isArray(parsed.controller)
        ? parsed.controller.map((value) => parseMidnightDIDString(value))
        : parseMidnightDIDString(parsed.controller);
  const normalized = {
    "@context": parsed["@context"],
    id,
    ...(parsed.alsoKnownAs === undefined
      ? {}
      : { alsoKnownAs: parsed.alsoKnownAs }),
    ...(controller === undefined ? {} : { controller }),
    ...(parsed.verificationMethod === undefined
      ? {}
      : { verificationMethod: parsed.verificationMethod }),
    ...(parsed.authentication === undefined
      ? {}
      : { authentication: parsed.authentication }),
    ...(parsed.assertionMethod === undefined
      ? {}
      : { assertionMethod: parsed.assertionMethod }),
    ...(parsed.keyAgreement === undefined
      ? {}
      : { keyAgreement: parsed.keyAgreement }),
    ...(parsed.capabilityInvocation === undefined
      ? {}
      : { capabilityInvocation: parsed.capabilityInvocation }),
    ...(parsed.capabilityDelegation === undefined
      ? {}
      : { capabilityDelegation: parsed.capabilityDelegation }),
    ...(parsed.service === undefined ? {} : { service: parsed.service }),
  } as unknown as DIDDocument;
  const validated = validateDIDDocumentConsistency(
    normalizeMidnightDocumentReferences(normalized, id),
    { normalizeServiceEndpoints: false },
  );
  return projectMidnightDIDDocument(validated, id);
};
