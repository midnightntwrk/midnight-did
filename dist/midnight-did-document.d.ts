import { CurveType, DIDKeyID, KeyType, Service, URIString, VerificationMethod, VerificationMethodType } from "@midnight-ntwrk/midnight-did-domain";
import { z } from "zod/v4-mini";
import { type MidnightDIDString } from "./midnight.js";
/** Midnight DID Document Schema with method-specific constraints */
export declare const MidnightDIDDocumentSchema: z.ZodMiniObject<{
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
/**
 * Midnight DID Document type
 *
 * Extends the generic DIDDocument with Midnight-specific constraints
 */
export type MidnightDIDDocument = {
    "@context": [string, string, ...string[]];
    id: MidnightDIDString;
    alsoKnownAs?: URIString[] | null;
    controller?: MidnightDIDString | MidnightDIDString[] | null;
    verificationMethod?: VerificationMethod[] | null;
    authentication?: DIDKeyID[] | null;
    assertionMethod?: DIDKeyID[] | null;
    keyAgreement?: DIDKeyID[] | null;
    capabilityInvocation?: DIDKeyID[] | null;
    capabilityDelegation?: DIDKeyID[] | null;
    service?: Service[] | null;
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
export declare function createMidnightDIDDocument(params: {
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
}): MidnightDIDDocument;
/**
 * Parse and validate a Midnight DID Document
 *
 * @param input - The input to parse
 * @returns A validated Midnight DID Document
 * @throws {Error} If the input doesn't meet Midnight DID requirements
 */
export declare const parseMidnightDIDDocument: (input: unknown) => MidnightDIDDocument;
//# sourceMappingURL=midnight-did-document.d.ts.map