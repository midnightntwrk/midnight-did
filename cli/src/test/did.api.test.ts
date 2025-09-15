// This file is part of midnightntwrk/example-counter.
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

import {
  ContractAddress as MidnightContractAddress,
  createMidnightDIDString,
  CurveType,
  DIDOperation,
  DIDOperationType,
  DIDStringSchema,
  KeyType,
  MidnightDIDSchema,
  MidnightDIDString,
  parseContractAddress,
  parseDIDKeyID,
  parseMidnightDID,
  parseMidnightDIDString,
  parseService,
  VerificationMethodRelationType,
  VerificationMethodType,
} from '@midnight-ntwrk/midnight-did-contract';
import { type Resource } from '@midnight-ntwrk/wallet';
import { type Wallet } from '@midnight-ntwrk/wallet-api';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as api from '../api';
import { DeployedMidnightDIDContract, type MidnightDIDProviders } from '../common-types';
import { currentDir } from '../config';
import { BigIntReplacer, createLogger } from '../logger-utils';
import { TestEnvironment } from './commons';

const logDir = path.resolve(currentDir, '..', 'logs', 'tests', `${new Date().toISOString()}.log`);
const logger = await createLogger(logDir);

describe('Midnight DID method API', () => {
  let testEnvironment: TestEnvironment;
  let wallet: Wallet & Resource;
  let providers: MidnightDIDProviders;
  let contract: DeployedMidnightDIDContract;
  let contractAddress: MidnightContractAddress;
  let didString: MidnightDIDString;

  beforeAll(
    async () => {
      api.setLogger(logger);
      testEnvironment = new TestEnvironment(logger);
      const testConfiguration = await testEnvironment.start();
      wallet = await testEnvironment.getWallet();
      providers = await api.configureProviders(wallet, testConfiguration.dappConfig);
    },
    1000 * 60 * 45 * 10,
  );

  afterAll(async () => {
    await testEnvironment.saveWalletCache();
    await testEnvironment.shutdown();
  });

  it('should publish the associated smart-contract to the Midnight blockchain with an empty state', async () => {
    const privateState = await api.initPrivateState(providers);
    contract = await api.createDID(providers, privateState);
    expect(contract).not.toBeNull();

    contractAddress = parseContractAddress(contract.deployTxData.public.contractAddress);
    logger.info(`MidnightDID contract address: ${contractAddress}`);

    didString = createMidnightDIDString(contractAddress, api.midnightNetwork);
    logger.info(`MidnightDID ID is: ${didString}`);

    const didLedger = await api.getMidnightDIDLedgerState(providers, contractAddress);
    expect(didLedger?.active).toBeTruthy;
    expect(didLedger?.verificationMethods.isEmpty).toBeTruthy;
    expect(didLedger?.assertionMethodRelation.isEmpty).toBeTruthy;
    expect(didLedger?.authenticationRelation.isEmpty).toBeTruthy;
    expect(didLedger?.capabilityDelegationRelation.isEmpty).toBeTruthy;
    expect(didLedger?.capabilityInvocationRelation.isEmpty).toBeTruthy;
    expect(didLedger?.services.isEmpty).toBeTruthy;
  });

  it('should resolve the DID Document including a reference to the DID Core 1.0 specification in the `@context` property', async () => {
    const didDoc = await api.resolve(providers, contract);

    expect(didDoc).toBeTruthy;
    expect(didDoc?.['@context']).toBeInstanceOf(Array);
    expect(didDoc?.['@context'][0]).toBe('https://www.w3.org/ns/did/v1');
  });

  it('should resolve the DID Document with an `id` matching the format: `did:midnight:<network_id>:<contract_address>`', async () => {
    const didDoc = await api.resolve(providers, contract);

    expect(didDoc).toBeTruthy;
    expect(typeof didDoc?.id).toBe('string');
    expect(() => DIDStringSchema.parse(didDoc?.id)).not.toThrow();
    expect(() => MidnightDIDSchema.parse(didDoc?.id)).not.toThrow();

    const midnightDIDString = parseMidnightDIDString(didDoc?.id);
    const midnightDID = parseMidnightDID(midnightDIDString);

    expect(midnightDID.network).toBe(api.midnightNetwork.toString());
    expect(midnightDID.id).toBe(contractAddress);
  });

  //TODO: change the VerificationMethodType to JsonWebKey
  it(`should add the verification method with ${VerificationMethodType.JsonWebKey} public key`, async () => {
    const methodId = parseDIDKeyID(`${didString}#key-1`);
    const publicKeyJwk = {
      kty: KeyType.EC,
      crv: CurveType.ed25519,
      x: 42n,
      y: 84n,
    };

    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.AddVerificationMethod,
        verificationMethod: {
          id: methodId,
          type: VerificationMethodType.JsonWebKey,
          controller: didString,
          publicKeyJwk: publicKeyJwk,
        },
      },
    ];

    await api.update(contract, operations);

    const didDocument = await api.resolve(providers, contract);
    logger.info(`DIDDocument JSON: ${JSON.stringify(didDocument, BigIntReplacer, 2)}`);

    expect(didDocument?.verificationMethod).not.toBeNull();

    const insertedVerificationMethod = didDocument?.verificationMethod?.find((vm) => vm.id === methodId);

    expect(insertedVerificationMethod).not.toBeNull;
    expect(insertedVerificationMethod?.type).toEqual(VerificationMethodType.JsonWebKey);
    expect(insertedVerificationMethod?.controller).toEqual(didString);
    expect(insertedVerificationMethod?.publicKeyJwk).toEqual(publicKeyJwk);
  });

  it('should add the verification relation', async () => {
    const methodId = parseDIDKeyID(`${didString}#key-1`);

    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.AddVerificationMethodRelation,
        relation: VerificationMethodRelationType.Authentication,
        methodId: methodId,
      },
    ];

    await api.update(contract, operations);

    const didDoc = await api.resolve(providers, contract);
    logger.info(`DIDDocument JSON: ${JSON.stringify(didDoc, BigIntReplacer, 2)}`);
    expect(didDoc?.authentication?.some((authenticationMethodId) => authenticationMethodId === methodId)).toBe(true);
  });

  it('should update the DID by adding a new verification method and its corresponding verification relation using a batch operation', async () => {
    const methodId = parseDIDKeyID(`${didString}#key-2`);
    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.AddVerificationMethod,
        verificationMethod: {
          id: methodId,
          type: VerificationMethodType.JsonWebKey,
          controller: didString,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.ed25519,
            x: 42n,
            y: 84n,
          },
        },
      },
      {
        type: DIDOperationType.AddVerificationMethodRelation,
        relation: VerificationMethodRelationType.AssertionMethod,
        methodId: methodId,
      },
    ];

    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);

    const didDoc = await api.resolve(providers, contract);
    logger.info(`DIDDocument JSON: ${JSON.stringify(didDoc, BigIntReplacer, 2)}`);

    expect(didDoc?.verificationMethod).not.toBeNull();

    const insertedVerificationMethod = didDoc?.verificationMethod?.find((vm) => vm.id === methodId);
    expect(insertedVerificationMethod).not.toBeNull;
    expect(insertedVerificationMethod?.type).toEqual(VerificationMethodType.JsonWebKey);
  });

  it('should update the DID by adding a new service endpoint', async () => {
    const serviceToAdd = parseService({
      id: 'didcomm-1',
      type: 'DIDCommV2',
      serviceEndpoint: ['https://localhost/didcomm/v2', 'wss://localhost/didcomm/v2'],
    });

    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.AddService,
        service: serviceToAdd,
      },
    ];

    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);

    const didDoc = await api.resolve(providers, contract);
    logger.info(`DIDDocument JSON: ${JSON.stringify(didDoc, BigIntReplacer, 2)}`);

    expect(didDoc?.service).not.toBeNull();
    const service = didDoc?.service!;

    expect(service.length).toBe(1);
    expect(service[0].id).toBe(serviceToAdd.id);
    expect(service[0].type).toBe(serviceToAdd.type);
    expect(service[0].serviceEndpoint).toEqual(serviceToAdd.serviceEndpoint);
  });

  it('should update the DID by modifying the existing service endpoint', async () => {
    const serviceToUpdate = parseService({
      id: 'didcomm-1',
      type: 'DIDCommV2',
      serviceEndpoint: ['https://localhost/updated', 'wss://localhost/updated'],
    });

    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.UpdateService,
        service: serviceToUpdate,
      },
    ];

    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);

    const didDoc = await api.resolve(providers, contract);
    logger.info(`DIDDocument JSON (after update): ${JSON.stringify(didDoc, BigIntReplacer, 2)}`);

    expect(didDoc?.service).not.toBeNull();
    const service = didDoc?.service!;
    expect(service.length).toBe(1);
    expect(service[0].id).toBe(serviceToUpdate.id);
    expect(service[0].serviceEndpoint).toEqual(serviceToUpdate.serviceEndpoint);
  });

  it('should update the DID by removing the service using its `id`', async () => {
    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.RemoveService,
        serviceId: 'didcomm-1',
      },
    ];

    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);

    const didDoc = await api.resolve(providers, contract);
    logger.info(`DIDDocument JSON (after removal): ${JSON.stringify(didDoc, BigIntReplacer, 2)}`);

    expect(didDoc?.service?.length ?? 0).toBe(0);
  });
});
