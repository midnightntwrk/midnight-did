import { Buffer } from 'node:buffer';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { MidnightDIDDocument } from '@midnight-ntwrk/midnight-did';
import { FileSecretStore, type PublicJwk } from '@midnight-ntwrk/midnight-did-secret-storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { signPayload, verifyPayload } from '../signatures/signature-service.js';

const did = `did:midnight:preprod:${'a'.repeat(64)}` as MidnightDIDDocument['id'];

const makeDidDocument = (
  publicJwk: PublicJwk,
  verificationMethodId = `${did}#key-1`,
): MidnightDIDDocument =>
  ({
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3c.github.io/vc-jws-2020/contexts/v1',
    ],
    id: did,
    controller: did,
    verificationMethod: [
      {
        id: verificationMethodId,
        type: 'JsonWebKey',
        controller: did,
        publicKeyJwk: publicJwk,
      },
    ],
  }) as unknown as MidnightDIDDocument;

describe('signature-service', () => {
  let tmpDir: string;
  let secretStore: FileSecretStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'did-signature-service-'));
    secretStore = new FileSecretStore();
    await secretStore.initialize({
      location: path.join(tmpDir, 'secrets.json'),
      passphrase: 'test-passphrase',
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const curves = [
    { id: 'ed-key', kty: 'OKP' as const, crv: 'Ed25519' as const, format: 'ed25519-raw' as const },
    { id: 'jub-key', kty: 'EC' as const, crv: 'Jubjub' as const, format: 'jubjub-raw-96' as const },
    { id: 'p256-key', kty: 'EC' as const, crv: 'P-256' as const, format: 'ecdsa-der' as const },
  ];

  for (const curve of curves) {
    it(`signs and verifies a JSON payload for ${curve.crv}`, async () => {
      const generated = await secretStore.generateKey({
        id: curve.id,
        kty: curve.kty,
        crv: curve.crv,
        did,
      });
      const didDocument = makeDidDocument(generated.publicJwk);

      const signed = await signPayload({
        secretStore,
        didDocument,
        request: {
          keyRef: generated.keyRef,
          payloadType: 'json',
          payload: '{"z":1,"a":2}',
        },
      });

      expect(signed.did).toBe(did);
      expect(signed.verificationMethodId).toBe(`${did}#key-1`);
      expect(signed.signatureFormat).toBe(curve.format);
      expect(signed.canonicalText).toBe('{"a":2,"z":1}');
      expect(signed.algorithm).toEqual({ kty: curve.kty, crv: curve.crv });

      const verified = await verifyPayload({
        request: {
          payloadType: 'json',
          payload: '{"a":2,"z":1}',
          signatureBase64Url: signed.signatureBase64Url,
          publicJwk: generated.publicJwk,
        },
      });

      expect(verified.verified).toBe(true);
      expect(verified.source).toBe('publicJwk');
      expect(verified.signatureFormat).toBe(curve.format);
    });
  }

  it('verifies with a DID-resolved public key', async () => {
    const generated = await secretStore.generateKey({
      id: 'resolver-key',
      kty: 'OKP',
      crv: 'Ed25519',
      did,
    });
    const signed = await signPayload({
      secretStore,
      didDocument: makeDidDocument(generated.publicJwk, `${did}#auth-1`),
      request: {
        keyRef: generated.keyRef,
        payloadType: 'string',
        payload: 'hello midnight',
      },
    });

    const verified = await verifyPayload({
      request: {
        payloadType: 'string',
        payload: 'hello midnight',
        signatureBase64Url: signed.signatureBase64Url,
        verificationMethodId: `${did}#auth-1`,
      },
      resolveVerificationMethod: async (verificationMethodId) => ({
        did,
        verificationMethodId,
        publicJwk: generated.publicJwk,
      }),
    });

    expect(verified.verified).toBe(true);
    expect(verified.source).toBe('didDocument');
    expect(verified.verificationMethodId).toBe(`${did}#auth-1`);
  });

  it('rejects signing when the key is not associated with the active DID', async () => {
    const generated = await secretStore.generateKey({
      id: 'wrong-did',
      kty: 'OKP',
      crv: 'Ed25519',
      did: `did:midnight:preprod:${'b'.repeat(64)}`,
    });

    await expect(
      signPayload({
        secretStore,
        didDocument: makeDidDocument(generated.publicJwk),
        request: {
          keyRef: generated.keyRef,
          payloadType: 'string',
          payload: 'hello',
        },
      }),
    ).rejects.toThrow('Selected key is associated with');
  });

  it('allows signing when the key has no stored DID but is published in the active DID document', async () => {
    const generated = await secretStore.generateKey({
      id: 'no-stored-did',
      kty: 'OKP',
      crv: 'Ed25519',
    });

    const signed = await signPayload({
      secretStore,
      didDocument: makeDidDocument(generated.publicJwk, `${did}#auth-1`),
      request: {
        keyRef: generated.keyRef,
        payloadType: 'string',
        payload: 'hello midnight',
      },
    });

    expect(signed.verificationMethodId).toBe(`${did}#auth-1`);
    expect(signed.keyRef).toBe(generated.keyRef);
  });

  it('rejects verification when multiple key sources are provided', async () => {
    const generated = await secretStore.generateKey({
      id: 'dup-source',
      kty: 'OKP',
      crv: 'Ed25519',
    });

    await expect(
      verifyPayload({
        secretStore,
        request: {
          payloadType: 'bytes',
          payload: Buffer.from('hello').toString('hex'),
          signatureBase64Url: Buffer.from('sig').toString('base64url'),
          keyRef: generated.keyRef,
          publicJwk: generated.publicJwk,
        },
      }),
    ).rejects.toThrow(
      'Verification requires exactly one source: keyRef, publicJwk, or verificationMethodId.',
    );
  });
});
