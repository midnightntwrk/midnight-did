import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";
import { type DeployedMidnightDIDContract, type MidnightDIDProviders } from "./types.js";
export declare const VerificationMethodRelations: readonly [VerificationMethodRelationType.Authentication, VerificationMethodRelationType.AssertionMethod, VerificationMethodRelationType.KeyAgreement, VerificationMethodRelationType.CapabilityInvocation, VerificationMethodRelationType.CapabilityDelegation];
export type VerificationMethodRelationMembership = {
    readonly relation: VerificationMethodRelationType;
    readonly member: boolean;
};
export declare const verificationMethodRelationMemberships: (didState: DIDContract.Ledger, normalizedMethodId: string) => readonly VerificationMethodRelationMembership[];
export declare const assertVerificationMethodRelationAbsent: (didState: DIDContract.Ledger, relation: VerificationMethodRelationType, normalizedMethodId: string) => void;
export declare const assertVerificationMethodRelationPresent: (didState: DIDContract.Ledger, relation: VerificationMethodRelationType, normalizedMethodId: string) => void;
export declare const removePresentVerificationMethodRelations: (didContract: DeployedMidnightDIDContract, memberships: readonly VerificationMethodRelationMembership[], normalizedMethodId: string) => Promise<void>;
export declare const purgeVerificationMethodFromAllRelations: (didContract: DeployedMidnightDIDContract, providers: MidnightDIDProviders, normalizedMethodId: string) => Promise<void>;
