import { VerificationMethod, VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";
import { type DeployedMidnightDIDContract, type MidnightDIDProviders, type SchnorrJubjubDigest, type SchnorrJubjubSignature, type SchnorrJubjubVerificationMethod } from "./types.js";
export declare const addVerificationMethod: (didContract: DeployedMidnightDIDContract, verificationMethod: VerificationMethod) => Promise<FinalizedTxData>;
export declare const updateVerificationMethod: (didContract: DeployedMidnightDIDContract, verificationMethod: VerificationMethod) => Promise<FinalizedTxData>;
export declare const removeVerificationMethod: (didContract: DeployedMidnightDIDContract, providers: MidnightDIDProviders, methodId: string) => Promise<FinalizedTxData>;
export declare const addSchnorrJubjubVerificationMethod: (didContract: DeployedMidnightDIDContract, verificationMethod: SchnorrJubjubVerificationMethod) => Promise<FinalizedTxData>;
export declare const updateSchnorrJubjubVerificationMethod: (didContract: DeployedMidnightDIDContract, verificationMethod: SchnorrJubjubVerificationMethod) => Promise<FinalizedTxData>;
export declare const removeSchnorrJubjubVerificationMethod: (didContract: DeployedMidnightDIDContract, providers: MidnightDIDProviders, methodId: string) => Promise<FinalizedTxData>;
/**
 * Submits the ledger-bound SchnorrJubjub verification circuit.
 *
 * This is a transaction-backed proof rather than an off-chain verifier so the
 * proof is tied to the current DID ledger state while the digest and signature
 * remain private circuit inputs.
 */
export declare const verifySchnorrJubjubDigestSignature: (didContract: DeployedMidnightDIDContract, methodId: string, digest: SchnorrJubjubDigest, signature: SchnorrJubjubSignature) => Promise<FinalizedTxData>;
export declare const addVerificationMethodRelation: (didContract: DeployedMidnightDIDContract, providers: MidnightDIDProviders, relation: VerificationMethodRelationType, methodId: string) => Promise<FinalizedTxData>;
export declare const removeVerificationMethodRelation: (didContract: DeployedMidnightDIDContract, providers: MidnightDIDProviders, relation: VerificationMethodRelationType, methodId: string) => Promise<FinalizedTxData>;
