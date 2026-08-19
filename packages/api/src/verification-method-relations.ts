import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  assertVerificationMethodRelationCompatibleWithCurve,
  CurveType,
  VerificationMethodRelationType,
} from "@midnight-ntwrk/midnight-did-domain";

import { relationSetFromState } from "./ledger-mappers.js";
import {
  type ReferencedVerificationMethodRelation,
  VerificationMethodReferencedError,
} from "./verification-method-errors.js";

export const VerificationMethodRelations = Object.freeze([
  VerificationMethodRelationType.Authentication,
  VerificationMethodRelationType.AssertionMethod,
  VerificationMethodRelationType.KeyAgreement,
  VerificationMethodRelationType.CapabilityInvocation,
  VerificationMethodRelationType.CapabilityDelegation,
] as const satisfies readonly ReferencedVerificationMethodRelation[]);

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
  readonly relation: ReferencedVerificationMethodRelation;
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

export const assertVerificationMethodIsNotReferenced = (
  didState: DIDContract.Ledger,
  normalizedMethodId: string,
): void => {
  const referencedRelations = verificationMethodRelationMemberships(
    didState,
    normalizedMethodId,
  )
    .filter(({ member }) => member)
    .map(({ relation }) => relation);

  if (referencedRelations.length > 0) {
    throw new VerificationMethodReferencedError(
      normalizedMethodId,
      referencedRelations,
    );
  }
};

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
