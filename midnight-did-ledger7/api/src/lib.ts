// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { type ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { DIDContract } from "@midnight-ntwrk/did-contract";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import {
  type DeployedDIDContract,
  type DIDProviders,
  VerificationMethodRelation,
  VerificationMethodType,
  KeyType,
  CurveType,
} from "./types";

/**
 * Query the ledger state of a DID contract
 */
export const getDIDLedgerState = async (
  providers: DIDProviders,
  contractAddress: ContractAddress,
): Promise<DIDContract.Ledger | null> => {
  assertIsContractAddress(contractAddress);
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((contractState) => {
      if (contractState == null) return null;
      return DIDContract.ledger(contractState.data);
    });
  return state;
};

/**
 * Add a verification method to the DID document
 */
export const addVerificationMethod = async (
  didContract: DeployedDIDContract,
  id: string,
  publicKeyJwk: {
    kty: "EC" | "RSA" | "oct" | "OKP";
    crv: "Ed25519" | "Jubjub";
    x: bigint;
    y: bigint;
  },
): Promise<any> => {
  const result = await didContract.callTx.addVerificationMethod({
    id,
    typ: VerificationMethodType.JsonWebKey,
    publicKeyJwk: {
      kty: KeyType[publicKeyJwk.kty],
      crv: CurveType[publicKeyJwk.crv],
      x: publicKeyJwk.x,
      y: publicKeyJwk.y,
    },
  });
  return result;
};

/**
 * Update an existing verification method
 */
export const updateVerificationMethod = async (
  didContract: DeployedDIDContract,
  id: string,
  publicKeyJwk: {
    kty: "EC" | "RSA" | "oct" | "OKP";
    crv: "Ed25519" | "Jubjub";
    x: bigint;
    y: bigint;
  },
): Promise<any> => {
  const result = await didContract.callTx.updateVerificationMethod({
    id,
    typ: VerificationMethodType.JsonWebKey,
    publicKeyJwk: {
      kty: KeyType[publicKeyJwk.kty],
      crv: CurveType[publicKeyJwk.crv],
      x: publicKeyJwk.x,
      y: publicKeyJwk.y,
    },
  });
  return result;
};

/**
 * Remove a verification method and all its relations.
 * This operation is decomposed into multiple transactions:
 * 1. Query current state to find which relations the method belongs to
 * 2. Remove the method from each relation (one transaction per relation)
 * 3. Remove the verification method itself
 *
 * This approach allows the wallet to sync between each operation.
 */
export const removeVerificationMethod = async (
  didContract: DeployedDIDContract,
  providers: DIDProviders,
  id: string,
): Promise<any> => {
  // Step 1: Query current DID state to see which relations this method is in
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const didState = await getDIDLedgerState(providers, contractAddress);

  if (!didState) {
    throw new Error("Cannot query DID state");
  }

  // Step 2: Remove from each relation (one transaction per relation)
  const relationsToCheck: Array<{
    name:
      | "Authentication"
      | "AssertionMethod"
      | "KeyAgreement"
      | "CapabilityInvocation"
      | "CapabilityDelegation";
    member: boolean;
  }> = [
    {
      name: "Authentication",
      member: didState.authenticationRelation.member(id),
    },
    {
      name: "AssertionMethod",
      member: didState.assertionMethodRelation.member(id),
    },
    { name: "KeyAgreement", member: didState.keyAgreementRelation.member(id) },
    {
      name: "CapabilityInvocation",
      member: didState.capabilityInvocationRelation.member(id),
    },
    {
      name: "CapabilityDelegation",
      member: didState.capabilityDelegationRelation.member(id),
    },
  ];

  for (const { name, member } of relationsToCheck) {
    if (member) {
      await didContract.callTx.removeVerificationMethodRelation(
        VerificationMethodRelation[name],
        id,
      );
    }
  }

  // Step 3: Remove the verification method itself
  const result = await didContract.callTx.removeVerificationMethod(id);
  return result;
};

/**
 * Add a verification method relation
 */
export const addVerificationMethodRelation = async (
  didContract: DeployedDIDContract,
  relation:
    | "Authentication"
    | "AssertionMethod"
    | "KeyAgreement"
    | "CapabilityInvocation"
    | "CapabilityDelegation",
  methodId: string,
): Promise<any> => {
  const result = await didContract.callTx.addVerificationMethodRelation(
    VerificationMethodRelation[relation],
    methodId,
  );
  return result;
};

/**
 * Remove a verification method relation
 */
export const removeVerificationMethodRelation = async (
  didContract: DeployedDIDContract,
  relation:
    | "Authentication"
    | "AssertionMethod"
    | "KeyAgreement"
    | "CapabilityInvocation"
    | "CapabilityDelegation",
  methodId: string,
): Promise<any> => {
  const result = await didContract.callTx.removeVerificationMethodRelation(
    VerificationMethodRelation[relation],
    methodId,
  );
  return result;
};

/**
 * Add a service to the DID document
 */
export const addService = async (
  didContract: DeployedDIDContract,
  id: string,
  type: string,
  serviceEndpoint: string,
): Promise<any> => {
  const result = await didContract.callTx.addService({
    id,
    typ: type,
    serviceEndpoint,
  });
  return result;
};

/**
 * Update an existing service
 */
export const updateService = async (
  didContract: DeployedDIDContract,
  id: string,
  type: string,
  serviceEndpoint: string,
): Promise<any> => {
  const result = await didContract.callTx.updateService({
    id,
    typ: type,
    serviceEndpoint,
  });
  return result;
};

/**
 * Remove a service from the DID document
 */
export const removeService = async (
  didContract: DeployedDIDContract,
  id: string,
): Promise<any> => {
  const result = await didContract.callTx.removeService(id);
  return result;
};

/**
 * Add an alsoKnownAs value
 */
export const addAlsoKnownAs = async (
  didContract: DeployedDIDContract,
  value: string,
): Promise<any> => {
  const result = await didContract.callTx.addAlsoKnownAs(value);
  return result;
};

/**
 * Remove an alsoKnownAs value
 */
export const removeAlsoKnownAs = async (
  didContract: DeployedDIDContract,
  value: string,
): Promise<any> => {
  const result = await didContract.callTx.removeAlsoKnownAs(value);
  return result;
};

/**
 * Deactivate the DID document
 */
export const deactivateDID = async (
  didContract: DeployedDIDContract,
): Promise<any> => {
  const result = await didContract.callTx.deactivate();
  return result;
};
