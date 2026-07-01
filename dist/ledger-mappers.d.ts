import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { Service, VerificationMethod, VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";
import { type DeployedMidnightDIDContract, type SchnorrJubjubVerificationMethod } from "./types.js";
declare const LedgerVerificationMethodRelation: typeof DIDContract.VerificationMethodRelation;
export declare const LedgerVerificationMethodRelationMap: Record<VerificationMethodRelationType, (typeof LedgerVerificationMethodRelation)[keyof typeof LedgerVerificationMethodRelation]>;
export declare const verificationMethodToLedger: (didContract: DeployedMidnightDIDContract, method: VerificationMethod) => DIDContract.VerificationMethod;
export declare const schnorrJubjubVerificationMethodToLedger: (didContract: DeployedMidnightDIDContract, method: SchnorrJubjubVerificationMethod) => DIDContract.SchnorrJubjubVerificationMethod;
export declare const serviceToLedger: (didContract: DeployedMidnightDIDContract, service: Service) => DIDContract.Service;
export declare const relationSetFromState: (didState: DIDContract.Ledger, relation: VerificationMethodRelationType) => {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: string): boolean;
    [Symbol.iterator](): Iterator<string>;
};
export {};
