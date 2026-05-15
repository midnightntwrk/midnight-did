import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveResultMock = vi.fn();
const queryContractStateMock = vi.fn();
const ledgerFromStateMock = vi.fn();
const resolverCtorMock = vi.fn();
const indexerClientFactoryMock = vi.fn();

type ResolverCtorOptions = {
  ledgerReader: (address: string) => Promise<unknown>;
};

vi.mock("@midnight-ntwrk/midnight-did", () => {
  class MidnightDIDResolver {
    private readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
      resolverCtorMock(options);
    }

    resolveResult = (did: string) => resolveResultMock(did, this.options);
  }

  return {
    MidnightDIDResolver,
    MidnightNetwork: {
      DevNet: "devnet",
      Testnet: "testnet",
    },
  };
});

vi.mock("@midnight-ntwrk/midnight-did-contract", () => ({
  DIDContract: {
    ledger: (...args: unknown[]) => ledgerFromStateMock(...args),
  },
}));

import { RESOLVER_CACHE_MAX_SIZE, ResolverService } from "../service";
import { type ResolveRequestOptions } from "../types";

const validDid = `did:midnight:devnet:${"a".repeat(64)}`;
const secondValidDid = `did:midnight:devnet:${"b".repeat(64)}`;

describe("did-resolver-service service", () => {
  beforeEach(() => {
    resolveResultMock.mockReset();
    queryContractStateMock.mockReset();
    ledgerFromStateMock.mockReset();
    resolverCtorMock.mockClear();
    indexerClientFactoryMock.mockReset();
    indexerClientFactoryMock.mockReturnValue({
      queryContractState: queryContractStateMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns resolved DID document with DID content type", async () => {
    resolveResultMock.mockResolvedValue({
      didDocument: { id: validDid },
      didDocumentMetadata: { versionId: "1" },
      didResolutionMetadata: { error: null },
    });

    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
    });

    const result = await service.resolve(validDid);
    expect(result.statusCode).toBe(200);
    expect(result.payload.didResolutionMetadata).toEqual({
      contentType: "application/did+ld+json",
      error: null,
    });
  });

  it("maps null resolution to notFound", async () => {
    resolveResultMock.mockResolvedValue(null);
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
    });

    const result = await service.resolve(validDid);
    expect(result.statusCode).toBe(200);
    expect(result.payload.didResolutionMetadata.error).toBe("notFound");
  });

  it("derives ws indexer URL from provided http override", async () => {
    resolveResultMock.mockResolvedValue(null);
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      allowedIndexerHttpUrls: ["https://another.example/api/v3/graphql"],
      indexerClientFactory: indexerClientFactoryMock,
    });

    await service.resolve(validDid, {
      indexerUrl: "https://another.example/api/v3/graphql",
    });

    expect(indexerClientFactoryMock).toHaveBeenCalledWith({
      indexerHttpUrl: "https://another.example/api/v3/graphql",
      indexerWsUrl: "wss://another.example/api/v3/graphql/ws",
    });
  });

  it("rejects unallowlisted indexer overrides before provider creation", async () => {
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
    });

    const result = await service.resolve(validDid, {
      indexerUrl: "http://169.254.169.254/latest/meta-data",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.didResolutionMetadata.error).toBe("invalidDid");
    expect(indexerClientFactoryMock).not.toHaveBeenCalled();
    expect(resolverCtorMock).not.toHaveBeenCalled();
  });

  it("reuses indexer clients for same endpoint pair", async () => {
    resolveResultMock.mockResolvedValue(null);
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      indexerClientFactory: indexerClientFactoryMock,
    });

    await service.resolve(validDid);
    await service.resolve(secondValidDid);

    expect(indexerClientFactoryMock).toHaveBeenCalledTimes(1);
  });

  it("evicts least recently used indexer client when cache size is exceeded", async () => {
    resolveResultMock.mockResolvedValue(null);
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      indexerClientFactory: indexerClientFactoryMock,
      allowedIndexerHttpUrls: Array.from(
        { length: RESOLVER_CACHE_MAX_SIZE + 1 },
        (_value, index) => `http://idx-${index}.example/api/v3/graphql`,
      ),
    });

    for (let i = 0; i <= RESOLVER_CACHE_MAX_SIZE; i += 1) {
      await service.resolve(validDid, {
        indexerUrl: `http://idx-${i}.example/api/v3/graphql`,
      });
    }

    expect(indexerClientFactoryMock).toHaveBeenCalledTimes(
      RESOLVER_CACHE_MAX_SIZE + 1,
    );

    await service.resolve(validDid, {
      indexerUrl: "http://idx-0.example/api/v3/graphql",
    });

    expect(indexerClientFactoryMock).toHaveBeenCalledTimes(
      RESOLVER_CACHE_MAX_SIZE + 2,
    );
  });

  it("maps contract state through DIDContract.ledger in resolver reader", async () => {
    resolveResultMock.mockResolvedValue(null);
    queryContractStateMock.mockResolvedValue({ data: { state: "value" } });
    ledgerFromStateMock.mockReturnValue({ ledger: "mapped" });
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      indexerClientFactory: indexerClientFactoryMock,
    });

    await service.resolve(validDid);

    const ctorArgs = resolverCtorMock.mock.calls[0]?.[0] as ResolverCtorOptions;
    const mappedState = await ctorArgs.ledgerReader("contract-address");
    expect(queryContractStateMock).toHaveBeenCalledWith(
      "contract-address",
      expect.any(AbortSignal),
    );
    expect(ledgerFromStateMock).toHaveBeenCalledWith({ state: "value" });
    expect(mappedState).toEqual({ ledger: "mapped" });

    queryContractStateMock.mockResolvedValueOnce(null);
    const missingState = await ctorArgs.ledgerReader("missing-address");
    expect(missingState).toBeNull();
  });

  it("maps validation/network/internal errors to expected DID errors", async () => {
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
    });

    resolveResultMock.mockRejectedValueOnce(new Error("Network mismatch"));
    resolveResultMock.mockRejectedValueOnce(new Error("boom"));

    const invalidDid = await service.resolve("did:bad");
    const networkMismatch = await service.resolve(validDid);
    const internalError = await service.resolve(validDid);

    expect(invalidDid.statusCode).toBe(200);
    expect(invalidDid.payload.didResolutionMetadata.error).toBe("invalidDid");

    expect(networkMismatch.statusCode).toBe(200);
    expect(networkMismatch.payload.didResolutionMetadata.error).toBe(
      "networkMismatch",
    );

    expect(internalError.statusCode).toBe(500);
    expect(internalError.payload.didResolutionMetadata.error).toBe(
      "internalError",
    );
  });

  it("rejects malformed and oversized DID inputs before resolver work", async () => {
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      indexerClientFactory: indexerClientFactoryMock,
    });

    const malformed = await service.resolve(
      `did:midnight:devnet:${"a".repeat(63)}`,
    );
    const oversized = await service.resolve(
      `did:midnight:devnet:${"a".repeat(512)}`,
    );

    expect(malformed.statusCode).toBe(200);
    expect(malformed.payload.didResolutionMetadata.error).toBe("invalidDid");
    expect(oversized.statusCode).toBe(200);
    expect(oversized.payload.didResolutionMetadata.error).toBe("invalidDid");
    expect(resolverCtorMock).not.toHaveBeenCalled();
    expect(indexerClientFactoryMock).not.toHaveBeenCalled();
  });

  it("aborts the upstream indexer query when resolution times out", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    queryContractStateMock.mockImplementation(
      (_address: string, signal: AbortSignal) => {
        observedSignal = signal;
        return new Promise<never>(() => undefined);
      },
    );
    resolveResultMock.mockImplementationOnce(
      (_did: string, options: ResolverCtorOptions) =>
        options.ledgerReader("contract-address"),
    );
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      requestTimeoutMs: 25,
      indexerClientFactory: indexerClientFactoryMock,
    });

    const resultPromise = service.resolve(validDid);
    await vi.advanceTimersByTimeAsync(25);
    const result = await resultPromise;

    expect(result.statusCode).toBe(504);
    expect(result.payload.didResolutionMetadata.error).toBe("timeout");
    expect(queryContractStateMock).toHaveBeenCalledWith(
      "contract-address",
      expect.any(AbortSignal),
    );
    expect(observedSignal?.aborted).toBe(true);
  });

  it("uses injected logger for scrubbed debug error output", async () => {
    const logger = { error: vi.fn() };
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      allowedIndexerHttpUrls: ["https://indexer.example/api/v3/graphql"],
      debug: true,
      logger,
    });

    resolveResultMock.mockRejectedValueOnce(
      new Error(
        "upstream failed at https://user:secret@indexer.example/api/v3/graphql",
      ),
    );
    await service.resolve(validDid, {
      apiKey: "secret-api-key",
      indexerUrl: "https://user:secret@indexer.example/api/v3/graphql",
    } as ResolveRequestOptions);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "[did-resolver-service] resolve failed",
      expect.objectContaining({
        did: validDid,
        errorCode: "internalError",
        message:
          "upstream failed at https://redacted:redacted@indexer.example/api/v3/graphql",
        options: {
          indexerUrl:
            "https://redacted:redacted@indexer.example/api/v3/graphql",
          indexerWsUrl: undefined,
        },
      }),
    );
    expect(JSON.stringify(logger.error.mock.calls[0])).not.toContain("secret");
  });
});
