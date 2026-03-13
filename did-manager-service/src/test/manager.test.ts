import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as api from '@midnight-ntwrk/midnight-did-api';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ManagerConfig } from '../config.js';
import { DidManagerService } from '../manager.js';

vi.mock('@midnight-ntwrk/midnight-did-api', async () => {
  const actual = await vi.importActual<typeof import('@midnight-ntwrk/midnight-did-api')>('@midnight-ntwrk/midnight-did-api');
  return {
    ...actual,
    setLogger: vi.fn(),
    registerForDustGeneration: vi.fn(),
    initPrivateState: vi.fn(),
    createDID: vi.fn(),
  };
});

const createConfig = (dataDir: string): ManagerConfig => ({
  host: '127.0.0.1',
  port: 3010,
  setupProfile: 'preprod',
  sessionFilePath: path.join(dataDir, 'manager-session.json'),
  secretStorePath: path.join(dataDir, 'manager-secrets.json'),
  defaultSecretPassphrase: 'midnight-dev-passphrase',
  rememberUnlockedSessionDefault: true,
  standalone: {
    indexer: 'http://127.0.0.1:8088/api/v3/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
    node: 'http://127.0.0.1:9944',
    proofServer: 'http://127.0.0.1:6300',
  },
  preprod: {
    indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
  },
});

describe('DidManagerService', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), 'did-manager-service-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('registers dust before deploying a DID', async () => {
    const manager = new DidManagerService(createConfig(dataDir), pino({ enabled: false }));

    const wallet = { stop: vi.fn() };
    const unshieldedKeystore = { key: 'keystore' };
    const providers = { id: 'providers' };
    const secretStore = { id: 'secret-store' };
    const privateState = { secretKey: new Uint8Array(32) };
    const deployedContract = {
      deployTxData: {
        public: {
          contractAddress: 'f'.repeat(64),
        },
      },
    };

    (manager as any).unlocked = true;
    (manager as any).walletCtx = {
      wallet,
      unshieldedKeystore,
      shieldedSecretKeys: {} as never,
      dustSecretKey: {} as never,
    };
    (manager as any).providers = providers;
    (manager as any).secretStore = secretStore;
    (manager as any).sessionLoaded = true;
    (manager as any).session = {
      version: 1,
      rememberUnlockedSession: true,
      lastProfile: 'preprod',
      profiles: {
        preprod: {
          seed: 'a'.repeat(64),
          unshieldedAddress: 'mn_addr_preprod1test',
          contractAddresses: [],
          updatedAt: new Date().toISOString(),
        },
      },
    };

    vi.mocked(api.registerForDustGeneration).mockResolvedValue(undefined);
    vi.mocked(api.initPrivateState).mockResolvedValue(privateState as never);
    vi.mocked(api.createDID).mockResolvedValue(deployedContract as never);

    const result = await manager.deployDid();

    expect(api.registerForDustGeneration).toHaveBeenCalledWith(wallet, unshieldedKeystore);
    expect(api.initPrivateState).toHaveBeenCalledWith(providers);
    expect(api.createDID).toHaveBeenCalledWith(providers, privateState);
    expect(result).toEqual({ contractAddress: 'f'.repeat(64) });
  });
});
