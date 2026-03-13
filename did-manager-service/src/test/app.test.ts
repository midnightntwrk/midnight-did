import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';

describe('did-manager-service app', () => {
  it('serves health and session status', async () => {
    const manager = {
      getSetupStatus: vi.fn().mockReturnValue({
        profile: 'standalone',
        faucetUrl: null,
        endpoints: {
          node: 'http://127.0.0.1:9944',
          indexer: 'http://127.0.0.1:8088/api/v3/graphql',
          proofServer: 'http://127.0.0.1:6300',
        },
      }),
      listProfiles: vi.fn().mockResolvedValue({
        profile: 'standalone',
        activeProfileName: 'default',
        availableProfileNames: ['default'],
      }),
      selectProfile: vi.fn(),
      getSessionStatus: vi.fn().mockResolvedValue({
        unlocked: false,
        profile: 'standalone',
        profileName: 'default',
        rememberUnlockedSession: true,
        contractAddress: null,
        knownContractAddresses: [],
        seedAvailable: false,
        unshieldedAddress: null,
        faucetUrl: null,
      }),
      prepareFunding: vi.fn().mockResolvedValue({ unshieldedAddress: 'mn_test1...', faucetUrl: null }),
      unlock: vi.fn(),
      lock: vi.fn(),
      updatePreferences: vi.fn(),
      deployDid: vi.fn(),
      joinDid: vi.fn(),
      getDidState: vi.fn(),
      getDidDocument: vi.fn(),
      deactivateDid: vi.fn(),
      listKeys: vi.fn(),
      generateKey: vi.fn(),
      importKey: vi.fn(),
      deleteKey: vi.fn(),
      addVerificationMethod: vi.fn(),
      updateVerificationMethod: vi.fn(),
      removeVerificationMethod: vi.fn(),
      addRelation: vi.fn(),
      removeRelation: vi.fn(),
      addService: vi.fn(),
      updateService: vi.fn(),
      removeService: vi.fn(),
      addAlsoKnownAs: vi.fn(),
      removeAlsoKnownAs: vi.fn(),
    } as any;

    const app = await createApp(manager);

    const root = await app.inject({ method: 'GET', url: '/' });
    expect(root.statusCode).toBe(302);
    expect(root.headers.location).toBe('/wallet');

    const wallet = await app.inject({ method: 'GET', url: '/wallet' });
    expect(wallet.statusCode).toBe(200);

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);

    const setup = await app.inject({ method: 'GET', url: '/api/setup' });
    expect(setup.statusCode).toBe(200);
    expect(setup.json()).toEqual({
      ok: true,
      data: {
        profile: 'standalone',
        faucetUrl: null,
        endpoints: {
          node: 'http://127.0.0.1:9944',
          indexer: 'http://127.0.0.1:8088/api/v3/graphql',
          proofServer: 'http://127.0.0.1:6300',
        },
      },
    });

    const session = await app.inject({ method: 'GET', url: '/api/session' });
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({
      ok: true,
      data: {
        unlocked: false,
        profile: 'standalone',
        profileName: 'default',
        rememberUnlockedSession: true,
        contractAddress: null,
        knownContractAddresses: [],
        seedAvailable: false,
        unshieldedAddress: null,
        faucetUrl: null,
      },
    });

    await app.close();
  });
});
