import { parseContractAddress } from "@midnight-ntwrk/midnight-did";
import { type DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";

import { getMidnightDIDLedgerState } from "./deploy.js";
import {
  LedgerVerificationMethodRelationMap,
  relationSetFromState,
} from "./ledger-mappers.js";
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
]);

export type VerificationMethodRelationMembership = {
  readonly relation: VerificationMethodRelationType;
  readonly member: boolean;
};

export const requireMidnightDIDLedgerState = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
): Promise<DIDContract.Ledger> => {
  const contractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  const didState = await getMidnightDIDLedgerState(providers, contractAddress);

  if (!didState) {
    throw new Error("Cannot query DID state");
  }

  return didState;
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

export const removeVerificationMethodFromPresentRelations = async (
  didContract: DeployedMidnightDIDContract,
  memberships: readonly VerificationMethodRelationMembership[],
  normalizedMethodId: string,
): Promise<void> => {
  for (const { relation, member } of memberships) {
    if (!member) continue;
    await didContract.callTx.removeVerificationMethodRelation(
      LedgerVerificationMethodRelationMap[relation],
      normalizedMethodId,
    );
  }
};

export const removeVerificationMethodRelationMemberships = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  normalizedMethodId: string,
): Promise<void> => {
  const didState = await requireMidnightDIDLedgerState(didContract, providers);
  const memberships = verificationMethodRelationMemberships(
    didState,
    normalizedMethodId,
  );

  await removeVerificationMethodFromPresentRelations(
    didContract,
    memberships,
    normalizedMethodId,
  );
};
