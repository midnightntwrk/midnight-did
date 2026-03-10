import type { SecretStorage } from '@midnight-ntwrk/midnight-did-secret-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CliDidService } from '../cli-api';

vi.mock('../api', () => ({
  deploy: vi.fn(async () => ({ deployTxData: { public: { contractAddress: 'a'.repeat(64) } } })),
  joinContract: vi.fn(async (_providers: unknown, contractAddress: string) => ({
    deployTxData: { public: { contractAddress } },
  })),
  getDIDLedgerState: vi.fn(async () => ({
    active: true,
    deactivated: false,
    verificationMethods: { isEmpty: () => false },
    authenticationRelation: { isEmpty: () => true },
    assertionMethodRelation: { isEmpty: () => true },
    keyAgreementRelation: { isEmpty: () => true },
    capabilityInvocationRelation: { isEmpty: () => true },
    capabilityDelegationRelation: { isEmpty: () => true },
    services: { isEmpty: () => true },
    alsoKnownAs: { isEmpty: () => true },
  })),
  addVerificationMethod: vi.fn(async () => ({ ok: true })),
  updateVerificationMethod: vi.fn(async () => ({ ok: true })),
  removeVerificationMethod: vi.fn(async () => ({ ok: true })),
  addVerificationMethodRelation: vi.fn(async () => ({ ok: true })),
  removeVerificationMethodRelation: vi.fn(async () => ({ ok: true })),
  addService: vi.fn(async () => ({ ok: true })),
  updateService: vi.fn(async () => ({ ok: true })),
  removeService: vi.fn(async () => ({ ok: true })),
  addAlsoKnownAs: vi.fn(async () => ({ ok: true })),
  removeAlsoKnownAs: vi.fn(async () => ({ ok: true })),
  deactivateDID: vi.fn(async () => ({ ok: true })),
}));

const makeStorage = (): SecretStorage => ({
  initialize: vi.fn(async () => undefined),
  listKeys: vi.fn(async () => []),
  generateKey: vi.fn(async () => ({
    keyRef: 'key-ref-1',
    publicJwk: { kty: 'OKP' as const, crv: 'Ed25519' as const, x: 'AQ' },
  })),
  deriveKeyFromSeed: vi.fn(async () => ({
    keyRef: 'key-ref-hd-1',
    publicJwk: { kty: 'OKP' as const, crv: 'Ed25519' as const, x: 'AQ' },
  })),
  importKey: vi.fn(async () => ({
    keyRef: 'key-ref-2',
    publicJwk: { kty: 'OKP' as const, crv: 'Ed25519' as const, x: 'AQ' },
  })),
  getPublicKey: vi.fn(async () => ({ kty: 'OKP' as const, crv: 'Ed25519' as const, x: 'AQ' })),
  sign: vi.fn(async () => ({ signature: new Uint8Array([1, 2, 3]), format: 'raw' as const })),
  verify: vi.fn(async () => true),
  deleteKey: vi.fn(async () => undefined),
});

describe('CliDidService', () => {
  let service: CliDidService;

  beforeEach(() => {
    service = new CliDidService({
      providers: {} as any,
      secretStorage: makeStorage(),
    });
  });

  it('deploys DID and returns next-state hints', async () => {
    const result = await service.deployDid();
    expect(result.status).toBe('ok');
    expect(result.data?.contractAddress).toBeTruthy();
    expect(result.hints.length).toBeGreaterThan(0);
  });

  it('supports key generation through storage', async () => {
    const generated = await service.generateKey({ id: 'auth', kty: 'OKP', crv: 'Ed25519' });
    expect(generated.keyRef).toBe('key-ref-1');
  });

  it('supports HD key derivation through storage', async () => {
    const generated = await service.deriveKeyFromSeed({
      id: 'auth-hd',
      seedHex: '11'.repeat(32),
      kty: 'OKP',
      crv: 'Ed25519',
      account: 0,
      index: 0,
    });
    expect(generated.keyRef).toBe('key-ref-hd-1');
  });

  it('signs and verifies payload', async () => {
    service.setDidContract({ deployTxData: { public: { contractAddress: 'a'.repeat(64) } } } as any);
    const signResult = await service.signPayload({ keyRef: 'key-ref-1', payload: Buffer.from('abc') });
    expect(signResult.status).toBe('ok');

    const verifyResult = await service.verifyPayload({
      keyRef: 'key-ref-1',
      payload: Buffer.from('abc'),
      signature: new Uint8Array([1, 2, 3]),
    });
    expect(verifyResult.data?.valid).toBe(true);
  });
});
