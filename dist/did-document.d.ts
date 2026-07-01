import { z } from "zod/v4-mini";
/** DID URL schema */
export declare const DIDURLSchema: z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">;
export type DIDURL = z.infer<typeof DIDURLSchema>;
export declare const KeyIDSchema: z.core.$ZodBranded<z.ZodMiniString<string>, "KeyID", "out">;
export type KeyID = z.infer<typeof KeyIDSchema>;
export declare const RelativeURLSchema: z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">;
export type RelativeURL = z.infer<typeof RelativeURLSchema>;
/** DID Key ID (e.g. did:example:123#key-1 or #key-1) */
export declare const DIDKeyIDSchema: z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">;
export type DIDKeyID = z.infer<typeof DIDKeyIDSchema>;
/** DID schema (no path/query/fragment) */
export declare const DIDStringSchema: z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">;
export type DIDString = z.infer<typeof DIDStringSchema>;
/** Verification Method Types */
export declare enum VerificationMethodType {
    Undefined = "Undefined",
    JsonWebKey = "JsonWebKey"
}
export declare const VerificationMethodTypeSchema: z.ZodMiniEnum<typeof VerificationMethodType>;
export declare enum KeyType {
    EC = "EC",
    RSA = "RSA",
    oct = "oct",
    OKP = "OKP"
}
export declare const KeyTypeSchema: z.ZodMiniEnum<typeof KeyType>;
export declare enum CurveType {
    Ed25519 = "Ed25519",
    X25519 = "X25519",
    Jubjub = "Jubjub",
    P256 = "P-256",
    Secp256k1 = "secp256k1"
}
export declare const CurveTypeSchema: z.ZodMiniEnum<typeof CurveType>;
export declare const PublicKeyJwkSchema: z.ZodMiniObject<{
    kty: z.ZodMiniEnum<typeof KeyType>;
    crv: z.ZodMiniEnum<typeof CurveType>;
    x: z.ZodMiniString<string>;
    y: z.ZodMiniOptional<z.ZodMiniString<string>>;
}, z.core.$loose>;
export type PublicKeyJwk = z.infer<typeof PublicKeyJwkSchema>;
/** Verification Method */
export declare const VerificationMethodSchema: z.ZodMiniObject<{
    id: z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">;
    type: z.ZodMiniEnum<typeof VerificationMethodType>;
    controller: z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">;
    publicKeyJwk: z.ZodMiniObject<{
        kty: z.ZodMiniEnum<typeof KeyType>;
        crv: z.ZodMiniEnum<typeof CurveType>;
        x: z.ZodMiniString<string>;
        y: z.ZodMiniOptional<z.ZodMiniString<string>>;
    }, z.core.$loose>;
}, z.core.$strip>;
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;
/** Verification Method Relation */
export declare enum VerificationMethodRelationType {
    Undefined = "Undefined",
    Authentication = "Authentication",
    AssertionMethod = "AssertionMethod",
    KeyAgreement = "KeyAgreement",
    CapabilityInvocation = "CapabilityInvocation",
    CapabilityDelegation = "CapabilityDelegation"
}
export declare const VerificationMethodRelationTypeSchema: z.ZodMiniEnum<typeof VerificationMethodRelationType>;
export type VerificationMethodRelation = z.infer<typeof VerificationMethodRelationTypeSchema>;
export declare const URIStringSchema: z.ZodMiniString<string>;
export type URIString = z.infer<typeof URIStringSchema>;
export declare const ServiceEndpointObjectSchema: z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>;
export type ServiceEndpointObject = z.infer<typeof ServiceEndpointObjectSchema>;
export declare const ServiceEndpointArrayEntrySchema: z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>]>;
export type ServiceEndpointArrayEntry = z.infer<typeof ServiceEndpointArrayEntrySchema>;
export declare const ServiceEndpointSchema: z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>, z.ZodMiniArray<z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>]>>]>;
export type ServiceEndpoint = z.infer<typeof URIStringSchema> | ServiceEndpointObject | Array<ServiceEndpointArrayEntry>;
export declare function normalizeServiceEndpoint(endpoint: ServiceEndpoint): ServiceEndpoint;
export declare const ServiceIdSchema: z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>;
export type ServiceId = z.infer<typeof ServiceIdSchema>;
/** Service */
export declare const ServiceSchema: z.ZodMiniObject<{
    id: z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>;
    type: z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniArray<z.ZodMiniString<string>>]>;
    serviceEndpoint: z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>, z.ZodMiniArray<z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>]>>]>;
}, z.core.$strip>;
export type Service = z.infer<typeof ServiceSchema>;
/** DID Document (W3C DID Core 1.0 compliant - generic) */
export declare const DIDDocumentSchema: z.ZodMiniObject<{
    "@context": z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniArray<z.ZodMiniString<string>>]>;
    id: z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">;
    alsoKnownAs: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.ZodMiniString<string>>>>;
    controller: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">, z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">>]>>>;
    verificationMethod: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.ZodMiniObject<{
        id: z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">;
        type: z.ZodMiniEnum<typeof VerificationMethodType>;
        controller: z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">;
        publicKeyJwk: z.ZodMiniObject<{
            kty: z.ZodMiniEnum<typeof KeyType>;
            crv: z.ZodMiniEnum<typeof CurveType>;
            x: z.ZodMiniString<string>;
            y: z.ZodMiniOptional<z.ZodMiniString<string>>;
        }, z.core.$loose>;
    }, z.core.$strip>>>>;
    authentication: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
    assertionMethod: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
    keyAgreement: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
    capabilityInvocation: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
    capabilityDelegation: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
    service: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.ZodMiniObject<{
        id: z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>;
        type: z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniArray<z.ZodMiniString<string>>]>;
        serviceEndpoint: z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>, z.ZodMiniArray<z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>]>>]>;
    }, z.core.$strip>>>>;
}, z.core.$loose>;
export type DIDDocument = z.infer<typeof DIDDocumentSchema>;
export declare const DIDDocumentMetadataSchema: z.ZodMiniObject<{
    created: z.ZodMiniOptional<z.ZodMiniNullable<z.iso.ZodMiniISODateTime>>;
    updated: z.ZodMiniOptional<z.ZodMiniNullable<z.iso.ZodMiniISODateTime>>;
    deactivated: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniBoolean<boolean>>>;
    versionId: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
    nextUpdate: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
    nextVersionId: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
    equivalentId: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.ZodMiniString<string>>>>;
    canonicalId: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
}, z.core.$loose>;
export type DIDDocumentMetadata = z.infer<typeof DIDDocumentMetadataSchema>;
export declare const DIDDocumentRepresentationMediaTypesSchema: z.ZodMiniEnum<{
    "application/did+ld+json": "application/did+ld+json";
    "application/did+json": "application/did+json";
}>;
/** DID Document representation media types allowed in DID resolution metadata. */
export type DIDDocumentRepresentationMediaTypes = z.infer<typeof DIDDocumentRepresentationMediaTypesSchema>;
export declare const DIDResolutionEnvelopeMediaTypesSchema: z.ZodMiniEnum<{
    "application/ld+json": "application/ld+json";
    "application/json": "application/json";
}>;
/** Media types for envelopes that carry DID Resolution Result objects. */
export type DIDResolutionEnvelopeMediaTypes = z.infer<typeof DIDResolutionEnvelopeMediaTypesSchema>;
export declare const KnownDIDMediaTypesSchema: z.ZodMiniEnum<{
    "application/did+ld+json": "application/did+ld+json";
    "application/did+json": "application/did+json";
    "application/ld+json": "application/ld+json";
    "application/json": "application/json";
}>;
/** Known DID Document representation and resolution envelope media types. */
export type KnownDIDMediaTypes = z.infer<typeof KnownDIDMediaTypesSchema>;
export declare const KnownDIDResolutionErrorCodeSchema: z.ZodMiniEnum<{
    invalidDid: "invalidDid";
    internalError: "internalError";
    invalidPublicKey: "invalidPublicKey";
    invalidPublicKeyLength: "invalidPublicKeyLength";
    invalidPublicKeyType: "invalidPublicKeyType";
    methodNotSupported: "methodNotSupported";
    notAllowedCertificate: "notAllowedCertificate";
    notAllowedGlobalDuplicateKey: "notAllowedGlobalDuplicateKey";
    notAllowedKeyType: "notAllowedKeyType";
    notAllowedLocalDerivedKey: "notAllowedLocalDerivedKey";
    notAllowedLocalDuplicateKey: "notAllowedLocalDuplicateKey";
    notAllowedMethod: "notAllowedMethod";
    notAllowedVerificationMethodType: "notAllowedVerificationMethodType";
    notFound: "notFound";
    representationNotSupported: "representationNotSupported";
    unsupportedPublicKeyType: "unsupportedPublicKeyType";
}>;
/**
 * Known registered DID resolution metadata error codes.
 *
 * This enum is exported for callers that want registry-only validation. The
 * resolution result schema below uses the generic keyword schema instead so
 * resolver-specific extension keywords remain valid.
 *
 * Source: https://www.w3.org/TR/2024/NOTE-did-spec-registries-20240701/#error
 */
