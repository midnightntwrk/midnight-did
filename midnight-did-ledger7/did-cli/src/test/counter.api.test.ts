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

import { type WalletContext } from '../api';
import path from 'path';
import * as api from '../api';
import { type DIDProviders } from '../common-types';
import { currentDir } from '../config';
import { createLogger } from '../logger-utils';
import { TestEnvironment } from './commons';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const logDir = path.resolve(currentDir, '..', 'logs', 'tests', `${new Date().toISOString()}.log`);
const logger = await createLogger(logDir);

describe('API', () => {
  let testEnvironment: TestEnvironment;
  let walletCtx: WalletContext;
  let providers: DIDProviders;

  beforeAll(
    async () => {
      api.setLogger(logger);
      testEnvironment = new TestEnvironment(logger);
      const testConfiguration = await testEnvironment.start();
      walletCtx = await testEnvironment.getWallet();
      providers = await api.configureProviders(walletCtx, testConfiguration.dappConfig);
    },
    1000 * 60 * 45,
  );

  afterAll(async () => {
    await testEnvironment.shutdown();
  });

  it('should deploy the DID contract and verify initial state [@slow]', async () => {
    // Deploy the DID contract with empty private state
    const didContract = await api.deploy(providers, {});
    expect(didContract).not.toBeNull();
    expect(didContract.deployTxData.public.contractAddress).toMatch(/[0-9a-f]{64}/);

    // Display and verify the initial DID state
    const didState = await api.displayDIDState(providers, didContract);
    expect(didState.didState).not.toBeNull();
    expect(didState.didState?.contractVersion).toEqual(1n);
    expect(didState.didState?.active).toEqual(true);
    expect(didState.contractAddress).toEqual(didContract.deployTxData.public.contractAddress);
  });
});
