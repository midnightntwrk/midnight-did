import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  VerificationMethod,
  VerificationMethodRelationType,
} from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import {
  asSchnorrJubjubDigest,
  createControllerAuthorization,
} from "./controller-authorization.js";
import { normalizeBoundFragmentId } from "./did-subject.js";
import {
  findExistingVerificationMethodLedgerIdentifier,
  ledgerIdentifier,
  requireExistingVerificationMethodLedgerId,
} from "./ledger-identifier-keys.js";
import {
  LedgerVerificationMethodRelationMap,
  schnorrJubjubVerificationMethodToLedger,
  verificationMethodToLedger,
} from "./ledger-mappers.js";
import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
  type SchnorrJubjubDigest,
  type SchnorrJubjubSignature,
  type SchnorrJubjubVerificationMethod,
} from "./types.js";
import {
  assertExistingVerificationMethodRelationsCompatible,
  assertVerificationMethodIsNotReferenced,
  assertVerificationMethodRelationAbsent,
  assertVerificationMethodRelationCompatible,
  assertVerificationMethodRelationPresent,
} from "./verification-method-relations.js";

export const addVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const ledgerVerificationMethod = verificationMethodToLedger(
    didContract,
    verificationMethod,
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  if (
    findExistingVerificationMethodLedgerIdentifier(
      didState,
      ledgerIdentifier(didContract, ledgerVerificationMethod.id),
    ) !== null
  ) {
    throw new Error(
      `verification method ${ledgerVerificationMethod.id} already exists`,
    );
  }
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.setVerificationMethodAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          ledgerVerificationMethod,
          DIDContract.MapMutation.Insert,
        ),
      ),
    didState,
  );
  const result = await didContract.callTx.setVerificationMethod(
    ledgerVerificationMethod,
    DIDContract.MapMutation.Insert,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const updateVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const canonicalVerificationMethod = verificationMethodToLedger(
    didContract,
    verificationMethod,
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const existingMethodId = requireExistingVerificationMethodLedgerId(
    didState,
    ledgerIdentifier(didContract, canonicalVerificationMethod.id),
    "opaque",
  );
  const ledgerVerificationMethod = {
    ...canonicalVerificationMethod,
    id: existingMethodId,
  };
  assertExistingVerificationMethodRelationsCompatible(
    didState,
    verificationMethod.publicKeyJwk.crv,
    existingMethodId,
  );
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.setVerificationMethodAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          ledgerVerificationMethod,
          DIDContract.MapMutation.Update,
        ),
      ),
    didState,
  );
  const result = await didContract.callTx.setVerificationMethod(
    ledgerVerificationMethod,
    DIDContract.MapMutation.Update,
    signature,
    expectedVersion,
  );
  return result.public;
};

/**
 * Removes one unreferenced opaque JWK verification method.
 *
 * This helper never removes verification relationships implicitly.
 * @throws {VerificationMethodReferencedError} when any relationship still
 * references the selected physical ledger id.
 */
export const removeVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  methodId: string,
): Promise<FinalizedTxData> => {
  const canonicalMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const normalizedMethodId = requireExistingVerificationMethodLedgerId(
    didState,
    ledgerIdentifier(didContract, canonicalMethodId),
    "opaque",
  );
  assertVerificationMethodIsNotReferenced(didState, normalizedMethodId);

  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.removeVerificationMethodAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          normalizedMethodId,
        ),
      ),
    didState,
  );
  const result = await didContract.callTx.removeVerificationMethod(
    normalizedMethodId,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const addSchnorrJubjubVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  verificationMethod: SchnorrJubjubVerificationMethod,
): Promise<FinalizedTxData> => {
  const ledgerVerificationMethod = schnorrJubjubVerificationMethodToLedger(
    didContract,
    verificationMethod,
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  if (
    findExistingVerificationMethodLedgerIdentifier(
      didState,
      ledgerIdentifier(didContract, ledgerVerificationMethod.id),
    ) !== null
  ) {
    throw new Error(
      `verification method ${ledgerVerificationMethod.id} already exists`,
    );
  }
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.setSchnorrJubjubVerificationMethodAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          ledgerVerificationMethod,
          DIDContract.MapMutation.Insert,
        ),
      ),
    didState,
  );
  const result = await didContract.callTx.setSchnorrJubjubVerificationMethod(
    ledgerVerificationMethod,
    DIDContract.MapMutation.Insert,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const updateSchnorrJubjubVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  verificationMethod: SchnorrJubjubVerificationMethod,
): Promise<FinalizedTxData> => {
  const canonicalVerificationMethod = schnorrJubjubVerificationMethodToLedger(
    didContract,
    verificationMethod,
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const existingMethodId = requireExistingVerificationMethodLedgerId(
    didState,
    ledgerIdentifier(didContract, canonicalVerificationMethod.id),
    "schnorrJubjub",
  );
  const ledgerVerificationMethod = {
    ...canonicalVerificationMethod,
    id: existingMethodId,
  };
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.setSchnorrJubjubVerificationMethodAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          ledgerVerificationMethod,
          DIDContract.MapMutation.Update,
        ),
      ),
    didState,
  );
  const result = await didContract.callTx.setSchnorrJubjubVerificationMethod(
    ledgerVerificationMethod,
    DIDContract.MapMutation.Update,
    signature,
    expectedVersion,
  );
  return result.public;
};

