import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  VerificationMethod,
  VerificationMethodRelationType,
} from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

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
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.setVerificationMethod(
    verificationMethodToLedger(didContract, verificationMethod),
    DIDContract.MapMutation.Insert,
  );
  return result.public;
};

export const updateVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.setVerificationMethod(
    verificationMethodToLedger(didContract, verificationMethod),
    DIDContract.MapMutation.Update,
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

  const result =
    await didContract.callTx.removeVerificationMethod(normalizedMethodId);
  return result.public;
};

export const addSchnorrJubjubVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  verificationMethod: SchnorrJubjubVerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.setSchnorrJubjubVerificationMethod(
    schnorrJubjubVerificationMethodToLedger(didContract, verificationMethod),
    DIDContract.MapMutation.Insert,
  );
  return result.public;
};

export const updateSchnorrJubjubVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  verificationMethod: SchnorrJubjubVerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.setSchnorrJubjubVerificationMethod(
    schnorrJubjubVerificationMethodToLedger(didContract, verificationMethod),
    DIDContract.MapMutation.Update,
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

  const result =
    await didContract.callTx.removeSchnorrJubjubVerificationMethod(
      normalizedMethodId,
    );
  return result.public;
};

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
  const result = await didContract.callTx.setVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizedMethodId,
    DIDContract.SetMutation.Insert,
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
  const result = await didContract.callTx.setVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizedMethodId,
    DIDContract.SetMutation.Remove,
  );
  return result.public;
};
