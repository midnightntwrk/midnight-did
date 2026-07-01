import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { normalizeBoundFragmentId } from "./did-subject.js";
import { LedgerVerificationMethodRelationMap, schnorrJubjubVerificationMethodToLedger, verificationMethodToLedger, } from "./ledger-mappers.js";
import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
import { assertVerificationMethodRelationAbsent, assertVerificationMethodRelationPresent, purgeVerificationMethodFromAllRelations, } from "./verification-method-relations.js";
export const addVerificationMethod = async (didContract, verificationMethod) => {
    const result = await didContract.callTx.setVerificationMethod(verificationMethodToLedger(didContract, verificationMethod), DIDContract.MapMutation.Insert);
    return result.public;
};
export const updateVerificationMethod = async (didContract, verificationMethod) => {
    const result = await didContract.callTx.setVerificationMethod(verificationMethodToLedger(didContract, verificationMethod), DIDContract.MapMutation.Update);
    return result.public;
};
export const removeVerificationMethod = async (didContract, providers, methodId) => {
    const normalizedMethodId = normalizeBoundFragmentId(didContract, methodId, "methodId");
    await purgeVerificationMethodFromAllRelations(didContract, providers, normalizedMethodId);
    const result = await didContract.callTx.removeVerificationMethod(normalizedMethodId);
    return result.public;
};
export const addSchnorrJubjubVerificationMethod = async (didContract, verificationMethod) => {
    const result = await didContract.callTx.setSchnorrJubjubVerificationMethod(schnorrJubjubVerificationMethodToLedger(didContract, verificationMethod), DIDContract.MapMutation.Insert);
    return result.public;
};
export const updateSchnorrJubjubVerificationMethod = async (didContract, verificationMethod) => {
    const result = await didContract.callTx.setSchnorrJubjubVerificationMethod(schnorrJubjubVerificationMethodToLedger(didContract, verificationMethod), DIDContract.MapMutation.Update);
    return result.public;
};
export const removeSchnorrJubjubVerificationMethod = async (didContract, providers, methodId) => {
    const normalizedMethodId = normalizeBoundFragmentId(didContract, methodId, "methodId");
    await purgeVerificationMethodFromAllRelations(didContract, providers, normalizedMethodId);
    const result = await didContract.callTx.removeSchnorrJubjubVerificationMethod(normalizedMethodId);
    return result.public;
};
/**
 * Submits the ledger-bound SchnorrJubjub verification circuit.
 *
 * This is a transaction-backed proof rather than an off-chain verifier so the
 * proof is tied to the current DID ledger state while the digest and signature
 * remain private circuit inputs.
 */
export const verifySchnorrJubjubDigestSignature = async (didContract, methodId, digest, signature) => {
    const normalizedMethodId = normalizeBoundFragmentId(didContract, methodId, "methodId");
    const result = await didContract.callTx.verifySchnorrJubjubDigestSignature(normalizedMethodId, digest, signature);
    return result.public;
};
export const addVerificationMethodRelation = async (didContract, providers, relation, methodId) => {
    const normalizedMethodId = normalizeBoundFragmentId(didContract, methodId, "methodId");
    const didState = await requireDeployedMidnightDIDLedgerState(providers, didContract);
    assertVerificationMethodRelationAbsent(didState, relation, normalizedMethodId);
    const result = await didContract.callTx.setVerificationMethodRelation(LedgerVerificationMethodRelationMap[relation], normalizedMethodId, DIDContract.SetMutation.Insert);
    return result.public;
};
export const removeVerificationMethodRelation = async (didContract, providers, relation, methodId) => {
    const normalizedMethodId = normalizeBoundFragmentId(didContract, methodId, "methodId");
    const didState = await requireDeployedMidnightDIDLedgerState(providers, didContract);
    assertVerificationMethodRelationPresent(didState, relation, normalizedMethodId);
    const result = await didContract.callTx.setVerificationMethodRelation(LedgerVerificationMethodRelationMap[relation], normalizedMethodId, DIDContract.SetMutation.Remove);
    return result.public;
};
//# sourceMappingURL=verification-method-operations.js.map