import { z } from "zod/v4-mini";
import { CurveType, type DIDDocumentMetadata, KeyType, type Service, type VerificationMethod, VerificationMethodType } from "./did-document.js";
import { type MidnightDIDString, type OffchainStateHashHex } from "./midnight.js";
export declare const OFFCHAIN_STATE_ENCODING: "midnight-offchain-did-state-v1.base64url";
export declare const OffchainStateHashSchema: z.core.$ZodBranded<z.ZodMiniString<string>, "OffchainStateHash", "out">;
export type OffchainStateHash = OffchainStateHashHex;
export declare const OffchainVerificationRelationshipsSchema: z.ZodMiniObject<{
    authentication: z.ZodMiniBoolean<boolean>;
    assertionMethod: z.ZodMiniBoolean<boolean>;
    keyAgreement: z.ZodMiniBoolean<boolean>;
    capabilityInvocation: z.ZodMiniBoolean<boolean>;
    capabilityDelegation: z.ZodMiniBoolean<boolean>;
}, z.core.$strip>;
export type OffchainVerificationRelationships = z.infer<typeof OffchainVerificationRelationshipsSchema>;
export declare const OffchainVerificationMethodSchema: z.ZodMiniObject<{
    id: z.ZodMiniString<string>;
    publicKeyJwk: z.ZodMiniObject<{
        kty: z.ZodMiniEnum<typeof KeyType>;
        crv: z.ZodMiniEnum<typeof CurveType>;
        x: z.ZodMiniString<string>;
        y: z.ZodMiniOptional<z.ZodMiniString<string>>;
    }, z.core.$loose>;
    relationships: z.ZodMiniObject<{
        authentication: z.ZodMiniBoolean<boolean>;
        assertionMethod: z.ZodMiniBoolean<boolean>;
        keyAgreement: z.ZodMiniBoolean<boolean>;
        capabilityInvocation: z.ZodMiniBoolean<boolean>;
        capabilityDelegation: z.ZodMiniBoolean<boolean>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type OffchainVerificationMethod = z.infer<typeof OffchainVerificationMethodSchema>;
export declare const OffchainServiceSchema: z.ZodMiniObject<{
    id: z.ZodMiniString<string>;
    type: z.ZodMiniString<string>;
    serviceEndpoint: z.ZodMiniString<string>;
}, z.core.$strip>;
export type OffchainService = z.infer<typeof OffchainServiceSchema>;
export declare const OffchainMidnightDIDStateSchema: z.ZodMiniObject<{
    version: z.ZodMiniNumber<number>;
    alsoKnownAs: z.ZodMiniArray<z.ZodMiniString<string>>;
    verificationMethod: z.ZodMiniArray<z.ZodMiniObject<{
        id: z.ZodMiniString<string>;
        publicKeyJwk: z.ZodMiniObject<{
            kty: z.ZodMiniEnum<typeof KeyType>;
            crv: z.ZodMiniEnum<typeof CurveType>;
            x: z.ZodMiniString<string>;
            y: z.ZodMiniOptional<z.ZodMiniString<string>>;
        }, z.core.$loose>;
        relationships: z.ZodMiniObject<{
            authentication: z.ZodMiniBoolean<boolean>;
            assertionMethod: z.ZodMiniBoolean<boolean>;
            keyAgreement: z.ZodMiniBoolean<boolean>;
            capabilityInvocation: z.ZodMiniBoolean<boolean>;
            capabilityDelegation: z.ZodMiniBoolean<boolean>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    service: z.ZodMiniArray<z.ZodMiniObject<{
        id: z.ZodMiniString<string>;
        type: z.ZodMiniString<string>;
        serviceEndpoint: z.ZodMiniString<string>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type OffchainMidnightDIDState = z.infer<typeof OffchainMidnightDIDStateSchema>;
export type EncodedOffchainMidnightDIDState = {
    readonly encoding: typeof OFFCHAIN_STATE_ENCODING;
    readonly payload: string;
};
export type ParsedLongFormOffchainMidnightDID = {
    readonly did: MidnightDIDString;
    readonly stateHash: OffchainStateHash;
    readonly encodedState: EncodedOffchainMidnightDIDState;
};
export declare const parseOffchainStateHash: (input: string) => OffchainStateHash;
export declare const encodeOffchainMidnightDIDState: (state: OffchainMidnightDIDState) => EncodedOffchainMidnightDIDState;
export declare const decodeOffchainMidnightDIDState: (encoded: EncodedOffchainMidnightDIDState) => OffchainMidnightDIDState;
export declare const createOffchainMidnightDIDString: (stateHash: OffchainStateHash) => MidnightDIDString;
export declare const createOffchainMidnightDIDStringFromState: (state: OffchainMidnightDIDState) => MidnightDIDString;
export declare const createLongFormOffchainMidnightDIDString: (state: OffchainMidnightDIDState) => MidnightDIDString;
export declare const parseLongFormOffchainMidnightDIDString: (input: string) => ParsedLongFormOffchainMidnightDID;
export declare const offchainVerificationMethodToDidDocumentMethod: (did: MidnightDIDString, method: OffchainVerificationMethod) => VerificationMethod;
export declare const offchainServiceToDidDocumentService: (service: OffchainService) => Service;
export declare const offchainStateToDidDocument: (did: MidnightDIDString, state: OffchainMidnightDIDState) => {
    "@context": string[];
    id: string & z.core.$brand<"MidnightDID">;
    alsoKnownAs: string[] | null;
    controller: string & z.core.$brand<"MidnightDID">;
    verificationMethod: {
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
    }[];
    authentication: string[] | null;
    assertionMethod: string[] | null;
    keyAgreement: string[] | null;
    capabilityInvocation: string[] | null;
    capabilityDelegation: string[] | null;
    service: {
        id: (string & z.core.$brand<"DIDURL">) | (string & z.core.$brand<"RelativeURL">);
        type: string | string[];
        serviceEndpoint: string | Record<string, unknown> | (string | Record<string, unknown>)[];
    }[] | null;
};
export declare const createOffchainMidnightDidDocumentMetadata: (state: OffchainMidnightDIDState) => DIDDocumentMetadata;
//# sourceMappingURL=offchain-midnight.d.ts.map