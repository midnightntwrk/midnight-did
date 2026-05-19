import { Buffer } from 'node:buffer';

import canonicalize from 'canonicalize';

import type { PayloadType } from '../types.js';

export type NormalizedPayload = {
  type: PayloadType;
  bytes: Uint8Array;
  canonicalHex: string;
  canonicalText: string | null;
};

const encoder = new TextEncoder();

const decodeHex = (value: string): Uint8Array => {
  if (value.length === 0) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2 !== 0) {
    throw new Error('Bytes payload must be an even-length hexadecimal string');
  }
  return new Uint8Array(Buffer.from(value, 'hex'));
};

const normalizeJson = (value: string): string => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`JSON payload is invalid${detail}`);
  }

  const canonical = canonicalize(parsed);
  if (canonical === undefined) {
    throw new Error('JSON payload could not be canonicalized with RFC 8785');
  }
  return canonical;
};

export const normalizePayload = (
  type: PayloadType,
  payload: string,
): NormalizedPayload => {
  if (type === "bytes") {
    const bytes = decodeHex(payload);
    return {
      type,
      bytes,
      canonicalHex: Buffer.from(bytes).toString('hex'),
      canonicalText: null,
    };
  }

  if (type === 'string') {
    const bytes = encoder.encode(payload);
    return {
      type,
      bytes,
      canonicalHex: Buffer.from(bytes).toString('hex'),
      canonicalText: payload,
    };
  }

  const canonicalText = normalizeJson(payload);
  const bytes = encoder.encode(canonicalText);
  return {
    type,
    bytes,
    canonicalHex: Buffer.from(bytes).toString('hex'),
    canonicalText,
  };
};
