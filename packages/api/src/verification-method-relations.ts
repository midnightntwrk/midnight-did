import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";

import {
  LedgerVerificationMethodRelationMap,
  relationSetFromState,
} from "./ledger-mappers.js";
import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

export const VerificationMethodRelations = Object.freeze([
  VerificationMethodRelationType.Authentication,
  VerificationMethodRelationType.AssertionMethod,
  VerificationMethodRelationType.KeyAgreement,
  VerificationMethodRelationType.CapabilityInvocation,
  VerificationMethodRelationType.CapabilityDelegation,
] as const satisfies readonly VerificationMethodRelationType[]);

export type VerificationMethodRelationMembership = {
  readonly relation: VerificationMethodRelationType;
  readonly member: boolean;
};

export const verificationMethodRelationMemberships = (
  didState: DIDContract.Ledger,
  normalizedMethodId: string,
): readonly VerificationMethodRelationMembership[] =>
  VerificationMethodRelations.map((relation) => ({
    relation,
    member: relationSetFromState(didState, relation).member(normalizedMethodId),
  }));

export const assertVerificationMethodRelationAbsent = (
  didState: DIDContract.Ledger,
  relation: VerificationMethodRelationType,
  normalizedMethodId: string,
): void => {
  const relationSet = relationSetFromState(didState, relation);
  if (relationSet.member(normalizedMethodId)) {
    throw new Error(
      `relation ${relation} already contains verification method ${normalizedMethodId}`,
    );
  }
};

export const assertVerificationMethodRelationPresent = (
  didState: DIDContract.Ledger,
  relation: VerificationMethodRelationType,
  normalizedMethodId: string,
): void => {
  const relationSet = relationSetFromState(didState, relation);
  if (!relationSet.member(normalizedMethodId)) {
    throw new Error(
      `relation ${relation} does not contain verification method ${normalizedMethodId}`,
    );
  }
};

export const removePresentVerificationMethodRelations = async (
  didContract: DeployedMidnightDIDContract,
  memberships: readonly VerificationMethodRelationMembership[],
  normalizedMethodId: string,
): Promise<void> => {
  for (const { relation, member } of memberships) {
    if (!member) continue;
    await didContract.callTx.setVerificationMethodRelation(
      LedgerVerificationMethodRelationMap[relation],
      normalizedMethodId,
      DIDContract.SetMutation.Remove,
    );
  }
};

export const purgeVerificationMethodFromAllRelations = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  normalizedMethodId: string,
): Promise<void> => {
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const memberships = verificationMethodRelationMemberships(
    didState,
    normalizedMethodId,
  );

  await removePresentVerificationMethodRelations(
    didContract,
    memberships,
    normalizedMethodId,
  );
};
