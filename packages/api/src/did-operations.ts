import {
  createMidnightDIDString,
  LedgerToDomain,
  MidnightDIDDocument,
  MidnightNetwork,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did";
import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  assertAbsoluteUri,
  type BoundIdField,
  CurveType,
  decodeFieldElement,
  DIDDocumentMetadata,
  KeyType,
  normalizeBoundFragmentId as normalizeBoundFragmentIdWithSubject,
  PublicKeyJwk,
  Service,
  serviceEndpointToLedger as serviceEndpointToLedgerValue,
  serviceTypeToLedger as serviceTypeToLedgerValue,
  VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { getLogger } from "./api-logger.js";
import { getMidnightDIDLedgerState } from "./contract-lifecycle.js";
import { BigIntReplacer } from "./logger-utils.js";
import { RuntimeToDomain } from "./runtime-to-domain.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

const getDidSubject = (didContract: DeployedMidnightDIDContract): string => {
  const network = RuntimeToDomain.NetworkMap[getNetworkId()];
  const contractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  return createMidnightDIDString(contractAddress, network);
};

const normalizeBoundFragmentId = (
  didContract: DeployedMidnightDIDContract,
  value: string,
  field: BoundIdField,
): string =>
  normalizeBoundFragmentIdWithSubject(value, field, getDidSubject(didContract));

const LedgerKeyType = DIDContract.KeyType;
const LedgerCurveType = DIDContract.CurveType;
const LedgerVerificationMethodType = DIDContract.VerificationMethodType;
const LedgerVerificationMethodRelation = DIDContract.VerificationMethodRelation;

const LedgerKeyTypeMap: Record<
  KeyType,
  (typeof LedgerKeyType)[keyof typeof LedgerKeyType]
> = {
  [KeyType.EC]: LedgerKeyType.EC,
  [KeyType.RSA]: LedgerKeyType.RSA,
  [KeyType.oct]: LedgerKeyType.oct,
  [KeyType.OKP]: LedgerKeyType.OKP,
};

const LedgerCurveTypeMap: Record<
  CurveType,
  (typeof LedgerCurveType)[keyof typeof LedgerCurveType]
> = {
  [CurveType.Ed25519]: LedgerCurveType.Ed25519,
  [CurveType.Jubjub]: LedgerCurveType.Jubjub,
  [CurveType.P256]: LedgerCurveType.P256,
};

const LedgerVerificationMethodTypeMap: Record<
  VerificationMethodType,
  (typeof LedgerVerificationMethodType)[keyof typeof LedgerVerificationMethodType]
> = {
  [VerificationMethodType.Undefined]: LedgerVerificationMethodType.Undefined,
  [VerificationMethodType.JsonWebKey]: LedgerVerificationMethodType.JsonWebKey,
};

const LedgerVerificationMethodRelationMap: Record<
  VerificationMethodRelationType,
  (typeof LedgerVerificationMethodRelation)[keyof typeof LedgerVerificationMethodRelation]
> = {
  [VerificationMethodRelationType.Undefined]:
    LedgerVerificationMethodRelation.Undefined,
  [VerificationMethodRelationType.Authentication]:
    LedgerVerificationMethodRelation.Authentication,
  [VerificationMethodRelationType.AssertionMethod]:
    LedgerVerificationMethodRelation.AssertionMethod,
  [VerificationMethodRelationType.KeyAgreement]:
    LedgerVerificationMethodRelation.KeyAgreement,
  [VerificationMethodRelationType.CapabilityInvocation]:
    LedgerVerificationMethodRelation.CapabilityInvocation,
  [VerificationMethodRelationType.CapabilityDelegation]:
    LedgerVerificationMethodRelation.CapabilityDelegation,
};

const publicKeyJwkToLedger = (
  publicKeyJwk: PublicKeyJwk,
): DIDContract.PublicKeyJwk => {
  const kty = LedgerKeyTypeMap[publicKeyJwk.kty];
  const crv = LedgerCurveTypeMap[publicKeyJwk.crv];
  const x = decodeFieldElement(publicKeyJwk.x);
  const y =
    publicKeyJwk.y !== undefined ? decodeFieldElement(publicKeyJwk.y) : 0n;

  return { kty, crv, x, y };
};

const assertMidnightKeyProfile = (publicKeyJwk: PublicKeyJwk): void => {
  if (publicKeyJwk.kty === KeyType.OKP) {
    if (publicKeyJwk.crv !== CurveType.Ed25519) {
      throw new Error("OKP keys must use Ed25519");
    }
    return;
  }
  if (publicKeyJwk.kty === KeyType.EC) {
    if (
      publicKeyJwk.crv !== CurveType.Jubjub &&
      publicKeyJwk.crv !== CurveType.P256
    ) {
      throw new Error("EC keys must use Jubjub or P-256");
    }
    return;
  }
  throw new Error(
    "Only OKP (Ed25519) and EC (Jubjub/P-256) keys are supported",
  );
};

const verificationMethodToLedger = (
  didContract: DeployedMidnightDIDContract,
  method: VerificationMethod,
): DIDContract.VerificationMethod => {
  if (method.type !== VerificationMethodType.JsonWebKey) {
    throw new Error("verificationMethod.type must be JsonWebKey");
  }
  assertMidnightKeyProfile(method.publicKeyJwk);
  const didSubject = getDidSubject(didContract);
  if (method.controller !== didSubject) {
    throw new Error(
      `verificationMethod.controller must equal DID subject (${didSubject})`,
    );
  }
  return {
    id: normalizeBoundFragmentId(
      didContract,
      method.id,
      "verificationMethod.id",
    ),
    typ: LedgerVerificationMethodTypeMap[method.type],
    publicKeyJwk: publicKeyJwkToLedger(method.publicKeyJwk),
  };
};

const serviceToLedger = (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): DIDContract.Service => {
  let endpoint: string;
  try {
    endpoint = serviceEndpointToLedgerValue(service.serviceEndpoint);
  } catch {
    throw new Error("Invalid serviceEndpoint: could not serialize to JSON");
  }

  return {
    id: normalizeBoundFragmentId(didContract, service.id, "service.id"),
    typ: serviceTypeToLedgerValue(service.type),
    serviceEndpoint: endpoint,
  };
};

const relationSetFromState = (
  didState: DIDContract.Ledger,
  relation: VerificationMethodRelationType,
) => {
  switch (relation) {
    case VerificationMethodRelationType.Authentication:
      return didState.authenticationRelation;
    case VerificationMethodRelationType.AssertionMethod:
      return didState.assertionMethodRelation;
    case VerificationMethodRelationType.KeyAgreement:
      return didState.keyAgreementRelation;
    case VerificationMethodRelationType.CapabilityInvocation:
      return didState.capabilityInvocationRelation;
    case VerificationMethodRelationType.CapabilityDelegation:
      return didState.capabilityDelegationRelation;
    case VerificationMethodRelationType.Undefined:
      throw new Error("relation must be defined");
  }
};

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
  const contractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  const didState = await getMidnightDIDLedgerState(providers, contractAddress);

  if (!didState) {
    throw new Error("Cannot query DID state");
  }

  const relationsToCheck: Array<{
    relation: VerificationMethodRelationType;
    member: boolean;
  }> = [
    {
      relation: VerificationMethodRelationType.Authentication,
      member: didState.authenticationRelation.member(normalizedMethodId),
    },
    {
      relation: VerificationMethodRelationType.AssertionMethod,
      member: didState.assertionMethodRelation.member(normalizedMethodId),
    },
    {
      relation: VerificationMethodRelationType.KeyAgreement,
      member: didState.keyAgreementRelation.member(normalizedMethodId),
    },
    {
      relation: VerificationMethodRelationType.CapabilityInvocation,
      member: didState.capabilityInvocationRelation.member(normalizedMethodId),
    },
    {
      relation: VerificationMethodRelationType.CapabilityDelegation,
      member: didState.capabilityDelegationRelation.member(normalizedMethodId),
    },
  ];

  for (const { relation, member } of relationsToCheck) {
    if (!member) continue;
    await didContract.callTx.removeVerificationMethodRelation(
      LedgerVerificationMethodRelationMap[relation],
      normalizedMethodId,
    );
  }

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
  const contractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  const didState = await getMidnightDIDLedgerState(providers, contractAddress);
  if (!didState) {
    throw new Error("Cannot query DID state");
  }
  const relationSet = relationSetFromState(didState, relation);
  if (relationSet.member(normalizedMethodId)) {
    throw new Error(
      `relation ${relation} already contains verification method ${normalizedMethodId}`,
    );
  }
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
  const contractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  const didState = await getMidnightDIDLedgerState(providers, contractAddress);
  if (!didState) {
    throw new Error("Cannot query DID state");
  }
  const relationSet = relationSetFromState(didState, relation);
  if (!relationSet.member(normalizedMethodId)) {
    throw new Error(
      `relation ${relation} does not contain verification method ${normalizedMethodId}`,
    );
  }
  const result = await didContract.callTx.removeVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizedMethodId,
  );
  return result.public;
};

