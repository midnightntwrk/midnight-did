import { Buffer } from 'node:buffer';

import type { MidnightDIDDocument } from '@midnight-ntwrk/midnight-did';
import type {
  FileSecretStore,
  PublicJwk,
  StoredKeyMeta,
} from '@midnight-ntwrk/midnight-did-secret-storage';
import { verifyWithPublicJwk } from '@midnight-ntwrk/midnight-did-secret-storage';

import type {
  SignatureFormat,
  SignPayloadRequest,
  SignPayloadResponse,
  VerificationSource,
  VerifyPayloadRequest,
  VerifyPayloadResponse,
} from '../types.js';
import { normalizePayload } from './payload-normalization.js';

type ResolvedVerificationMethod = {
  did: string;
  verificationMethodId: string;
  publicJwk: PublicJwk;
};

type ResolveVerificationMethod = (
  verificationMethodId: string,
) => Promise<ResolvedVerificationMethod>;

const toBase64Url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64url');

const fromBase64Url = (value: string): Uint8Array =>
  new Uint8Array(Buffer.from(value, 'base64url'));

const samePublicJwk = (left: PublicJwk, right: PublicJwk): boolean =>
  left.kty === right.kty &&
  left.crv === right.crv &&
  left.x === right.x &&
  (left.y ?? null) === (right.y ?? null);

const signatureFormatFor = (publicJwk: Pick<PublicJwk, 'crv'>): SignatureFormat => {
  if (publicJwk.crv === 'Ed25519') return 'ed25519-raw';
  if (publicJwk.crv === 'Jubjub') return 'jubjub-raw-96';
  return 'ecdsa-der';
};

const findStoredKey = async (
  secretStore: FileSecretStore,
  keyRef: string,
): Promise<StoredKeyMeta> => {
  const key = (await secretStore.listKeys()).find((entry) => entry.keyRef === keyRef);
  if (key === undefined) {
    throw new Error(`Key not found in secret storage: ${keyRef}`);
  }
  return key;
};

const findVerificationMethodForPublicKey = (
  didDocument: MidnightDIDDocument,
  publicJwk: PublicJwk,
): string | null => {
  const method = didDocument.verificationMethod?.find((entry) =>
    samePublicJwk(entry.publicKeyJwk as PublicJwk, publicJwk),
  );
  return method?.id ?? null;
};

export const signPayload = async (input: {
  secretStore: FileSecretStore;
  didDocument: MidnightDIDDocument;
  request: SignPayloadRequest;
}): Promise<SignPayloadResponse> => {
  const { secretStore, didDocument, request } = input;
  const key = await findStoredKey(secretStore, request.keyRef);
  if (key.did !== undefined && key.did !== null && key.did !== didDocument.id) {
    throw new Error(
      `Selected key is associated with ${key.did}, not the active DID ${didDocument.id}.`,
    );
  }

  const publicJwk = await secretStore.getPublicKey(request.keyRef);
  const verificationMethodId = findVerificationMethodForPublicKey(
    didDocument,
    publicJwk,
  );
  if (verificationMethodId === null) {
    throw new Error(
      'Selected key is not published in the active DID document as a verification method.',
    );
  }

  const normalized = normalizePayload(request.payloadType, request.payload);
  const { signature } = await secretStore.sign({
    keyRef: request.keyRef,
    payload: normalized.bytes,
  });

  return {
    did: didDocument.id,
    verificationMethodId,
    keyRef: request.keyRef,
    algorithm: {
      kty: publicJwk.kty,
      crv: publicJwk.crv,
    },
    payloadType: request.payloadType,
    canonicalText: normalized.canonicalText,
    canonicalHex: normalized.canonicalHex,
    canonicalPayloadBase64Url: toBase64Url(normalized.bytes),
    signatureBase64Url: toBase64Url(signature),
    signatureFormat: signatureFormatFor(publicJwk),
    publicJwk,
  };
};

export const verifyPayload = async (input: {
  secretStore?: FileSecretStore;
  request: VerifyPayloadRequest;
  resolveVerificationMethod?: ResolveVerificationMethod;
}): Promise<VerifyPayloadResponse> => {
  const { secretStore, request, resolveVerificationMethod } = input;
  const normalized = normalizePayload(request.payloadType, request.payload);
  const signatureBytes = fromBase64Url(request.signatureBase64Url);
  const sourceCount = [
    request.keyRef !== undefined,
    request.publicJwk !== undefined,
    request.verificationMethodId !== undefined,
  ].filter(Boolean).length;
  if (sourceCount !== 1) {
    throw new Error(
      'Verification requires exactly one source: keyRef, publicJwk, or verificationMethodId.',
    );
  }

  let source: VerificationSource;
  let did: string | null = null;
  let verificationMethodId: string | null = null;
  let publicJwk: PublicJwk;

  if (request.keyRef !== undefined) {
    if (secretStore === undefined) {
      throw new Error('Local key verification requires an active secret store session.');
    }
    publicJwk = await secretStore.getPublicKey(request.keyRef);
    source = 'localKey';
  } else if (request.publicJwk !== undefined) {
    publicJwk = request.publicJwk;
    source = 'publicJwk';
  } else {
    if (resolveVerificationMethod === undefined) {
      throw new Error('DID verification requires a verification method resolver.');
    }
    const resolved = await resolveVerificationMethod(
      request.verificationMethodId as string,
    );
    did = resolved.did;
    verificationMethodId = resolved.verificationMethodId;
    publicJwk = resolved.publicJwk;
    source = 'didDocument';
  }

  const verified = await verifyWithPublicJwk(
    publicJwk,
    normalized.bytes,
    signatureBytes,
  );

  return {
    verified,
    source,
    did,
    verificationMethodId,
    algorithm: {
      kty: publicJwk.kty,
      crv: publicJwk.crv,
    },
    payloadType: request.payloadType,
    canonicalText: normalized.canonicalText,
    canonicalHex: normalized.canonicalHex,
    canonicalPayloadBase64Url: toBase64Url(normalized.bytes),
    signatureBase64Url: request.signatureBase64Url,
    signatureFormat: signatureFormatFor(publicJwk),
    publicJwk,
  };
};
