import { ContractState } from "@midnight-ntwrk/compact-runtime";
import {
  MidnightDIDResolver,
  MidnightNetwork,
} from "@midnight-ntwrk/midnight-did";
import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { Buffer } from "buffer";

import { IndexerEndpointPolicy } from "./indexer-endpoint-policy.js";
import {
  classifyResolutionError,
  type ResolutionErrorCode,
  ResolutionRequestTimeoutError,
  statusCodeForResolutionError,
} from "./resolution-errors.js";
import { assertResolverDidInput } from "./resolver-input-validation.js";
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
      statusCode: 200 | 500 | 504;
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
  indexerClientFactory?: ResolverIndexerClientFactory;
};

export const RESOLVER_CACHE_MAX_SIZE = 64;
export const DEFAULT_RESOLVER_REQUEST_TIMEOUT_MS = 10_000;

export type ResolverLogger = {
  error: (message: string, context?: Record<string, unknown>) => void;
};

type ResolvedIndexerEndpoints = ReturnType<IndexerEndpointPolicy["resolve"]>;

type ContractStateQueryResponse = {
  data?: {
    contractAction?: {
      state?: string | null;
    } | null;
  } | null;
  errors?: readonly { message?: string }[];
};

export type ResolverIndexerClient = {
  queryContractState: (
    contractAddress: string,
    signal: AbortSignal,
  ) => Promise<ContractState | null>;
};

type ResolverIndexerClientFactory = (
  endpoints: ResolvedIndexerEndpoints,
) => ResolverIndexerClient;

const defaultLogger: ResolverLogger = {
  error: (message, context) => {
    if (context === undefined) {
      console.error(message);
      return;
    }
    console.error(message, context);
  },
};

const contractStateQuery = `
  query CONTRACT_STATE_QUERY($address: HexEncoded!, $offset: ContractActionOffset) {
    contractAction(address: $address, offset: $offset) {
      state
    }
  }
`;

const describeGraphQLErrors = (
  errors: readonly { message?: string }[],
): string =>
  errors
    .map(
      (error, index) =>
        `${(index + 1).toString()}. ${error.message ?? "GraphQL error"}`,
    )
    .join("; ");

class HttpResolverIndexerClient implements ResolverIndexerClient {
  constructor(private readonly indexerHttpUrl: string) {}

  async queryContractState(
    contractAddress: string,
    signal: AbortSignal,
  ): Promise<ContractState | null> {
    const response = await fetch(this.indexerHttpUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        query: contractStateQuery,
        variables: {
          address: contractAddress,
          offset: null,
        },
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Indexer contract-state query failed with HTTP ${response.status.toString()}`,
      );
    }

    const payload = (await response.json()) as ContractStateQueryResponse;
    if (payload.errors !== undefined && payload.errors.length > 0) {
      throw new Error(
        `Indexer GraphQL error(s): ${describeGraphQLErrors(payload.errors)}`,
      );
    }

    const state = payload.data?.contractAction?.state ?? null;
    return state === null
      ? null
      : ContractState.deserialize(Buffer.from(state, "hex"));
  }
}

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

const redactUrlCredentialsInText = (value: string): string =>
  value.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/)([^/?#\s@]*)@/giu,
    "$1redacted:redacted@",
  );

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
  private readonly indexerClientFactory: ResolverIndexerClientFactory;
  private readonly indexerClientCache = new Map<
    string,
    ResolverIndexerClient
  >();

  constructor(options: ResolverServiceOptions) {
    this.expectedNetwork = options.expectedNetwork;
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? DEFAULT_RESOLVER_REQUEST_TIMEOUT_MS;
    this.debug = options.debug ?? false;
    this.logger = options.logger ?? defaultLogger;
    this.indexerClientFactory =
      options.indexerClientFactory ??
      ((endpoints) => new HttpResolverIndexerClient(endpoints.indexerHttpUrl));
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
      error instanceof Error
        ? redactUrlCredentialsInText(error.message)
        : "Unexpected resolve error";
    const stack =
      error instanceof Error && error.stack !== undefined
        ? redactUrlCredentialsInText(error.stack)
        : undefined;
    this.logger.error("[did-resolver-service] resolve failed", {
      did,
      options: scrubResolveOptions(options),
      errorCode,
      message,
      stack,
    });
  }

  private touchCache(cacheKey: string, client: ResolverIndexerClient): void {
    if (this.indexerClientCache.has(cacheKey)) {
      this.indexerClientCache.delete(cacheKey);
    }
    this.indexerClientCache.set(cacheKey, client);
    if (this.indexerClientCache.size <= RESOLVER_CACHE_MAX_SIZE) {
      return;
    }
    const oldestKey = this.indexerClientCache.keys().next().value;
    if (oldestKey !== undefined) {
      this.indexerClientCache.delete(oldestKey);
    }
  }

  private indexerClientFor(
    options?: ResolveRequestOptions,
  ): ResolverIndexerClient {
    const { indexerHttpUrl, indexerWsUrl } =
      this.endpointPolicy.resolve(options);
    const cacheKey = `${indexerHttpUrl}|${indexerWsUrl}|${this.expectedNetwork ?? "any"}`;
    const cached = this.indexerClientCache.get(cacheKey);
    if (cached !== undefined) {
      this.touchCache(cacheKey, cached);
      return cached;
    }
    const client = this.indexerClientFactory({ indexerHttpUrl, indexerWsUrl });
    this.touchCache(cacheKey, client);
    return client;
  }

  private resolverFor(
    options: ResolveRequestOptions | undefined,
    signal: AbortSignal,
  ): MidnightDIDResolver {
    const indexerClient = this.indexerClientFor(options);
    const resolver = new MidnightDIDResolver({
      expectedNetwork: this.expectedNetwork,
      ledgerReader: async (contractAddress) => {
        const contractState = await indexerClient.queryContractState(
          contractAddress,
          signal,
        );
        return contractState === null
          ? null
          : DIDContract.ledger(contractState.data);
      },
    });
    return resolver;
  }

  private async withResolutionTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const abortController = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutOperation = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        const timeoutError = new ResolutionRequestTimeoutError(
          this.requestTimeoutMs,
        );
        reject(timeoutError);
        abortController.abort(timeoutError);
      }, this.requestTimeoutMs);
    });

    try {
      return await Promise.race([
        operation(abortController.signal),
        timeoutOperation,
      ]);
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
      assertResolverDidInput(did);
      const result = await this.withResolutionTimeout((signal) =>
        this.resolverFor(options, signal).resolveResult(did),
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
