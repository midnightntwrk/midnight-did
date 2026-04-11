const seedModes = ['reuse', 'provided', 'generated'] as const;
const keyTypes = ['OKP', 'EC'] as const;
const keyCurves = ['Ed25519', 'Jubjub', 'P-256'] as const;
const payloadTypes = ['bytes', 'string', 'json'] as const;
const relationTypes = [
  'Authentication',
  'AssertionMethod',
  'KeyAgreement',
  'CapabilityInvocation',
  'CapabilityDelegation',
] as const;

export const stringRequired = { type: 'string', minLength: 1 } as const;
export const keyRefParamSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['keyRef'],
  properties: { keyRef: stringRequired },
} as const;
export const methodIdParamSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['methodId'],
  properties: { methodId: stringRequired },
} as const;
export const serviceIdParamSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: stringRequired },
} as const;
export const serviceEndpointSchema = {
  anyOf: [
    { type: 'string', minLength: 1 },
    { type: 'object' },
    {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [{ type: 'string', minLength: 1 }, { type: 'object' }],
      },
    },
  ],
} as const;
export const publicJwkSchema = {
  type: 'object',
  additionalProperties: false,
  description: 'Public JWK used for detached signature verification.',
  required: ['kty', 'crv', 'x'],
  properties: {
    kty: { type: 'string', enum: keyTypes, description: 'JWK key type.' },
    crv: { type: 'string', enum: keyCurves, description: 'Supported Midnight-compatible curve.' },
    x: { ...stringRequired, description: 'Base64url-encoded x coordinate or public key bytes.' },
    y: { type: 'string', description: 'Base64url-encoded y coordinate for EC curves.' },
  },
  examples: [
    { kty: 'OKP', crv: 'Ed25519', x: '11qYAYLef1H1P4...' },
    { kty: 'EC', crv: 'P-256', x: 'f83OJ3D2xF4...', y: 'x_FEzRu9...' },
  ],
} as const;

export const routeSchemas = {
  operationIdParams: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: stringRequired },
  },
  selectProfileBody: {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: { name: stringRequired },
  },
  unlockBody: {
    type: 'object',
    additionalProperties: false,
    required: ['seedMode'],
    properties: {
      seedMode: { type: 'string', enum: seedModes },
      seed: { type: 'string' },
      passphrase: { type: 'string' },
      rememberUnlockedSession: { type: 'boolean' },
    },
  },
  prepareFundingBody: {
    type: 'object',
    additionalProperties: false,
    required: ['seedMode'],
    properties: {
      seedMode: { type: 'string', enum: seedModes },
      seed: { type: 'string' },
    },
  },
  preferencesBody: {
    type: 'object',
    additionalProperties: false,
    required: ['rememberUnlockedSession'],
    properties: { rememberUnlockedSession: { type: 'boolean' } },
  },
  joinDidBody: {
    type: 'object',
    additionalProperties: false,
    required: ['contractAddress'],
    properties: { contractAddress: { type: 'string', minLength: 64, maxLength: 66 } },
  },
  generateKeyBody: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'kty', 'crv'],
    properties: {
      id: stringRequired,
      kty: { type: 'string', enum: keyTypes },
      crv: { type: 'string', enum: keyCurves },
      did: { type: 'string' },
      purpose: { type: 'string' },
    },
  },
  importKeyBody: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'privateKey', 'kty', 'crv'],
    properties: {
      id: stringRequired,
      privateKey: {
        type: 'array',
        minItems: 1,
        items: { type: 'integer', minimum: 0, maximum: 255 },
      },
      kty: { type: 'string', enum: keyTypes },
      crv: { type: 'string', enum: keyCurves },
      did: { type: 'string' },
      purpose: { type: 'string' },
    },
  },
  publicJwkBody: {
    ...publicJwkSchema,
  },
  signPayloadBody: {
    type: 'object',
    additionalProperties: false,
    description: 'Create a detached signature with a local key that is already published in the active DID document.',
    required: ['keyRef', 'payloadType', 'payload'],
    properties: {
      keyRef: { ...stringRequired, description: 'Local secret-store key reference used for signing.' },
      payloadType: {
        type: 'string',
        enum: payloadTypes,
        description: 'Payload interpretation: raw bytes (hex), UTF-8 string, or RFC 8785 canonicalized JSON.',
      },
      payload: { type: 'string', description: 'Raw payload input. JSON is canonicalized before signing.' },
    },
    examples: [
      {
        keyRef: '961fe66b-39c6-4e39-b890-0f4e3ea18ed6',
        payloadType: 'json',
        payload: '{"z":1,"a":2}',
      },
    ],
  },
  verifyPayloadBody: {
    type: 'object',
    additionalProperties: false,
    description: 'Verify a detached signature using exactly one verification source: local keyRef, explicit publicJwk, or absolute verificationMethodId.',
    required: ['payloadType', 'payload', 'signatureBase64Url'],
    properties: {
      payloadType: {
        type: 'string',
        enum: payloadTypes,
        description: 'Payload interpretation used during verification.',
      },
      payload: { type: 'string', description: 'Raw payload input to normalize and verify.' },
      signatureBase64Url: { ...stringRequired, description: 'Detached signature encoded as base64url.' },
      keyRef: { type: 'string', minLength: 1, description: 'Use an active local key as the verification source.' },
      publicJwk: publicJwkSchema,
      verificationMethodId: {
        type: 'string',
        minLength: 1,
        description: 'Absolute Midnight DID verification method id, for example did:midnight:...#auth-main.',
      },
    },
    examples: [
      {
        payloadType: 'string',
        payload: 'hello midnight',
        signatureBase64Url: 'c2lnbmF0dXJl',
        verificationMethodId: 'did:midnight:preprod:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#auth-main',
      },
      {
        payloadType: 'bytes',
        payload: '68656c6c6f',
        signatureBase64Url: 'c2lnbmF0dXJl',
        keyRef: '961fe66b-39c6-4e39-b890-0f4e3ea18ed6',
      },
    ],
  },
  verificationMethodBody: {
    type: 'object',
    additionalProperties: false,
    required: ['methodId', 'keyRef'],
    properties: { methodId: stringRequired, keyRef: stringRequired },
  },
  verificationMethodUpdateBody: {
    type: 'object',
    additionalProperties: false,
    required: ['keyRef'],
    properties: { keyRef: stringRequired },
  },
  relationBody: {
    type: 'object',
    additionalProperties: false,
    required: ['methodId', 'relation'],
    properties: {
      methodId: stringRequired,
      relation: { type: 'string', enum: relationTypes },
    },
  },
  serviceBody: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'type', 'serviceEndpoint'],
    properties: {
      id: stringRequired,
      type: stringRequired,
      serviceEndpoint: serviceEndpointSchema,
    },
  },
  serviceUpdateBody: {
    type: 'object',
    additionalProperties: false,
    required: ['type', 'serviceEndpoint'],
    properties: {
      type: stringRequired,
      serviceEndpoint: serviceEndpointSchema,
    },
  },
  alsoKnownAsBody: {
    type: 'object',
    additionalProperties: false,
    required: ['value'],
    properties: { value: stringRequired },
  },
} as const;
