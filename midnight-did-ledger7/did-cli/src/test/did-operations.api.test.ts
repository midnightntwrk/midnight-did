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

import { type WalletContext, type DeployedDIDContract } from '../api';
import path from 'path';
import * as api from '../api';
import { type DIDProviders } from '../common-types';
import { currentDir } from '../config';
import { createLogger } from '../logger-utils';
import { TestEnvironment } from './commons';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const logDir = path.resolve(currentDir, '..', 'logs', 'tests', `${new Date().toISOString()}.log`);
const logger = await createLogger(logDir);

describe('DID Operations API [@slow]', () => {
  let testEnvironment: TestEnvironment;
  let walletCtx: WalletContext;
  let providers: DIDProviders;
  let didContract: DeployedDIDContract;

  beforeAll(
    async () => {
      api.setLogger(logger);
      testEnvironment = new TestEnvironment(logger);
      const testConfiguration = await testEnvironment.start();
      walletCtx = await testEnvironment.getWallet();
      providers = await api.configureProviders(walletCtx, testConfiguration.dappConfig);

      // Deploy the DID contract for all tests
      didContract = await api.deploy(providers);
      expect(didContract).not.toBeNull();
      expect(didContract.deployTxData.public.contractAddress).toMatch(/[0-9a-f]{64}/);
    },
    1000 * 60 * 45,
  );

  afterAll(async () => {
    await testEnvironment.shutdown();
  });

  it('should verify initial DID state', async () => {
    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState).not.toBeNull();
    expect(didState.didState?.contractVersion).toEqual(1n);
    expect(didState.didState?.active).toEqual(true);
    expect(didState.didState?.deactivated).toEqual(false);
    expect(didState.didState?.version).toEqual(0n);
    expect(didState.didState?.operationCount).toEqual(0n);
    expect(didState.contractAddress).toEqual(didContract.deployTxData.public.contractAddress);
  });

  it('should add a verification method', async () => {
    const vmOp = api.addVerificationMethodOp('#key-1', {
      kty: 'OKP',
      crv: 'Ed25519',
      x: 12345n,
      y: 67890n,
    });

    await api.applyDIDOperations(didContract, vmOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.verificationMethods.size()).toEqual(1n);
    expect(didState.didState?.version).toEqual(1n);
    expect(didState.didState?.operationCount).toEqual(1n);

    // Verify the verification method details
    const vm = didState.didState?.verificationMethods.lookup('#key-1');
    expect(vm).toBeDefined();
    expect(vm?.id).toEqual('#key-1');
    expect(vm?.typ).toEqual(api.VerificationMethodType.JsonWebKey);
    expect(vm?.publicKeyJwk.kty).toEqual(api.KeyType.OKP);
    expect(vm?.publicKeyJwk.crv).toEqual(api.CurveType.Ed25519);
    expect(vm?.publicKeyJwk.x).toEqual(12345n);
    expect(vm?.publicKeyJwk.y).toEqual(67890n);
  });

  it('should add a verification method relation', async () => {
    const relationOp = api.addVerificationMethodRelationOp('Authentication', '#key-1');

    await api.applyDIDOperations(didContract, relationOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.authenticationRelation.member('#key-1')).toEqual(true);
    expect(didState.didState?.authenticationRelation.size()).toEqual(1n);
    expect(didState.didState?.version).toEqual(2n);
    expect(didState.didState?.operationCount).toEqual(2n);
  });

  it('should add multiple relations in one transaction', async () => {
    const op1 = api.addVerificationMethodRelationOp('AssertionMethod', '#key-1');
    const op2 = api.addVerificationMethodRelationOp('KeyAgreement', '#key-1');

    await api.applyDIDOperations(didContract, op1, op2);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.assertionMethodRelation.member('#key-1')).toEqual(true);
    expect(didState.didState?.keyAgreementRelation.member('#key-1')).toEqual(true);
    expect(didState.didState?.version).toEqual(3n);
    expect(didState.didState?.operationCount).toEqual(4n);
  });

  it('should add a service', async () => {
    const serviceOp = api.addServiceOp('#service-1', 'MessagingService', 'https://example.com/messages');

    await api.applyDIDOperations(didContract, serviceOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.services.size()).toEqual(1n);
    expect(didState.didState?.services.member('#service-1')).toEqual(true);

    const service = didState.didState?.services.lookup('#service-1');
    expect(service?.id).toEqual('#service-1');
    expect(service?.typ).toEqual('MessagingService');
    expect(service?.serviceEndpoint).toEqual('https://example.com/messages');
    expect(didState.didState?.version).toEqual(4n);
  });

  it('should update a service', async () => {
    const updateOp = api.updateServiceOp('#service-1', 'MessagingService', 'https://new-endpoint.com/messages');

    await api.applyDIDOperations(didContract, updateOp);

    const didState = await api.displayDIDState(providers, didContract);
    const service = didState.didState?.services.lookup('#service-1');
    expect(service?.serviceEndpoint).toEqual('https://new-endpoint.com/messages');
    expect(didState.didState?.version).toEqual(5n);
  });

  it('should add an alsoKnownAs value', async () => {
    const aliasOp = api.addAlsoKnownAsOp('did:example:alternative-id');

    await api.applyDIDOperations(didContract, aliasOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.alsoKnownAs.member('did:example:alternative-id')).toEqual(true);
    expect(didState.didState?.alsoKnownAs.size()).toEqual(1n);
    expect(didState.didState?.version).toEqual(6n);
  });

  it('should update a verification method', async () => {
    const updateOp = api.updateVerificationMethodOp('#key-1', {
      kty: 'OKP',
      crv: 'Ed25519',
      x: 99999n,
      y: 88888n,
    });

    await api.applyDIDOperations(didContract, updateOp);

    const didState = await api.displayDIDState(providers, didContract);
    const vm = didState.didState?.verificationMethods.lookup('#key-1');
    expect(vm?.publicKeyJwk.x).toEqual(99999n);
    expect(vm?.publicKeyJwk.y).toEqual(88888n);
    expect(didState.didState?.version).toEqual(7n);
  });

  it('should remove a verification method relation', async () => {
    const removeOp = api.removeVerificationMethodRelationOp('KeyAgreement', '#key-1');

    await api.applyDIDOperations(didContract, removeOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.keyAgreementRelation.member('#key-1')).toEqual(false);
    expect(didState.didState?.authenticationRelation.member('#key-1')).toEqual(true); // Other relations still exist
    expect(didState.didState?.version).toEqual(8n);
  });

  it('should remove an alsoKnownAs value', async () => {
    const removeOp = api.removeAlsoKnownAsOp('did:example:alternative-id');

    await api.applyDIDOperations(didContract, removeOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.alsoKnownAs.member('did:example:alternative-id')).toEqual(false);
    expect(didState.didState?.alsoKnownAs.size()).toEqual(0n);
    expect(didState.didState?.version).toEqual(9n);
  });

  it('should remove a service', async () => {
    const removeOp = api.removeServiceOp('#service-1');

    await api.applyDIDOperations(didContract, removeOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.services.member('#service-1')).toEqual(false);
    expect(didState.didState?.services.size()).toEqual(0n);
    expect(didState.didState?.version).toEqual(10n);
  });

  it('should remove a verification method and its relations', async () => {
    const removeOp = api.removeVerificationMethodOp('#key-1');

    await api.applyDIDOperations(didContract, removeOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.verificationMethods.member('#key-1')).toEqual(false);
    expect(didState.didState?.verificationMethods.size()).toEqual(0n);
    // Relations should also be removed automatically
    expect(didState.didState?.authenticationRelation.member('#key-1')).toEqual(false);
    expect(didState.didState?.assertionMethodRelation.member('#key-1')).toEqual(false);
    expect(didState.didState?.version).toEqual(11n);
  });

  it('should batch multiple operations in one transaction', async () => {
    const op1 = api.addVerificationMethodOp('#key-2', { kty: 'OKP', crv: 'Ed25519', x: 1111n, y: 2222n });
    const op2 = api.addVerificationMethodRelationOp('Authentication', '#key-2');
    const op3 = api.addServiceOp('#service-2', 'IdentityHub', 'https://hub.example.com');
    const op4 = api.addAlsoKnownAsOp('did:example:alias');

    await api.applyDIDOperations(didContract, op1, op2, op3, op4);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.verificationMethods.member('#key-2')).toEqual(true);
    expect(didState.didState?.authenticationRelation.member('#key-2')).toEqual(true);
    expect(didState.didState?.services.member('#service-2')).toEqual(true);
    expect(didState.didState?.alsoKnownAs.member('did:example:alias')).toEqual(true);
    expect(didState.didState?.version).toEqual(12n);
    expect(didState.didState?.operationCount).toEqual(19n); // Previous 15 + 4 new
  });

  it('should deactivate the DID', async () => {
    const deactivateOp = api.deactivateDIDOp();

    await api.applyDIDOperations(didContract, deactivateOp);

    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState?.active).toEqual(false);
    expect(didState.didState?.deactivated).toEqual(true);
    expect(didState.didState?.version).toEqual(13n);
  });

  it('should fail when trying to operate on deactivated DID', async () => {
    const op = api.addVerificationMethodOp('#key-3', { kty: 'OKP', crv: 'Ed25519', x: 3333n, y: 4444n });

    await expect(api.applyDIDOperations(didContract, op)).rejects.toThrow();
  });
});
