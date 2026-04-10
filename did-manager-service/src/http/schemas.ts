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
  required: ['kty', 'crv', 'x'],
  properties: {
    kty: { type: 'string', enum: keyTypes },
    crv: { type: 'string', enum: keyCurves },
    x: stringRequired,
    y: { type: 'string' },
  },
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
    required: ['keyRef', 'payloadType', 'payload'],
    properties: {
      keyRef: stringRequired,
      payloadType: { type: 'string', enum: payloadTypes },
      payload: { type: 'string' },
    },
  },
  verifyPayloadBody: {
    type: 'object',
    additionalProperties: false,
    required: ['payloadType', 'payload', 'signatureBase64Url'],
    properties: {
      payloadType: { type: 'string', enum: payloadTypes },
      payload: { type: 'string' },
      signatureBase64Url: stringRequired,
      keyRef: { type: 'string', minLength: 1 },
      publicJwk: publicJwkSchema,
      verificationMethodId: { type: 'string', minLength: 1 },
    },
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