export type KnownDIDResolutionErrorCode = z.infer<typeof KnownDIDResolutionErrorCodeSchema>;
export declare const DIDResolutionErrorCodeSchema: z.ZodMiniString<string>;
/**
 * DID resolution error keyword, including registered extension values.
 *
 * The resolution result schema intentionally validates this generic keyword
 * shape instead of the known enum so resolver-specific extension keywords remain
 * valid.
 */
export type DIDResolutionErrorCode = z.infer<typeof DIDResolutionErrorCodeSchema>;
/** DID Resolution Result */
export declare const DIDResolutionResultSchema: z.ZodMiniObject<{
    "@context": z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniArray<z.ZodMiniString<string>>]>>>;
    didDocument: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniObject<{
        "@context": z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniArray<z.ZodMiniString<string>>]>;
        id: z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">;
        alsoKnownAs: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.ZodMiniString<string>>>>;
        controller: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">, z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">>]>>>;
        verificationMethod: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.ZodMiniObject<{
            id: z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">;
            type: z.ZodMiniEnum<typeof VerificationMethodType>;
            controller: z.core.$ZodBranded<z.ZodMiniString<string>, "DID", "out">;
            publicKeyJwk: z.ZodMiniObject<{
                kty: z.ZodMiniEnum<typeof KeyType>;
                crv: z.ZodMiniEnum<typeof CurveType>;
                x: z.ZodMiniString<string>;
                y: z.ZodMiniOptional<z.ZodMiniString<string>>;
            }, z.core.$loose>;
        }, z.core.$strip>>>>;
        authentication: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
        assertionMethod: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
        keyAgreement: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
        capabilityInvocation: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
        capabilityDelegation: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.core.$ZodBranded<z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>, "DIDKeyID", "out">>>>;
        service: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.ZodMiniObject<{
            id: z.ZodMiniUnion<readonly [z.core.$ZodBranded<z.ZodMiniString<string>, "DIDURL", "out">, z.core.$ZodBranded<z.ZodMiniString<string>, "RelativeURL", "out">]>;
            type: z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniArray<z.ZodMiniString<string>>]>;
            serviceEndpoint: z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>, z.ZodMiniArray<z.ZodMiniUnion<readonly [z.ZodMiniString<string>, z.ZodMiniRecord<z.ZodMiniString<string>, z.ZodMiniUnknown>]>>]>;
        }, z.core.$strip>>>>;
    }, z.core.$loose>>>;
    didDocumentMetadata: z.ZodMiniObject<{
        created: z.ZodMiniOptional<z.ZodMiniNullable<z.iso.ZodMiniISODateTime>>;
        updated: z.ZodMiniOptional<z.ZodMiniNullable<z.iso.ZodMiniISODateTime>>;
        deactivated: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniBoolean<boolean>>>;
        versionId: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
        nextUpdate: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
        nextVersionId: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
        equivalentId: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniArray<z.ZodMiniString<string>>>>;
        canonicalId: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
    }, z.core.$loose>;
    didResolutionMetadata: z.ZodMiniObject<{
        contentType: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniEnum<{
            "application/did+ld+json": "application/did+ld+json";
            "application/did+json": "application/did+json";
        }>>>;
        error: z.ZodMiniOptional<z.ZodMiniNullable<z.ZodMiniString<string>>>;
    }, z.core.$loose>;
}, z.core.$loose>;
export type DIDResolutionResult = z.infer<typeof DIDResolutionResultSchema>;
/** Parsing Helpers */
export declare const parseDIDDocument: (input: unknown) => {
    [x: string]: unknown;
    "@context": string | string[];
    id: string & z.core.$brand<"DID">;
    alsoKnownAs?: string[] | null | undefined;
    controller?: (string & z.core.$brand<"DID">) | (string & z.core.$brand<"DID">)[] | null | undefined;
    verificationMethod?: {
        id: ((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">);
        type: VerificationMethodType;
        controller: string & z.core.$brand<"DID">;
        publicKeyJwk: {
            [x: string]: unknown;
            kty: KeyType;
            crv: CurveType;
            x: string;
            y?: string | undefined;
        };
    }[] | null | undefined;
    authentication?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
    assertionMethod?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
    keyAgreement?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
    capabilityInvocation?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
    capabilityDelegation?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
    service?: {
        id: (string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">);
        type: string | string[];
        serviceEndpoint: string | Record<string, unknown> | (string | Record<string, unknown>)[];
    }[] | null | undefined;
};
export declare const parseDIDURL: (input: unknown) => string & z.core.$brand<"DIDURL">;
export declare const parseDIDKeyID: (input: unknown) => ((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">);
export declare const parseDID: (input: unknown) => string & z.core.$brand<"DID">;
export declare const parseVerificationMethod: (input: unknown) => {
    id: ((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">);
    type: VerificationMethodType;
    controller: string & z.core.$brand<"DID">;
    publicKeyJwk: {
        [x: string]: unknown;
        kty: KeyType;
        crv: CurveType;
        x: string;
        y?: string | undefined;
    };
};
export declare const parseService: (input: unknown) => {
    serviceEndpoint: ServiceEndpoint;
    id: (string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">);
    type: string | string[];
};
export declare const parseDIDResolutionResult: (input: unknown) => {
    [x: string]: unknown;
    didDocumentMetadata: {
        [x: string]: unknown;
        created?: string | null | undefined;
        updated?: string | null | undefined;
        deactivated?: boolean | null | undefined;
        versionId?: string | null | undefined;
        nextUpdate?: string | null | undefined;
        nextVersionId?: string | null | undefined;
        equivalentId?: string[] | null | undefined;
        canonicalId?: string | null | undefined;
    };
    didResolutionMetadata: {
        [x: string]: unknown;
        contentType?: "application/did+ld+json" | "application/did+json" | null | undefined;
        error?: string | null | undefined;
    };
    "@context"?: string | string[] | null | undefined;
    didDocument?: {
        [x: string]: unknown;
        "@context": string | string[];
        id: string & z.core.$brand<"DID">;
        alsoKnownAs?: string[] | null | undefined;
        controller?: (string & z.core.$brand<"DID">) | (string & z.core.$brand<"DID">)[] | null | undefined;
        verificationMethod?: {
            id: ((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">);
            type: VerificationMethodType;
            controller: string & z.core.$brand<"DID">;
            publicKeyJwk: {
                [x: string]: unknown;
                kty: KeyType;
                crv: CurveType;
                x: string;
                y?: string | undefined;
            };
        }[] | null | undefined;
        authentication?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
        assertionMethod?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
        keyAgreement?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
        capabilityInvocation?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
        capabilityDelegation?: (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & (((string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">)) & z.core.$brand<"DIDKeyID">))[] | null | undefined;
        service?: {
            id: (string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">);
            type: string | string[];
            serviceEndpoint: string | Record<string, unknown> | (string | Record<string, unknown>)[];
        }[] | null | undefined;
    } | null | undefined;
};
export declare const parseVerificationMethodType: (input: unknown) => VerificationMethodType;
export declare const parseVerificationMethodRelation: (input: unknown) => VerificationMethodRelationType;
/** Creation Helpers */
export declare function createVerificationMethod(params: {
    id: string;
    type: VerificationMethodType;
    controller: string;
    publicKeyJwk: PublicKeyJwk;
}): VerificationMethod;
export declare function createService(params: {
    id: string;
    type: string | string[];
    serviceEndpoint: ServiceEndpoint;
}): Service;
export declare function createDIDDocument(params: {
    id: string;
    context?: string | string[];
    alsoKnownAs?: URIString[];
    controller?: string | string[];
    verificationMethod?: VerificationMethod[];
    authentication?: string[];
    assertionMethod?: string[];
    keyAgreement?: string[];
    capabilityInvocation?: string[];
    capabilityDelegation?: string[];
    service?: Service[];
}): DIDDocument;
//# sourceMappingURL=did-document.d.ts.map