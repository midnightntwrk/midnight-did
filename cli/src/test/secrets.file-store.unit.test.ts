import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { maxField } from '@midnight-ntwrk/ledger-v7';
import { DIDContract } from '@midnight-ntwrk/midnight-did-contract';
import { FileSecretStore, normalizePublicForLedger } from '@midnight-ntwrk/midnight-did-secret-storage';
import { afterEach, describe, expect, it } from 'vitest';

describe('FileSecretStore', () => {
  const ledgerMaxField = maxField();
  const JUBJUB_FIELD_MODULUS = 6554484396890773809930967563523245729705921265872317281365359162392183254199n;
  const tmpDirs: string[] = [];

  const createStore = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'midnight-did-secrets-'));
    tmpDirs.push(dir);
    const location = path.join(dir, 'secrets.json');
    const store = new FileSecretStore();
    await store.initialize({ location, passphrase: 'test-passphrase' });
    return store;
  };

  afterEach(async () => {
    await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tmpDirs.length = 0;
  });

  const base64urlToBuffer = (value: string): Buffer => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4;
    const padded = pad === 0 ? normalized : `${normalized}${'='.repeat(4 - pad)}`;
    return Buffer.from(padded, 'base64');
  };

  const base64urlToBigint = (value: string): bigint => {
    const bytes = base64urlToBuffer(value);
    return bytes.length === 0 ? 0n : BigInt(`0x${bytes.toString('hex')}`);
  };

  const bigintTo32Be = (value: bigint): Buffer => {
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
  };

  const hashToJubjubScalar = (input: Uint8Array): bigint => {
    const digest = createHash('sha256').update(input).digest();
    const scalar = BigInt(`0x${digest.toString('hex')}`);
    return scalar % JUBJUB_FIELD_MODULUS;
  };

  const computeCompactChallenge = (
    r: { x: bigint; y: bigint },
    pk: { x: bigint; y: bigint },
    payload: Uint8Array,
  ): bigint => {
    const challengeInput = Buffer.concat([
      bigintTo32Be(r.x),
      bigintTo32Be(r.y),
      bigintTo32Be(pk.x),
      bigintTo32Be(pk.y),
      Buffer.from(payload),
    ]);
    return hashToJubjubScalar(challengeInput);
  };

  const decodeCompactJubjubSignature = (signature: Uint8Array): { r: { x: bigint; y: bigint }; s: bigint } => {
    if (signature.length !== 96) {
      throw new Error(`Expected 96-byte Jubjub signature, got ${signature.length}`);
    }
    return {
      r: {
        x: BigInt(`0x${Buffer.from(signature.subarray(0, 32)).toString('hex')}`),
        y: BigInt(`0x${Buffer.from(signature.subarray(32, 64)).toString('hex')}`),
      },
      s: BigInt(`0x${Buffer.from(signature.subarray(64, 96)).toString('hex')}`),
    };
  };

  const assertSignVerifyRoundtrip = async (params: {
    id: string;
    kty: 'OKP' | 'EC';
    crv: 'Ed25519' | 'P-256' | 'Jubjub';
    payload: string;
  }) => {
    const store = await createStore();
    const generated = await store.generateKey({
      id: params.id,
      kty: params.kty,
      crv: params.crv,
    });
    const payload = Buffer.from(params.payload);

    expect(generated.keyRef).toBeTruthy();
    expect(generated.publicJwk.kty).toBe(params.kty);
    expect(generated.publicJwk.crv).toBe(params.crv);
    expect(generated.publicJwk.x).toBeTruthy();
    if (params.kty === 'EC') {
      expect(generated.publicJwk.y).toBeDefined();
    }
    const ledgerKey = normalizePublicForLedger(generated.publicJwk);
    expect(ledgerKey.x).toBeLessThanOrEqual(ledgerMaxField);
    expect(ledgerKey.y).toBeLessThanOrEqual(ledgerMaxField);

    const signed = await store.sign({ keyRef: generated.keyRef, payload });
    expect(signed.signature.length).toBeGreaterThan(0);

    const valid = await store.verify({
      keyRef: generated.keyRef,
      payload,
      signature: signed.signature,
    });
    expect(valid).toBe(true);

    const invalid = await store.verify({
      keyRef: generated.keyRef,
      payload: Buffer.from(`${params.payload}-tampered`),
      signature: signed.signature,
    });
    expect(invalid).toBe(false);
  };

  const assertHdSignVerifyRoundtrip = async (params: {
    id: string;
    seedHex: string;
    kty: 'OKP' | 'EC';
    crv: 'Ed25519' | 'P-256' | 'Jubjub';
    account: number;
    index: number;
    payload: string;
  }) => {
    const store = await createStore();

    const first = await store.deriveKeyFromSeed({
      id: `${params.id}-1`,
      seedHex: params.seedHex,
      kty: params.kty,
      crv: params.crv,
      account: params.account,
      index: params.index,
    });

    const second = await store.deriveKeyFromSeed({
      id: `${params.id}-2`,
      seedHex: params.seedHex,
      kty: params.kty,
      crv: params.crv,
      account: params.account,
      index: params.index,
    });

    expect(first.publicJwk).toEqual(second.publicJwk);
    const ledgerKey = normalizePublicForLedger(first.publicJwk);
    expect(ledgerKey.x).toBeLessThanOrEqual(ledgerMaxField);
    expect(ledgerKey.y).toBeLessThanOrEqual(ledgerMaxField);

    const differentPath = await store.deriveKeyFromSeed({
      id: `${params.id}-3`,
      seedHex: params.seedHex,
      kty: params.kty,
      crv: params.crv,
      account: params.account,
      index: params.index + 1,
    });

    expect(differentPath.publicJwk.x).not.toBe(first.publicJwk.x);

    const payload = Buffer.from(params.payload);
    const signed = await store.sign({ keyRef: first.keyRef, payload });
    const valid = await store.verify({
      keyRef: first.keyRef,
      payload,
      signature: signed.signature,
    });
    expect(valid).toBe(true);

    const invalid = await store.verify({
      keyRef: first.keyRef,
      payload: Buffer.from(`${params.payload}-tampered`),
      signature: signed.signature,
    });
    expect(invalid).toBe(false);
  };

  it('generates, lists and deletes keys', async () => {
    const store = await createStore();
    const generated = await store.generateKey({ id: 'auth-main', kty: 'OKP', crv: 'Ed25519' });

    expect(generated.keyRef).toBeTruthy();
    expect(() => normalizePublicForLedger(generated.publicJwk)).not.toThrow();
    const listed = await store.listKeys();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe('auth-main');

    await store.deleteKey(generated.keyRef);
    const afterDelete = await store.listKeys();
    expect(afterDelete).toHaveLength(0);
  });

  it('supports Ed25519 key generation, sign and verify', async () => {
    await assertSignVerifyRoundtrip({
      id: 'sign-ed',
      kty: 'OKP',
      crv: 'Ed25519',
      payload: 'hello-ed25519',
    });
  });

  it('supports P-256 key generation, sign and verify', async () => {
    await assertSignVerifyRoundtrip({
      id: 'sign-p256',
      kty: 'EC',
      crv: 'P-256',
      payload: 'hello-p256',
    });
  });

  it('supports Jubjub key generation, sign and verify', async () => {
    await assertSignVerifyRoundtrip({
      id: 'sign-jubjub',
      kty: 'EC',
      crv: 'Jubjub',
      payload: 'hello-jubjub',
    });
  });

  it('supports HD derivation for Ed25519: deterministic path + sign/verify', async () => {
    await assertHdSignVerifyRoundtrip({
      id: 'hd-ed',
      seedHex: '11'.repeat(32),
      kty: 'OKP',
      crv: 'Ed25519',
      account: 0,
      index: 0,
      payload: 'hd-ed25519',
    });
  });

  it('supports HD derivation for P-256: deterministic path + sign/verify', async () => {
    await assertHdSignVerifyRoundtrip({
      id: 'hd-p256',
      seedHex: '22'.repeat(32),
      kty: 'EC',
      crv: 'P-256',
      account: 1,
      index: 7,
      payload: 'hd-p256',
    });
  });

  it('supports HD derivation for Jubjub: deterministic path + sign/verify', async () => {
    await assertHdSignVerifyRoundtrip({
      id: 'hd-jubjub',
      seedHex: '33'.repeat(32),
      kty: 'EC',
      crv: 'Jubjub',
      account: 2,
      index: 3,
      payload: 'hd-jubjub',
    });
  });

  it('keeps domain and contract Jubjub verification compatible', async () => {
    const store = await createStore();
    const generated = await store.generateKey({
      id: 'compat-jubjub',
      kty: 'EC',
      crv: 'Jubjub',
    });
    const payload = Buffer.from('compat-jubjub-message');

    const signed = await store.sign({ keyRef: generated.keyRef, payload });
    const domainValid = await store.verify({
      keyRef: generated.keyRef,
      payload,
      signature: signed.signature,
    });
    expect(domainValid).toBe(true);

    const publicKey = {
      x: base64urlToBigint(generated.publicJwk.x),
      y: base64urlToBigint(generated.publicJwk.y ?? ''),
    };
    const decoded = decodeCompactJubjubSignature(signed.signature);
    const challenge = computeCompactChallenge(decoded.r, publicKey, payload);

    const contractValid = DIDContract.pureCircuits.verifyJubjubSignature(publicKey, decoded, challenge);
    expect(contractValid).toBe(true);
  });
});
