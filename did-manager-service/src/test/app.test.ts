import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';

describe('did-manager-service app', () => {
  it('serves health and session status', async () => {
    const defaultSessionStatus = {
      unlocked: false,
      profile: 'standalone',
      profileName: 'default',
      rememberUnlockedSession: true,
      contractAddress: null,
      knownContractAddresses: [],
      seedAvailable: false,
      fundingPrepared: false,
      unshieldedAddress: null,
      faucetUrl: null,
      walletBalances: {
        night: null,
        dust: null,
      },
      connection: {
        phase: 'locked',
        reusedPersistedState: false,
        walletStateKey: null,
        lastError: null,
      },
      did: {
        phase: 'none',
        lastError: null,
      },
    } as const;
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
      listStoredContracts: vi.fn().mockResolvedValue([
        {
          address: 'a'.repeat(64),
          selected: false,
          available: true,
          deactivated: false,
          version: 1,
          operationCount: 1,
          message: null,
        },
        {
          address: 'b'.repeat(64),
          selected: false,
          available: false,
          deactivated: null,
          version: null,
          operationCount: null,
          message: 'Missing',
        },
      ]),
      selectProfile: vi.fn(),
      getSessionStatus: vi.fn().mockResolvedValue(defaultSessionStatus),
      prepareFunding: vi.fn().mockResolvedValue({ unshieldedAddress: 'mn_test1...', faucetUrl: null }),
      unlock: vi.fn(),
      lock: vi.fn(),
      closeSession: vi.fn().mockResolvedValue(defaultSessionStatus),
      updatePreferences: vi.fn(),
      signPayload: vi.fn().mockResolvedValue({
        did: `did:midnight:preprod:${'a'.repeat(64)}`,
        verificationMethodId: `did:midnight:preprod:${'a'.repeat(64)}#key-1`,
        keyRef: 'key-ref-1',
        algorithm: { kty: 'OKP', crv: 'Ed25519' },
        payloadType: 'string',
        canonicalText: 'hello midnight',
        canonicalHex: '68656c6c6f206d69646e69676874',
        canonicalPayloadBase64Url: 'aGVsbG8gbWlkbmlnaHQ',
        signatureBase64Url: 'c2ln',
        signatureFormat: 'ed25519-raw',
        publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'abc' },
      }),
      verifyPayload: vi.fn().mockResolvedValue({
        verified: true,
        source: 'didDocument',
        did: `did:midnight:preprod:${'a'.repeat(64)}`,
        verificationMethodId: `did:midnight:preprod:${'a'.repeat(64)}#key-1`,
        algorithm: { kty: 'OKP', crv: 'Ed25519' },
        payloadType: 'string',
        canonicalText: 'hello midnight',
        canonicalHex: '68656c6c6f206d69646e69676874',
        canonicalPayloadBase64Url: 'aGVsbG8gbWlkbmlnaHQ',
        signatureBase64Url: 'c2ln',
        signatureFormat: 'ed25519-raw',
        publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'abc' },
      }),
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
    const secretStorage = await app.inject({ method: 'GET', url: '/secret-storage' });
    expect(secretStorage.statusCode).toBe(200);
    const signatures = await app.inject({ method: 'GET', url: '/signatures' });
    expect(signatures.statusCode).toBe(200);
    expect(signatures.body).toContain('Sign & Verify');
    const signed = await app.inject({
      method: 'POST',
      url: '/api/signatures/sign',
      payload: {
        keyRef: 'key-ref-1',
        payloadType: 'string',
        payload: 'hello midnight',
      },
    });
    expect(signed.statusCode).toBe(200);
    expect(signed.json()).toEqual({
      ok: true,
      data: {
        did: `did:midnight:preprod:${'a'.repeat(64)}`,
        verificationMethodId: `did:midnight:preprod:${'a'.repeat(64)}#key-1`,
        keyRef: 'key-ref-1',
        algorithm: { kty: 'OKP', crv: 'Ed25519' },
        payloadType: 'string',
        canonicalText: 'hello midnight',
        canonicalHex: '68656c6c6f206d69646e69676874',
        canonicalPayloadBase64Url: 'aGVsbG8gbWlkbmlnaHQ',
        signatureBase64Url: 'c2ln',
        signatureFormat: 'ed25519-raw',
        publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'abc' },
      },
    });
    const verified = await app.inject({
      method: 'POST',
      url: '/api/signatures/verify',
      payload: {
        payloadType: 'string',
        payload: 'hello midnight',
        signatureBase64Url: 'c2ln',
        verificationMethodId: `did:midnight:preprod:${'a'.repeat(64)}#key-1`,
      },
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toEqual({
      ok: true,
      data: {
        verified: true,
        source: 'didDocument',
        did: `did:midnight:preprod:${'a'.repeat(64)}`,
        verificationMethodId: `did:midnight:preprod:${'a'.repeat(64)}#key-1`,
        algorithm: { kty: 'OKP', crv: 'Ed25519' },
        payloadType: 'string',
        canonicalText: 'hello midnight',
        canonicalHex: '68656c6c6f206d69646e69676874',
        canonicalPayloadBase64Url: 'aGVsbG8gbWlkbmlnaHQ',
        signatureBase64Url: 'c2ln',
        signatureFormat: 'ed25519-raw',
        publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'abc' },
      },
    });

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
      data: defaultSessionStatus,
    });

    const close = await app.inject({ method: 'POST', url: '/api/session/close' });
    expect(close.statusCode).toBe(200);
    expect(close.json()).toEqual({ ok: true, data: defaultSessionStatus });
    expect(manager.closeSession).toHaveBeenCalledTimes(1);

    const contracts = await app.inject({ method: 'GET', url: '/api/contracts' });
    expect(contracts.statusCode).toBe(200);
    expect(contracts.json()).toEqual({
      ok: true,
      data: [
        {
          address: 'a'.repeat(64),
          selected: false,
          available: true,
          deactivated: false,
          version: 1,
          operationCount: 1,
          message: null,
        },
        {
          address: 'b'.repeat(64),
          selected: false,
          available: false,
          deactivated: null,
          version: null,
          operationCount: null,
          message: 'Missing',
        },
      ],
    });

    const operations = await app.inject({ method: 'GET', url: '/api/operations' });
    expect(operations.statusCode).toBe(200);
    expect(operations.json()).toEqual({
      ok: true,
      data: [],
    });

    await app.close();
  });

  it('maps invalid seed input to a structured 400 response', async () => {
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
      listStoredContracts: vi.fn().mockResolvedValue([]),
      getSessionStatus: vi.fn(),
      prepareFunding: vi.fn().mockRejectedValue(new Error('Seed must contain only hexadecimal characters')),
    } as any;

    const app = await createApp(manager);
    const response = await app.inject({
      method: 'POST',
      url: '/api/session/prepare-funding',
      payload: { seedMode: 'provided', seed: 'zz' },
    });

    expect(response.statusCode).toBe(202);
    const operation = response.json();
    expect(operation.ok).toBe(true);
    expect(operation.data.type).toBe('prepareFunding');
    expect(['running', 'failed']).toContain(operation.data.status);

    const status = await app.inject({
      method: 'GET',
      url: `/api/operations/${operation.data.id}`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({
      ok: true,
      data: {
        id: operation.data.id,
        type: 'prepareFunding',
        status: 'failed',
        submittedAt: expect.any(String),
        completedAt: expect.any(String),
        result: null,
        error: {
          message: 'Seed must contain only hexadecimal characters',
          errorCode: 'invalidSeed',
          statusCode: 400,
        },
      },
    });

    await app.close();
  });

  it('marks unlock operation as failed when session is closed during unlock', async () => {
    const manager = {
      unlock: vi.fn().mockResolvedValue({
        status: {
          unlocked: false,
          connection: { phase: 'starting' },
        },
      }),
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
        walletBalances: { night: null, dust: null },
        connection: {
          phase: 'locked',
          reusedPersistedState: false,
          walletStateKey: null,
          lastError: null,
        },
        did: {
          phase: 'none',
          lastError: null,
        },
      }),
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
      listStoredContracts: vi.fn().mockResolvedValue([]),
      prepareFunding: vi.fn(),
      lock: vi.fn(),
      closeSession: vi.fn(),
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
      selectProfile: vi.fn(),
    } as any;

    const app = await createApp(manager);
    const unlock = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { seedMode: 'generated' },
    });
    expect(unlock.statusCode).toBe(202);
    const operationId = unlock.json().data.id as string;

    let payload: any;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const status = await app.inject({
        method: 'GET',
        url: `/api/operations/${operationId}`,
      });
      expect(status.statusCode).toBe(200);
      payload = status.json();
      if (payload.data.status === 'failed') break;
      await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
    }
    expect(payload).toEqual({
      ok: true,
      data: {
        id: operationId,
        type: 'unlock',
        status: 'failed',
        submittedAt: expect.any(String),
        completedAt: expect.any(String),
        result: null,
        error: {
          message: 'Session is closed. Start session was cancelled.',
          errorCode: 'sessionLocked',
          statusCode: 409,
        },
      },
    });
    await app.close();
  });
});
