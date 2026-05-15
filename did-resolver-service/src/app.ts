import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import { type Logger } from "pino";

import { INDEXER_ENDPOINT_URL_MAX_LENGTH } from "./indexer-endpoint-policy.js";
import {
  RESOLVER_DID_MAX_LENGTH,
  RESOLVER_DID_PATTERN,
} from "./resolver-input-validation.js";
import { type ResolverService } from "./service.js";
import { type ResolveRequestOptions } from "./types.js";
import { resolverPage } from "./ui.js";

const didResolutionRequiredFields = [
  "didDocument",
  "didDocumentMetadata",
  "didResolutionMetadata",
] as const;

const didDocumentSchema = {
  type: "object",
  additionalProperties: true,
} as const;
const metadataSchema = { type: "object", additionalProperties: true } as const;

const successResolveSchema = {
  type: "object",
  required: didResolutionRequiredFields,
  properties: {
    didDocument: didDocumentSchema,
    didDocumentMetadata: metadataSchema,
    didResolutionMetadata: metadataSchema,
  },
} as const;

const errorResolveSchema = {
  type: "object",
  required: didResolutionRequiredFields,
  properties: {
    didDocument: { type: "null" },
    didDocumentMetadata: metadataSchema,
    didResolutionMetadata: metadataSchema,
  },
} as const;

const resolveResponseSchema = {
  200: {
    oneOf: [successResolveSchema, errorResolveSchema],
  },
  500: errorResolveSchema,
  504: errorResolveSchema,
} as const;

type ResolveQuery = ResolveRequestOptions;
type CreateAppOptions = { logger?: Logger; docsEnabled: boolean };

const didParamSchema = {
  type: "string",
  maxLength: RESOLVER_DID_MAX_LENGTH,
  pattern: RESOLVER_DID_PATTERN,
} as const;

const indexerUrlOverrideSchema = {
  type: "string",
  minLength: 1,
  maxLength: INDEXER_ENDPOINT_URL_MAX_LENGTH,
} as const;

const resolveDidWithOptions = async (
  resolverService: ResolverService,
  did: string,
  options: ResolveQuery,
) => resolverService.resolve(did, options);

export const createApp = async (
  resolverService: ResolverService,
  options: CreateAppOptions = { docsEnabled: false },
): Promise<FastifyInstance> => {
  const fastifyOptions: FastifyServerOptions = options.logger
    ? {
        loggerInstance: options.logger,
        ajv: { customOptions: { removeAdditional: false } },
      }
    : { logger: true, ajv: { customOptions: { removeAdditional: false } } };
  const app = Fastify(fastifyOptions);

  if (options.docsEnabled === true) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "Midnight DID Resolver API",
          description:
            "Resolve did:midnight identifiers to DID Resolution output.",
          version: "0.1.0",
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs",
    });
  }

  app.get("/", async (_request, reply) => {
    reply.type("text/html").send(resolverPage);
  });

  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        response: {
          200: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string" },
            },
          },
        },
      },
    },
    async () => ({ status: "ok" }),
  );

  app.get(
    "/resolve/:did",
    {
      schema: {
        tags: ["Resolver"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["did"],
          properties: {
            did: didParamSchema,
          },
        },
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            indexerUrl: indexerUrlOverrideSchema,
            indexerWsUrl: indexerUrlOverrideSchema,
          },
        },
        response: resolveResponseSchema,
      },
    },
    async (
      request: FastifyRequest<{
        Params: { did: string };
        Querystring: ResolveQuery;
      }>,
      reply,
    ) => {
      const result = await resolveDidWithOptions(
        resolverService,
        request.params.did,
        request.query,
      );
      return reply.code(result.statusCode).send(result.payload);
    },
  );

  app.post(
    "/resolve",
    {
      schema: {
        tags: ["Resolver"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["did"],
          properties: {
            did: didParamSchema,
            indexerUrl: indexerUrlOverrideSchema,
            indexerWsUrl: indexerUrlOverrideSchema,
          },
        },
        response: resolveResponseSchema,
      },
    },
    async (
      request: FastifyRequest<{
        Body: { did: string } & ResolveQuery;
      }>,
      reply,
    ) => {
      const result = await resolveDidWithOptions(
        resolverService,
        request.body.did,
        {
          indexerUrl: request.body.indexerUrl,
          indexerWsUrl: request.body.indexerWsUrl,
        },
      );
      return reply.code(result.statusCode).send(result.payload);
    },
  );

  return app;
};
