import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";
import { LedgerVerificationMethodRelationMap, relationSetFromState, } from "./ledger-mappers.js";
import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
export const VerificationMethodRelations = Object.freeze([
    VerificationMethodRelationType.Authentication,
    VerificationMethodRelationType.AssertionMethod,
    VerificationMethodRelationType.KeyAgreement,
    VerificationMethodRelationType.CapabilityInvocation,
    VerificationMethodRelationType.CapabilityDelegation,
]);
export const verificationMethodRelationMemberships = (didState, normalizedMethodId) => VerificationMethodRelations.map((relation) => ({
    relation,
    member: relationSetFromState(didState, relation).member(normalizedMethodId),
}));
export const assertVerificationMethodRelationAbsent = (didState, relation, normalizedMethodId) => {
    const relationSet = relationSetFromState(didState, relation);
    if (relationSet.member(normalizedMethodId)) {
        throw new Error(`relation ${relation} already contains verification method ${normalizedMethodId}`);
    }
};
export const assertVerificationMethodRelationPresent = (didState, relation, normalizedMethodId) => {
    const relationSet = relationSetFromState(didState, relation);
    if (!relationSet.member(normalizedMethodId)) {
        throw new Error(`relation ${relation} does not contain verification method ${normalizedMethodId}`);
    }
};
export const removePresentVerificationMethodRelations = async (didContract, memberships, normalizedMethodId) => {
    for (const { relation, member } of memberships) {
        if (!member)
            continue;
        await didContract.callTx.setVerificationMethodRelation(LedgerVerificationMethodRelationMap[relation], normalizedMethodId, DIDContract.SetMutation.Remove);
    }
};
export const purgeVerificationMethodFromAllRelations = async (didContract, providers, normalizedMethodId) => {
    const didState = await requireDeployedMidnightDIDLedgerState(providers, didContract);
    const memberships = verificationMethodRelationMemberships(didState, normalizedMethodId);
    await removePresentVerificationMethodRelations(didContract, memberships, normalizedMethodId);
};
//# sourceMappingURL=verification-method-relations.js.map