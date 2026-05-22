import {
  VerificationMethod,
  VerificationMethodRelationType,
} from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { normalizeBoundFragmentId } from "./did-subject.js";
import {
  LedgerVerificationMethodRelationMap,
  verificationMethodToLedger,
} from "./ledger-mappers.js";
import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
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
  const result = await didContract.callTx.addVerificationMethod(
    verificationMethodToLedger(didContract, verificationMethod),
  );
  return result.public;
};

export const updateVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.updateVerificationMethod(
    verificationMethodToLedger(didContract, verificationMethod),
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
  const result = await didContract.callTx.addVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizedMethodId,
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
  const result = await didContract.callTx.removeVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizedMethodId,
  );
  return result.public;
};
