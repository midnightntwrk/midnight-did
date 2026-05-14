import {
  MidnightDIDResolver,
  MidnightNetwork,
} from "@midnight-ntwrk/midnight-did";
import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";

import { IndexerEndpointPolicy } from "./indexer-endpoint-policy.js";
import {
  classifyResolutionError,
  type ResolutionErrorCode,
  ResolutionRequestTimeoutError,
  statusCodeForResolutionError,
} from "./resolution-errors.js";
import { type ResolveRequestOptions } from "./types.js";

export type MidnightResolutionResult = NonNullable<
  Awaited<ReturnType<MidnightDIDResolver["resolveResult"]>>
>;

export type ResolveResponse =
  | {
      statusCode: 200;
      payload: MidnightResolutionResult & {
        didResolutionMetadata: {
          contentType: "application/did+ld+json";
          error: null;
        };
      };
    }
  | {
      statusCode: 200 | 500;
      payload: {
        didDocument: null;
        didDocumentMetadata: {};
        didResolutionMetadata: {
          contentType: null;
          error: ResolutionErrorCode;
        };
      };
    };

export type ResolverServiceOptions = {
  indexerHttpUrl: string;
  indexerWsUrl: string;
  allowedIndexerHttpUrls?: readonly string[];
  allowedIndexerWsUrls?: readonly string[];
  expectedNetwork?: MidnightNetwork;
  requestTimeoutMs?: number;
  debug?: boolean;
  logger?: ResolverLogger;
};

export const RESOLVER_CACHE_MAX_SIZE = 64;
export const DEFAULT_RESOLVER_REQUEST_TIMEOUT_MS = 10_000;

export type ResolverLogger = {
  error: (message: string, context?: Record<string, unknown>) => void;
};

const defaultLogger: ResolverLogger = {
  error: (message, context) => {
    if (context === undefined) {
      console.error(message);
      return;
    }
    console.error(message, context);
  },
};

const errorPayload = (error: ResolutionErrorCode) => ({
  didDocument: null,
  didDocumentMetadata: {},
  didResolutionMetadata: { contentType: null, error },
});

const redactUrlForLog = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.username !== "") parsed.username = "redacted";
    if (parsed.password !== "") parsed.password = "redacted";
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
};

const scrubResolveOptions = (
  options: ResolveRequestOptions | undefined,
): ResolveRequestOptions | undefined => {
  if (options === undefined) return undefined;
  return {
    indexerUrl: redactUrlForLog(options.indexerUrl),
    indexerWsUrl: redactUrlForLog(options.indexerWsUrl),
  };
};

export class ResolverService {
  private readonly expectedNetwork: MidnightNetwork | undefined;
  private readonly endpointPolicy: IndexerEndpointPolicy;
  private readonly requestTimeoutMs: number;
  private readonly debug: boolean;
  private readonly logger: ResolverLogger;
  private readonly resolverCache = new Map<string, MidnightDIDResolver>();

  constructor(options: ResolverServiceOptions) {
    this.expectedNetwork = options.expectedNetwork;
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? DEFAULT_RESOLVER_REQUEST_TIMEOUT_MS;
    this.debug = options.debug ?? false;
    this.logger = options.logger ?? defaultLogger;
    this.endpointPolicy = new IndexerEndpointPolicy(
      {
        indexerHttpUrl: options.indexerHttpUrl,
        indexerWsUrl: options.indexerWsUrl,
      },
      {
        indexerHttpUrls: options.allowedIndexerHttpUrls,
        indexerWsUrls: options.allowedIndexerWsUrls,
      },
    );
  }

  private logResolutionFailure(
    did: string,
    options: ResolveRequestOptions | undefined,
    errorCode: ResolutionErrorCode,
    error: unknown,
  ): void {
    if (!this.debug) return;
    const message =
      error instanceof Error ? error.message : "Unexpected resolve error";
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error("[did-resolver-service] resolve failed", {
      did,
      options: scrubResolveOptions(options),
      errorCode,
      message,
      stack,
    });
  }

  private touchCache(cacheKey: string, resolver: MidnightDIDResolver): void {
    if (this.resolverCache.has(cacheKey)) {
      this.resolverCache.delete(cacheKey);
    }
    this.resolverCache.set(cacheKey, resolver);
    if (this.resolverCache.size <= RESOLVER_CACHE_MAX_SIZE) {
      return;
    }
    const oldestKey = this.resolverCache.keys().next().value;
    if (oldestKey !== undefined) {
      this.resolverCache.delete(oldestKey);
    }
  }

  private resolverFor(options?: ResolveRequestOptions): MidnightDIDResolver {
    const { indexerHttpUrl, indexerWsUrl } =
      this.endpointPolicy.resolve(options);
    const cacheKey = `${indexerHttpUrl}|${indexerWsUrl}|${this.expectedNetwork ?? "any"}`;
    const cached = this.resolverCache.get(cacheKey);
    if (cached !== undefined) {
      this.touchCache(cacheKey, cached);
      return cached;
    }
    const publicDataProvider = indexerPublicDataProvider(
      indexerHttpUrl,
      indexerWsUrl,
    );
    const resolver = new MidnightDIDResolver({
      expectedNetwork: this.expectedNetwork,
      ledgerReader: async (contractAddress) => {
        const contractState =
          await publicDataProvider.queryContractState(contractAddress);
        return contractState === null
          ? null
          : DIDContract.ledger(contractState.data);
      },
    });
    this.touchCache(cacheKey, resolver);
    return resolver;
  }

  private async withResolutionTimeout<T>(operation: Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutOperation = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new ResolutionRequestTimeoutError(this.requestTimeoutMs));
      }, this.requestTimeoutMs);
    });

    try {
      return await Promise.race([operation, timeoutOperation]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  async resolve(
    did: string,
    options?: ResolveRequestOptions,
  ): Promise<ResolveResponse> {
    try {
      const result = await this.withResolutionTimeout(
        this.resolverFor(options).resolveResult(did),
      );
      if (result === null) {
        return {
          statusCode: statusCodeForResolutionError("notFound"),
          payload: errorPayload("notFound"),
        };
      }

      return {
        statusCode: 200,
        payload: {
          ...result,
          didResolutionMetadata: {
            contentType: "application/did+ld+json",
            error: null,
          },
        },
      };
    } catch (error) {
      const resolveError = classifyResolutionError(error);
      this.logResolutionFailure(did, options, resolveError, error);
      const statusCode = statusCodeForResolutionError(resolveError);
      return {
        statusCode,
        payload: errorPayload(resolveError),
      };
    }
  }
}
