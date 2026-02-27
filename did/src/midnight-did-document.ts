import {
  CurveType,
  DIDDocument,
  DIDDocumentSchema,
  KeyType,
  Service,
  VerificationMethod,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { z } from "zod/v4-mini";

import { MidnightDIDSchema } from "./midnight";

/**
 * Midnight DID Document
 *
 * This is a specialized version of DIDDocument that enforces
 * the constraints specified in the Midnight DID Method Specification.
 *
 * Key differences from generic W3C DID Core:
 * - @context MUST be an array with at least 2 specific URIs
 * - id MUST be a valid Midnight DID (did:midnight:<network>:<address>)
 * - controller MUST equal the DID subject (single-controller model)
 * - verificationMethod type MUST be JsonWebKey only
 * - Only Ed25519 (OKP) and JubJub (EC) key types are supported
 * - Embedded verification methods are NOT supported (referenced only)
 */

const REQUIRED_CONTEXTS = [
  "https://www.w3.org/ns/did/v1",
  "https://w3c.github.io/vc-jws-2020/contexts/v1",
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
    }, "Midnight DID only supports OKP (Ed25519) or EC (JubJub) key types"),
    z.refine((vm) => {
      const { kty, crv } = vm.publicKeyJwk;
      if (kty === KeyType.OKP) {
        return crv === CurveType.Ed25519;
      }
      if (kty === KeyType.EC) {
        return crv === CurveType.Jubjub;
      }
      return false;
    }, "OKP keys must use Ed25519 curve; EC keys must use Jubjub curve"),
    z.refine((vm) => {
      // Verification methods must be referenced (contain # or be relative)
      const id = vm.id;
      return id.includes("#") || id.startsWith("/") || id.startsWith(".");
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
    "id must be a valid Midnight DID (did:midnight:<network>:<address>)",
  ),
  z.refine((doc) => {
    // Controller must equal subject (single-controller model)
    if (!doc.controller) return true; // Optional, but if present must match
    if (typeof doc.controller === "string") {
      return doc.controller === doc.id;
    }
    // If array, must have exactly one entry equal to id
    return (
      Array.isArray(doc.controller) &&
      doc.controller.length === 1 &&
      doc.controller[0] === doc.id
    );
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
export type MidnightDIDDocument = DIDDocument & {
  "@context": [string, string, ...string[]]; // At least 2 entries required
  id: string; // Must be a valid MidnightDIDString
  controller?: string | null; // Must equal id if present
};

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
  id: string;
  additionalContexts?: string[];
  alsoKnownAs?: string[];
  verificationMethod?: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  service?: Service[];
}): MidnightDIDDocument {
  const doc = {
    "@context": [
      REQUIRED_CONTEXTS[0],
      REQUIRED_CONTEXTS[1],
      ...(params.additionalContexts ?? []),
    ],
    id: params.id,
    alsoKnownAs: params.alsoKnownAs ?? null,
    controller: params.id, // Always equals subject for Midnight DID
    verificationMethod: params.verificationMethod ?? null,
    authentication: params.authentication ?? null,
    assertionMethod: params.assertionMethod ?? null,
    keyAgreement: params.keyAgreement ?? null,
    capabilityInvocation: params.capabilityInvocation ?? null,
    capabilityDelegation: params.capabilityDelegation ?? null,
    service: params.service ?? null,
  };

  return MidnightDIDDocumentSchema.parse(doc) as MidnightDIDDocument;
}

/**
 * Parse and validate a Midnight DID Document
 *
 * @param input - The input to parse
 * @returns A validated Midnight DID Document
 * @throws {Error} If the input doesn't meet Midnight DID requirements
 */
export const parseMidnightDIDDocument = (input: unknown): MidnightDIDDocument =>
  MidnightDIDDocumentSchema.parse(input) as MidnightDIDDocument;