/**
 * Removes one unreferenced native SchnorrJubjub verification method.
 *
 * This helper never removes verification relationships implicitly.
 * @throws {VerificationMethodReferencedError} when any relationship still
 * references the selected physical ledger id.
 */
export const removeSchnorrJubjubVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  methodId: string,
): Promise<FinalizedTxData> => {
  const canonicalMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const normalizedMethodId = requireExistingVerificationMethodLedgerId(
    didState,
    ledgerIdentifier(didContract, canonicalMethodId),
    "schnorrJubjub",
  );
  assertVerificationMethodIsNotReferenced(didState, normalizedMethodId);

  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.removeSchnorrJubjubVerificationMethodAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          normalizedMethodId,
        ),
      ),
    didState,
  );
  const result = await didContract.callTx.removeSchnorrJubjubVerificationMethod(
    normalizedMethodId,
    signature,
    expectedVersion,
  );
  return result.public;
};

/**
 * Submits the ledger-bound SchnorrJubjub verification circuit.
 *
 * This is a transaction-backed proof rather than an off-chain verifier so the
 * proof is tied to the current DID ledger state while the digest and signature
 * remain private circuit inputs.
 */
type VerifySchnorrJubjubDigestSignature = {
  (
    didContract: DeployedMidnightDIDContract,
    providers: MidnightDIDProviders,
    methodId: string,
    digest: SchnorrJubjubDigest,
    signature: SchnorrJubjubSignature,
  ): Promise<FinalizedTxData>;
  /**
   * @deprecated Pass `providers` as the second argument so canonical and legacy
   * ledger keys can be resolved from current state. This overload preserves the
   * historical fragment-keyed behavior for existing consumers.
   */
  (
    didContract: DeployedMidnightDIDContract,
    methodId: string,
    digest: SchnorrJubjubDigest,
    signature: SchnorrJubjubSignature,
  ): Promise<FinalizedTxData>;
};

export const verifySchnorrJubjubDigestSignature: VerifySchnorrJubjubDigestSignature =
  async (
    didContract: DeployedMidnightDIDContract,
    providersOrMethodId: MidnightDIDProviders | string,
    methodIdOrDigest: string | SchnorrJubjubDigest,
    digestOrSignature: SchnorrJubjubDigest | SchnorrJubjubSignature,
    maybeSignature?: SchnorrJubjubSignature,
  ): Promise<FinalizedTxData> => {
    const stateAware = typeof providersOrMethodId !== "string";
    const methodId = stateAware
      ? (methodIdOrDigest as string)
      : providersOrMethodId;
    const digest = stateAware
      ? (digestOrSignature as SchnorrJubjubDigest)
      : (methodIdOrDigest as SchnorrJubjubDigest);
    const signature = stateAware
      ? (maybeSignature as SchnorrJubjubSignature)
      : (digestOrSignature as SchnorrJubjubSignature);
    const canonicalMethodId = normalizeBoundFragmentId(
      didContract,
      methodId,
      "methodId",
    );
    const identifier = ledgerIdentifier(didContract, canonicalMethodId);
    let normalizedMethodId: string;
    if (stateAware) {
      const didState = await requireDeployedMidnightDIDLedgerState(
        providersOrMethodId,
        didContract,
      );
      normalizedMethodId = requireExistingVerificationMethodLedgerId(
        didState,
        identifier,
        "schnorrJubjub",
      );
    } else {
      normalizedMethodId = identifier.legacy ?? identifier.canonical;
    }
    const result = await didContract.callTx.verifySchnorrJubjubDigestSignature(
      normalizedMethodId,
      digest,
      signature,
    );
    return result.public;
  };

export const addVerificationMethodRelation = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  relation: VerificationMethodRelationType,
  methodId: string,
): Promise<FinalizedTxData> => {
  const canonicalMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const normalizedMethodId = requireExistingVerificationMethodLedgerId(
    didState,
    ledgerIdentifier(didContract, canonicalMethodId),
  );
  assertVerificationMethodRelationAbsent(
    didState,
    relation,
    normalizedMethodId,
  );
  assertVerificationMethodRelationCompatible(
    didState,
    relation,
    normalizedMethodId,
  );
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
          DIDContract.SetMutation.Insert,
        ),
      ),
    didState,
  );
  const result = await didContract.callTx.setVerificationMethodRelation(
    ledgerRelation,
    normalizedMethodId,
    DIDContract.SetMutation.Insert,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const removeVerificationMethodRelation = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  relation: VerificationMethodRelationType,
  methodId: string,
): Promise<FinalizedTxData> => {
  const canonicalMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const normalizedMethodId = requireExistingVerificationMethodLedgerId(
    didState,
    ledgerIdentifier(didContract, canonicalMethodId),
  );
  assertVerificationMethodRelationPresent(
    didState,
    relation,
    normalizedMethodId,
  );
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
    didState,
  );
  const result = await didContract.callTx.setVerificationMethodRelation(
    ledgerRelation,
    normalizedMethodId,
    DIDContract.SetMutation.Remove,
    signature,
    expectedVersion,
  );
  return result.public;
};
