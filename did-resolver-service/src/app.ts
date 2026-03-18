import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import { type Logger } from "pino";

import {
  classifyResolutionError,
  type ResolutionErrorCode,
  statusCodeForResolutionError,
} from "./resolution-errors.js";
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
  200: successResolveSchema,
  400: errorResolveSchema,
  404: errorResolveSchema,
  500: errorResolveSchema,
} as const;

type ResolveQuery = ResolveRequestOptions;

const resolveDidWithOptions = async (
  resolverService: ResolverService,
  did: string,
  options: ResolveQuery,
) => resolverService.resolve(did, options);

const errorPayload = (error: ResolutionErrorCode) => ({
  didDocument: null,
  didDocumentMetadata: {},
  didResolutionMetadata: {
    contentType: null,
    error,
  },
});

const hasValidationErrors = (
  error: unknown,
): error is { validation: unknown[] } =>
  typeof error === "object" && error !== null && "validation" in error;

export const createApp = async (
  resolverService: ResolverService,
  options?: { logger?: Logger; enableDocs?: boolean },
): Promise<FastifyInstance> => {
  const fastifyOptions: FastifyServerOptions = options?.logger
    ? {
        loggerInstance: options.logger,
        bodyLimit: 64 * 1024,
        requestTimeout: 15_000,
        connectionTimeout: 10_000,
        keepAliveTimeout: 5_000,
        routerOptions: {
          maxParamLength: 1024,
        },
      }
    : {
        logger: true,
        bodyLimit: 64 * 1024,
        requestTimeout: 15_000,
        connectionTimeout: 10_000,
        keepAliveTimeout: 5_000,
        routerOptions: {
          maxParamLength: 1024,
        },
      };
  const app = Fastify(fastifyOptions);

  app.setErrorHandler((error, request, reply) => {
    app.log.error({ err: error }, "Request failed");

    if (request.url.startsWith("/resolve")) {
      const resolutionError = hasValidationErrors(error)
        ? "invalidDid"
        : classifyResolutionError(error);
      return reply
        .code(statusCodeForResolutionError(resolutionError))
        .send(
          errorPayload(
            resolutionError === "notFound" ? "internalError" : resolutionError,
          ),
        );
    }

    const message =
      error instanceof Error ? error.message : "Unexpected resolver error";
    return reply.code(500).send({ error: message });
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    return payload;
  });

  if (options?.enableDocs ?? true) {
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
    "/ready",
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
    async () => ({ status: "ready" }),
  );

  app.get(
    "/resolve/:did",
    {
      schema: {
        tags: ["Resolver"],
        params: {
          type: "object",
          required: ["did"],
          additionalProperties: false,
          properties: {
            did: { type: "string", minLength: 1, maxLength: 512 },
          },
        },
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            indexerUrl: { type: "string", maxLength: 2048 },
            indexerWsUrl: { type: "string", maxLength: 2048 },
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
          required: ["did"],
          additionalProperties: false,
          properties: {
            did: { type: "string", minLength: 1, maxLength: 512 },
            indexerUrl: { type: "string", maxLength: 2048 },
            indexerWsUrl: { type: "string", maxLength: 2048 },
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
