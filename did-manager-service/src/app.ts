import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { ServiceEndpoint, VerificationMethodRelationType } from '@midnight-ntwrk/midnight-did-domain';
import type { GenerateKeyInput, ImportKeyInput } from '@midnight-ntwrk/midnight-did-secret-storage';
import Fastify from 'fastify';
import type { Logger } from 'pino';

import { DidManagerService } from './manager.js';
import type { PrepareFundingRequest, UnlockRequest } from './types.js';
import { didPage, walletPage } from './ui.js';

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

const seedModes = ['reuse', 'provided', 'generated'] as const;
const keyTypes = ['OKP', 'EC'] as const;
const keyCurves = ['Ed25519', 'Jubjub', 'P-256'] as const;
const relationTypes = [
  'Authentication',
  'AssertionMethod',
  'KeyAgreement',
  'CapabilityInvocation',
  'CapabilityDelegation',
] as const;

const stringRequired = { type: 'string', minLength: 1 } as const;
const keyRefParamSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['keyRef'],
  properties: {
    keyRef: stringRequired,
  },
} as const;
const methodIdParamSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['methodId'],
  properties: {
    methodId: stringRequired,
  },
} as const;
const serviceIdParamSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: stringRequired,
  },
} as const;
const serviceEndpointSchema = {
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

const wrap = <T>(data: T) => ({ ok: true as const, data });

type KeyParams = { keyRef: string };
type MethodParams = { methodId: string };
type ServiceParams = { id: string };
type JoinDidBody = { contractAddress: string };
type SelectProfileBody = { name: string };
type UpdatePreferencesBody = { rememberUnlockedSession: boolean };
type VerificationMethodBody = { methodId: string; keyRef: string };
type VerificationMethodUpdateBody = { keyRef: string };
type RelationBody = { methodId: string; relation: VerificationMethodRelationType };
type ServiceBody = { id: string; type: string; serviceEndpoint: ServiceEndpoint };
type ServiceUpdateBody = { type: string; serviceEndpoint: ServiceEndpoint };
type AlsoKnownAsBody = { value: string };

export const createApp = async (manager: DidManagerService, logger?: Logger) => {
  const app = Fastify({
    logger: logger === undefined ? false : undefined,
    loggerInstance: logger,
    bodyLimit: 64 * 1024,
    // DID operations can legitimately take tens of seconds while wallets sync,
    // funds settle, proofs are generated, and transactions finalize.
    requestTimeout: 300_000,
    connectionTimeout: 300_000,
    keepAliveTimeout: 5_000,
  });

  app.addHook('onSend', async (_req, reply, payload) => {
    for (const [key, value] of Object.entries(baseHeaders)) {
      reply.header(key, value);
    }
    return payload;
  });

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    app.log.error({ err: error }, 'Request failed');
    return reply.code(400).send({ ok: false, error: message });
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Midnight DID Manager API',
        version: '0.1.0',
        description: 'Single-user web manager for DID lifecycle operations.',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/', async (_req, reply) => reply.redirect('/wallet'));
  app.get('/wallet', async (_req, reply) => {
    reply.type('text/html').send(walletPage);
  });
  app.get('/did', async (_req, reply) => {
    reply.type('text/html').send(didPage);
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async () => ({ status: 'ready' }));
  app.get('/api/setup', async () => wrap(manager.getSetupStatus()));
  app.get('/api/profiles', async () => wrap(await manager.listProfiles()));
  app.post<{ Body: SelectProfileBody }>(
    '/api/profiles/select',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: {
            name: stringRequired,
          },
        },
      },
    },
    async (req) => wrap(await manager.selectProfile(req.body)),
  );

  app.get('/api/session', async () => wrap(await manager.getSessionStatus()));

  app.post<{ Body: UnlockRequest }>(
    '/api/session/unlock',
    {
      schema: {
        body: {
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
      },
    },
    async (req) => wrap(await manager.unlock(req.body)),
  );

  app.post<{ Body: PrepareFundingRequest }>(
    '/api/session/prepare-funding',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['seedMode'],
          properties: {
            seedMode: { type: 'string', enum: seedModes },
            seed: { type: 'string' },
          },
        },
      },
    },
    async (req) => wrap(await manager.prepareFunding(req.body)),
  );

  app.post('/api/session/lock', async () => wrap(await manager.lock()));

  app.post<{ Body: UpdatePreferencesBody }>(
    '/api/session/preferences',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['rememberUnlockedSession'],
          properties: {
            rememberUnlockedSession: { type: 'boolean' },
          },
        },
      },
    },
    async (req) => wrap(await manager.updatePreferences(req.body)),
  );

  app.post('/api/did/deploy', async () => wrap(await manager.deployDid()));
  app.post<{ Body: JoinDidBody }>(
    '/api/did/join',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['contractAddress'],
          properties: {
            contractAddress: { type: 'string', minLength: 64, maxLength: 66 },
          },
        },
      },
    },
    async (req) => wrap(await manager.joinDid(req.body)),
  );

  app.get('/api/did/state', async () => wrap(await manager.getDidState()));
  app.get('/api/did/document', async () => wrap(await manager.getDidDocument()));
  app.post('/api/did/deactivate', async () => wrap(await manager.deactivateDid()));

  app.get('/api/keys', async () => wrap(await manager.listKeys()));
  app.post<{ Body: GenerateKeyInput }>(
    '/api/keys/generate',
    {
      schema: {
        body: {
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
      },
    },
    async (req) => wrap(await manager.generateKey(req.body)),
  );
  app.post<{ Body: Omit<ImportKeyInput, 'privateKey'> & { privateKey: number[] } }>(
    '/api/keys/import',
    {
      schema: {
        body: {
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
      },
    },
    async (req) => {
      const payload: ImportKeyInput = {
        id: req.body.id,
        privateKey: Uint8Array.from(req.body.privateKey),
        kty: req.body.kty,
        crv: req.body.crv,
        did: req.body.did,
        purpose: req.body.purpose,
      };
      return wrap(await manager.importKey(payload));
    },
  );
  app.delete<{ Params: KeyParams }>('/api/keys/:keyRef', { schema: { params: keyRefParamSchema } }, async (req) => {
    await manager.deleteKey(req.params);
    return wrap({ deleted: true });
  });

  app.post<{ Body: VerificationMethodBody }>(
    '/api/did/verification-methods',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['methodId', 'keyRef'],
          properties: {
            methodId: stringRequired,
            keyRef: stringRequired,
          },
        },
      },
    },
    async (req) => wrap(await manager.addVerificationMethod(req.body)),
  );
  app.put<{ Params: MethodParams; Body: VerificationMethodUpdateBody }>(
    '/api/did/verification-methods/:methodId',
    {
      schema: {
        params: methodIdParamSchema,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['keyRef'],
          properties: {
            keyRef: stringRequired,
          },
        },
      },
    },
    async (req) => wrap(await manager.updateVerificationMethod({ methodId: req.params.methodId, keyRef: req.body.keyRef })),
  );
  app.delete<{ Params: MethodParams }>(
    '/api/did/verification-methods/:methodId',
    { schema: { params: methodIdParamSchema } },
    async (req) => wrap(await manager.removeVerificationMethod({ methodId: req.params.methodId })),
  );

  app.post<{ Body: RelationBody }>(
    '/api/did/relations',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['methodId', 'relation'],
          properties: {
            methodId: stringRequired,
            relation: { type: 'string', enum: relationTypes },
          },
        },
      },
    },
    async (req) => wrap(await manager.addRelation(req.body)),
  );
  app.delete<{ Body: RelationBody }>(
    '/api/did/relations',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['methodId', 'relation'],
          properties: {
            methodId: stringRequired,
            relation: { type: 'string', enum: relationTypes },
          },
        },
      },
    },
    async (req) => wrap(await manager.removeRelation(req.body)),
  );

  app.post<{ Body: ServiceBody }>(
    '/api/did/services',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'type', 'serviceEndpoint'],
          properties: {
            id: stringRequired,
            type: stringRequired,
            serviceEndpoint: serviceEndpointSchema,
          },
        },
      },
    },
    async (req) => wrap(await manager.addService(req.body)),
  );
  app.put<{ Params: ServiceParams; Body: ServiceUpdateBody }>(
    '/api/did/services/:id',
    {
      schema: {
        params: serviceIdParamSchema,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'serviceEndpoint'],
          properties: {
            type: stringRequired,
            serviceEndpoint: serviceEndpointSchema,
          },
        },
      },
    },
    async (req) => wrap(await manager.updateService({ id: req.params.id, type: req.body.type, serviceEndpoint: req.body.serviceEndpoint })),
  );
  app.delete<{ Params: ServiceParams }>(
    '/api/did/services/:id',
    { schema: { params: serviceIdParamSchema } },
    async (req) => wrap(await manager.removeService({ id: req.params.id })),
  );

  app.post<{ Body: AlsoKnownAsBody }>(
    '/api/did/also-known-as',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['value'],
          properties: {
            value: stringRequired,
          },
        },
      },
    },
    async (req) => wrap(await manager.addAlsoKnownAs(req.body)),
  );
  app.delete<{ Body: AlsoKnownAsBody }>(
    '/api/did/also-known-as',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['value'],
          properties: {
            value: stringRequired,
          },
        },
      },
    },
    async (req) => wrap(await manager.removeAlsoKnownAs(req.body)),
  );

  return app;
};
