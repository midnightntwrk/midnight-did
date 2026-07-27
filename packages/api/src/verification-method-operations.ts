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
  assertVerificationMethodRelationAbsent,
  assertVerificationMethodRelationPresent,
  purgeVerificationMethodFromAllRelations,
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
  const ledgerVerificationMethod = verificationMethodToLedger(
    didContract,
    verificationMethod,
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
  );
  const result = await didContract.callTx.setVerificationMethod(
    ledgerVerificationMethod,
    DIDContract.MapMutation.Update,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const removeVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  methodId: string,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  await purgeVerificationMethodFromAllRelations(
    didContract,
    providers,
    normalizedMethodId,
  );

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
  const ledgerVerificationMethod = schnorrJubjubVerificationMethodToLedger(
    didContract,
    verificationMethod,
  );
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
  );
  const result = await didContract.callTx.setSchnorrJubjubVerificationMethod(
    ledgerVerificationMethod,
    DIDContract.MapMutation.Update,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const removeSchnorrJubjubVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  methodId: string,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  await purgeVerificationMethodFromAllRelations(
    didContract,
    providers,
    normalizedMethodId,
  );

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
export const verifySchnorrJubjubDigestSignature = async (
  didContract: DeployedMidnightDIDContract,
  methodId: string,
  digest: SchnorrJubjubDigest,
  signature: SchnorrJubjubSignature,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
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
  const normalizedMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  assertVerificationMethodRelationAbsent(
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
  const normalizedMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
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
