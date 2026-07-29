import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  assertVerificationMethodRelationCompatibleWithCurve,
  CurveType,
  VerificationMethodRelationType,
} from "@midnight-ntwrk/midnight-did-domain";

import {
  asSchnorrJubjubDigest,
  createControllerAuthorization,
} from "./controller-authorization.js";
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

const ledgerCurveToDomainCurve = (curve: DIDContract.CurveType): CurveType => {
  switch (curve) {
    case DIDContract.CurveType.Ed25519:
      return CurveType.Ed25519;
    case DIDContract.CurveType.X25519:
      return CurveType.X25519;
    case DIDContract.CurveType.Jubjub:
      return CurveType.Jubjub;
    case DIDContract.CurveType.P256:
      return CurveType.P256;
    case DIDContract.CurveType.Secp256k1:
      return CurveType.Secp256k1;
    case DIDContract.CurveType.BLS12381G1:
      return CurveType.BLS12381G1;
    case DIDContract.CurveType.BLS12381G2:
      return CurveType.BLS12381G2;
  }
};

const verificationMethodCurveFromState = (
  didState: DIDContract.Ledger,
  normalizedMethodId: string,
): CurveType => {
  if (didState.schnorrJubjubVerificationMethods.member(normalizedMethodId)) {
    return CurveType.Jubjub;
  }
  if (didState.verificationMethods.member(normalizedMethodId)) {
    const verificationMethod =
      didState.verificationMethods.lookup(normalizedMethodId);
    return ledgerCurveToDomainCurve(verificationMethod.publicKeyJwk.crv);
  }
  throw new Error(`verification method ${normalizedMethodId} does not exist`);
};

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

export const assertVerificationMethodRelationCompatible = (
  didState: DIDContract.Ledger,
  relation: VerificationMethodRelationType,
  normalizedMethodId: string,
): void => {
  assertVerificationMethodRelationCompatibleWithCurve(
    relation,
    verificationMethodCurveFromState(didState, normalizedMethodId),
    normalizedMethodId,
  );
};

export const assertExistingVerificationMethodRelationsCompatible = (
  didState: DIDContract.Ledger,
  curve: CurveType,
  normalizedMethodId: string,
): void => {
  for (const relation of VerificationMethodRelations) {
    if (relationSetFromState(didState, relation).member(normalizedMethodId)) {
      assertVerificationMethodRelationCompatibleWithCurve(
        relation,
        curve,
        normalizedMethodId,
      );
    }
  }
};

export const removePresentVerificationMethodRelations = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  memberships: readonly VerificationMethodRelationMembership[],
  normalizedMethodId: string,
): Promise<void> => {
  for (const { relation, member } of memberships) {
    if (!member) continue;
    const ledgerRelation = LedgerVerificationMethodRelationMap[relation];
    const [signature, expectedVersion] = await createControllerAuthorization(
      didContract,
      providers,
      (ledgerState) =>
        asSchnorrJubjubDigest(
          DIDContract.pureCircuits.setVerificationMethodRelationAuthorizationDigest(
            ledgerState.id,
            ledgerState.version,
            ledgerRelation,
            normalizedMethodId,
            DIDContract.SetMutation.Remove,
          ),
        ),
    );
    await didContract.callTx.setVerificationMethodRelation(
      ledgerRelation,
      normalizedMethodId,
      DIDContract.SetMutation.Remove,
      signature,
      expectedVersion,
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
    providers,
    memberships,
    normalizedMethodId,
  );
};
