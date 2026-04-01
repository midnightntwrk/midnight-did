import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { ServiceEndpoint, VerificationMethodRelationType } from '@midnight-ntwrk/midnight-did-domain';
import type { GenerateKeyInput, ImportKeyInput } from '@midnight-ntwrk/midnight-did-secret-storage';
import Fastify from 'fastify';
import type { Logger } from 'pino';

import { classifyManagerHttpError } from './errors.js';
import { OperationStore } from './http/operation-store.js';
import {
  keyRefParamSchema,
  methodIdParamSchema,
  routeSchemas,
  serviceIdParamSchema,
} from './http/schemas.js';
import { DidManagerService } from './manager.js';
import type { PrepareFundingRequest, UnlockRequest } from './types.js';
import { didPage, secretStoragePage, walletPage } from './ui.js';

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

const wrap = <T>(data: T) => ({ ok: true as const, data });
const sleep = async (ms: number): Promise<void> => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

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
    const failure = classifyManagerHttpError(error);
    app.log.error({ err: error }, 'Request failed');
    return reply.code(failure.statusCode).send({
      ok: false,
      error: failure.message,
      errorCode: failure.errorCode,
    });
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

  const operations = new OperationStore();

  const acceptOperation = (
    reply: { code: (statusCode: number) => unknown },
    operation: ReturnType<OperationStore['start']>,
  ) => {
    reply.code(202);
    return wrap(operation);
  };

  const waitForUnlockTerminalState = async (
    input: UnlockRequest,
  ): Promise<{ status: Awaited<ReturnType<DidManagerService['getSessionStatus']>>; generatedSeed?: string }> => {
    const accepted = await manager.unlock(input);
    while (true) {
      const status = await manager.getSessionStatus();
      if (status.connection.phase === 'ready') {
        return {
          status,
          generatedSeed: accepted.generatedSeed,
        };
      }
      if (status.connection.phase === 'error') {
        throw new Error(status.connection.lastError ?? 'Unlock failed');
      }
      await sleep(1_000);
    }
  };

  app.get('/', async (_req, reply) => reply.redirect('/wallet'));
  app.get('/wallet', async (_req, reply) => {
    reply.type('text/html').send(walletPage);
  });
  app.get('/secret-storage', async (_req, reply) => {
    reply.type('text/html').send(secretStoragePage);
  });
  app.get('/did', async (_req, reply) => {
    reply.type('text/html').send(didPage);
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async () => ({ status: 'ready' }));
  app.get('/api/setup', async () => wrap(manager.getSetupStatus()));
  app.get('/api/profiles', async () => wrap(await manager.listProfiles()));
  app.get('/api/contracts', async () => wrap(await manager.listStoredContracts()));
  app.get('/api/operations', async () => wrap(operations.list()));
  app.get('/api/operations/current', async () => wrap(operations.current()));
  app.get<{ Params: { id: string } }>(
    '/api/operations/:id',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            ...routeSchemas.operationIdParams.properties,
          },
        },
      },
    },
    async (req) => {
      const operation = operations.get(req.params.id);
      if (operation === undefined) {
        throw new Error(`Operation not found: ${req.params.id}`);
      }
      return wrap(operation);
    },
  );
  app.post<{ Body: SelectProfileBody }>(
    '/api/profiles/select',
    {
      schema: {
        body: {
          ...routeSchemas.selectProfileBody,
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
          ...routeSchemas.unlockBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('unlock', () => waitForUnlockTerminalState(req.body))),
  );

  app.post<{ Body: PrepareFundingRequest }>(
    '/api/session/prepare-funding',
    {
      schema: {
        body: {
          ...routeSchemas.prepareFundingBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('prepareFunding', () => manager.prepareFunding(req.body))),
  );

  app.post('/api/session/lock', async (_req, reply) => acceptOperation(reply, operations.start('lock', () => manager.lock())));

  app.post<{ Body: UpdatePreferencesBody }>(
    '/api/session/preferences',
    {
      schema: {
        body: {
          ...routeSchemas.preferencesBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('updatePreferences', () => manager.updatePreferences(req.body))),
  );

  app.post('/api/did/deploy', async (_req, reply) => acceptOperation(reply, operations.start('deployDid', () => manager.deployDid())));
  app.post<{ Body: JoinDidBody }>(
    '/api/did/join',
    {
      schema: {
        body: {
          ...routeSchemas.joinDidBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('joinDid', () => manager.joinDid(req.body))),
  );

  app.get('/api/did/state', async () => wrap(await manager.getDidState()));
  app.get('/api/did/document', async () => wrap(await manager.getDidDocument()));
  app.post('/api/did/deactivate', async (_req, reply) => acceptOperation(reply, operations.start('deactivateDid', () => manager.deactivateDid())));

  app.get('/api/keys', async () => wrap(await manager.listKeys()));
  app.post<{ Body: GenerateKeyInput }>(
    '/api/keys/generate',
    {
      schema: {
        body: {
          ...routeSchemas.generateKeyBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('generateKey', () => manager.generateKey(req.body))),
  );
  app.post<{ Body: Omit<ImportKeyInput, 'privateKey'> & { privateKey: number[] } }>(
    '/api/keys/import',
    {
      schema: {
        body: {
          ...routeSchemas.importKeyBody,
        },
      },
    },
    async (req, reply) => {
      const payload: ImportKeyInput = {
        id: req.body.id,
        privateKey: Uint8Array.from(req.body.privateKey),
        kty: req.body.kty,
        crv: req.body.crv,
        did: req.body.did,
        purpose: req.body.purpose,
      };
      return acceptOperation(reply, operations.start('importKey', () => manager.importKey(payload)));
    },
  );
  app.delete<{ Params: KeyParams }>(
    '/api/keys/:keyRef',
    { schema: { params: keyRefParamSchema } },
    async (req, reply) => acceptOperation(reply, operations.start('deleteKey', async () => {
      await manager.deleteKey(req.params);
      return { deleted: true };
    })),
  );

  app.post<{ Body: VerificationMethodBody }>(
    '/api/did/verification-methods',
    {
      schema: {
        body: {
          ...routeSchemas.verificationMethodBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('addVerificationMethod', () => manager.addVerificationMethod(req.body))),
  );
  app.put<{ Params: MethodParams; Body: VerificationMethodUpdateBody }>(
    '/api/did/verification-methods/:methodId',
    {
      schema: {
        params: methodIdParamSchema,
        body: {
          ...routeSchemas.verificationMethodUpdateBody,
        },
      },
    },
    async (req, reply) =>
      acceptOperation(
        reply,
        operations.start('updateVerificationMethod', () =>
          manager.updateVerificationMethod({ methodId: req.params.methodId, keyRef: req.body.keyRef })),
      ),
  );
  app.delete<{ Params: MethodParams }>(
    '/api/did/verification-methods/:methodId',
    { schema: { params: methodIdParamSchema } },
    async (req, reply) =>
      acceptOperation(
        reply,
        operations.start('removeVerificationMethod', () => manager.removeVerificationMethod({ methodId: req.params.methodId })),
      ),
  );

  app.post<{ Body: RelationBody }>(
    '/api/did/relations',
    {
      schema: {
        body: {
          ...routeSchemas.relationBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('addRelation', () => manager.addRelation(req.body))),
  );
  app.delete<{ Body: RelationBody }>(
    '/api/did/relations',
    {
      schema: {
        body: {
          ...routeSchemas.relationBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('removeRelation', () => manager.removeRelation(req.body))),
  );

  app.post<{ Body: ServiceBody }>(
    '/api/did/services',
    {
      schema: {
        body: {
          ...routeSchemas.serviceBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('addService', () => manager.addService(req.body))),
  );
  app.put<{ Params: ServiceParams; Body: ServiceUpdateBody }>(
    '/api/did/services/:id',
    {
      schema: {
        params: serviceIdParamSchema,
        body: {
          ...routeSchemas.serviceUpdateBody,
        },
      },
    },
    async (req, reply) =>
      acceptOperation(
        reply,
        operations.start('updateService', () => manager.updateService({ id: req.params.id, type: req.body.type, serviceEndpoint: req.body.serviceEndpoint })),
      ),
  );
  app.delete<{ Params: ServiceParams }>(
    '/api/did/services/:id',
    { schema: { params: serviceIdParamSchema } },
    async (req, reply) =>
      acceptOperation(reply, operations.start('removeService', () => manager.removeService({ id: req.params.id }))),
  );

  app.post<{ Body: AlsoKnownAsBody }>(
    '/api/did/also-known-as',
    {
      schema: {
        body: {
          ...routeSchemas.alsoKnownAsBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('addAlsoKnownAs', () => manager.addAlsoKnownAs(req.body))),
  );
  app.delete<{ Body: AlsoKnownAsBody }>(
    '/api/did/also-known-as',
    {
      schema: {
        body: {
          ...routeSchemas.alsoKnownAsBody,
        },
      },
    },
    async (req, reply) => acceptOperation(reply, operations.start('removeAlsoKnownAs', () => manager.removeAlsoKnownAs(req.body))),
  );

  return app;
};
