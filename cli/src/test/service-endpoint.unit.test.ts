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

import { getNetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import * as api from '../api';

const contractAddress = 'a'.repeat(64);
const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as any;

const makeContract = () =>
  ({
    deployTxData: {
      public: {
        contractAddress,
      },
    },
    callTx: {
      addService: vi.fn().mockResolvedValue({ public: { ok: true } }),
      updateService: vi.fn().mockResolvedValue({ public: { ok: true } }),
    },
  }) as any;

describe('service endpoint serialization', () => {
  let previousNetworkId: string | undefined;

  beforeAll(() => {
    try {
      previousNetworkId = getNetworkId();
    } catch {
      previousNetworkId = undefined;
    }
    // These helpers normalize DID subjects and need an active local network id.
    setNetworkId('undeployed');
  });

  afterAll(() => {
    if (previousNetworkId !== undefined) {
      setNetworkId(previousNetworkId);
    }
  });

  api.setLogger(logger);

  it('serializes object serviceEndpoint in addService', async () => {
    const didContract = makeContract();
    const endpoint = { uri: 'https://example.com/messages' };

    await api.addService(didContract, '#service-object', 'MessagingService', endpoint);

    expect(didContract.callTx.addService).toHaveBeenCalledWith({
      id: '#service-object',
      typ: 'MessagingService',
      serviceEndpoint: JSON.stringify(endpoint),
    });
  });

  it('serializes array serviceEndpoint in updateService', async () => {
    const didContract = makeContract();
    const endpoint = ['https://example.com/messages', { uri: 'https://example.com/backup' }];

    await api.updateService(didContract, '#service-array', 'MessagingService', endpoint);

    expect(didContract.callTx.updateService).toHaveBeenCalledWith({
      id: '#service-array',
      typ: 'MessagingService',
      serviceEndpoint: JSON.stringify(endpoint),
    });
  });

  it('rejects invalid URI string serviceEndpoint', async () => {
    const didContract = makeContract();
    await expect(api.addService(didContract, '#service-invalid', 'MessagingService', 'not-a-uri')).rejects.toThrow(
      /Invalid serviceEndpoint/,
    );
  });
});
