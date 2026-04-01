import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    buildWallet: vi.fn(),
    restoreWalletFromState: vi.fn(),
    waitForWalletSync: vi.fn(),
    waitForWalletFunds: vi.fn(),
    configureProviders: vi.fn(),
    getMidnightDIDLedgerState: vi.fn(),
    joinContract: vi.fn(),
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
  sessionIdleMs: 60_000,
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

    const walletCtx = {
      wallet,
      unshieldedKeystore,
      shieldedSecretKeys: {} as never,
      dustSecretKey: {} as never,
    } as any;
    (manager as any).runtime.attachReadySession({
      walletCtx,
      providers,
      secretStore,
      seedHash: 'aaaaaa',
      reusedPersistedState: false,
    });

    await mkdir(path.join(dataDir, 'profiles', 'preprod', 'default'), { recursive: true });
    await writeFile(
      path.join(dataDir, 'profiles', 'preprod', 'default', 'manager-session.json'),
      JSON.stringify({
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
      }, null, 2),
      'utf8',
    );

    vi.mocked(api.registerForDustGeneration).mockResolvedValue(undefined);
    vi.mocked(api.initPrivateState).mockResolvedValue(privateState as never);
    vi.mocked(api.createDID).mockResolvedValue(deployedContract as never);

    const result = await manager.deployDid();

    expect(api.registerForDustGeneration).toHaveBeenCalledWith(wallet, unshieldedKeystore);
    expect(api.initPrivateState).toHaveBeenCalledWith(providers);
    expect(api.createDID).toHaveBeenCalledWith(providers, privateState);
    expect(result).toEqual({ contractAddress: 'f'.repeat(64) });
  });

  it('migrates legacy session data only once and keeps new profiles isolated', async () => {
    const manager = new DidManagerService(createConfig(dataDir), pino({ enabled: false }));
    const legacySession = {
      version: 1,
      rememberUnlockedSession: true,
      lastProfile: 'preprod',
      profiles: {
        preprod: {
          seed: 'a'.repeat(64),
          unshieldedAddress: 'mn_addr_preprod1test',
          contractAddress: 'f'.repeat(64),
          contractAddresses: ['f'.repeat(64)],
          updatedAt: new Date().toISOString(),
        },
      },
    };

    await writeFile(
      path.join(dataDir, 'manager-session.json'),
      JSON.stringify(legacySession, null, 2),
      'utf8',
    );
    await writeFile(path.join(dataDir, 'manager-secrets.json'), '{"version":1}', 'utf8');

    const defaultStatus = await manager.getSessionStatus();
    expect(defaultStatus.profileName).toBe('default');
    expect(defaultStatus.seedAvailable).toBe(true);

    const isolatedStatus = await manager.selectProfile({ name: 'isolated' });
    expect(isolatedStatus.profileName).toBe('isolated');
    expect(isolatedStatus.seedAvailable).toBe(false);
    expect(isolatedStatus.knownContractAddresses).toEqual([]);

    const defaultProfileSession = JSON.parse(
      await readFile(
        path.join(dataDir, 'profiles', 'preprod', 'default', 'manager-session.json'),
        'utf8',
      ),
    );
    expect(defaultProfileSession.profiles.preprod.seed).toBe('a'.repeat(64));
  });

  it('keeps the wallet unlocked and leaves stored DID selection for an explicit join', async () => {
    const manager = new DidManagerService(createConfig(dataDir), pino({ enabled: false }));
    const walletCtx = {
      wallet: {
        stop: vi.fn().mockResolvedValue(undefined),
        state: () => ({
          subscribe: () => ({
            unsubscribe() {
              return undefined;
            },
          }),
        }),
      },
      unshieldedKeystore: { key: 'keystore' },
      shieldedSecretKeys: {} as never,
      dustSecretKey: {} as never,
      shieldedWallet: { serializeState: vi.fn().mockResolvedValue('shielded') },
      unshieldedWallet: { serializeState: vi.fn().mockResolvedValue('unshielded') },
      dustWallet: { serializeState: vi.fn().mockResolvedValue('dust') },
      unshieldedHistoryStorage: { serialize: vi.fn().mockReturnValue('history') },
    } as unknown as api.MidnightDIDWalletContext;

    const profileDir = path.join(dataDir, 'profiles', 'preprod', 'default');
    await mkdir(profileDir, { recursive: true });
    await writeFile(
      path.join(profileDir, 'manager-session.json'),
      JSON.stringify({
        version: 1,
        rememberUnlockedSession: true,
        lastProfile: 'preprod',
        profiles: {
          preprod: {
            seed: 'a'.repeat(64),
            unshieldedAddress: 'mn_addr_preprod1test',
            contractAddress: 'f'.repeat(64),
            contractAddresses: ['f'.repeat(64)],
            updatedAt: new Date().toISOString(),
          },
        },
      }, null, 2),
      'utf8',
    );

    vi.mocked(api.buildWallet).mockResolvedValue(walletCtx);
    vi.mocked(api.waitForWalletSync).mockResolvedValue({ isSynced: true } as never);
    vi.mocked(api.waitForWalletFunds).mockResolvedValue(1n);
    vi.mocked(api.configureProviders).mockResolvedValue({ id: 'providers' } as never);
    const accepted = await manager.unlock({ seedMode: 'reuse' });
    expect(accepted.status.connection.phase).toBe('starting');

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const status = await manager.getSessionStatus();
      if (status.connection.phase === 'ready') {
        expect(status.unlocked).toBe(true);
        expect(status.did.phase).toBe('stored');
        expect(status.did.lastError).toBeNull();
        expect(api.getMidnightDIDLedgerState).not.toHaveBeenCalled();
        expect(api.joinContract).not.toHaveBeenCalled();
        return;
      }
      await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
    }

    throw new Error('manager did not reach ready state');
  });
});