export const addService = async (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.addService(
    serviceToLedger(didContract, service),
  );
  return result.public;
};

export const updateService = async (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.updateService(
    serviceToLedger(didContract, service),
  );
  return result.public;
};

export const removeService = async (
  didContract: DeployedMidnightDIDContract,
  serviceId: string,
): Promise<FinalizedTxData> => {
  const normalizedServiceId = normalizeBoundFragmentId(
    didContract,
    serviceId,
    "serviceId",
  );
  const result = await didContract.callTx.removeService(normalizedServiceId);
  return result.public;
};

export const addAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const alias = assertAbsoluteUri(aliasUri, "aliasUri");
  const result = await didContract.callTx.addAlsoKnownAs(alias);
  return result.public;
};

export const removeAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const alias = assertAbsoluteUri(aliasUri, "aliasUri");
  const result = await didContract.callTx.removeAlsoKnownAs(alias);
  return result.public;
};

export const deactivate = async (
  didContract: DeployedMidnightDIDContract,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.deactivate();
  return result.public;
};

export const getMidnightNetwork = (): MidnightNetwork =>
  RuntimeToDomain.NetworkMap[getNetworkId()];

export const resolve = async (
  providers: MidnightDIDProviders,
  didContract: DeployedMidnightDIDContract,
): Promise<{
  didDocument: MidnightDIDDocument;
  didDocumentMetadata: DIDDocumentMetadata;
} | null> => {
  const network = RuntimeToDomain.NetworkMap[getNetworkId()];
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const midnightContractAddress = parseContractAddress(contractAddress);
  const didContractState = await getMidnightDIDLedgerState(
    providers,
    midnightContractAddress,
  );
  if (didContractState === null) {
    getLogger().info(
      `There is no Midnight DID contract deployed at ${contractAddress}.`,
    );
    return null;
  }
  const didDocument = LedgerToDomain.ledgerStateToDIDDocument(
    didContractState,
    network,
    midnightContractAddress,
  );
  const didDocumentMetadata =
    LedgerToDomain.ledgerStateToMetadata(didContractState);
  getLogger().info(
    `MidnightDID Resolution Result:\n      ${JSON.stringify(
      { didDocument, didDocumentMetadata },
      BigIntReplacer,
      2,
    )}`,
  );
  return { didDocument, didDocumentMetadata };
};
