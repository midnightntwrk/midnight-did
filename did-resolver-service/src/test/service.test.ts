import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveResultMock = vi.fn();
const queryContractStateMock = vi.fn();
const ledgerFromStateMock = vi.fn();
const resolverCtorMock = vi.fn();
const providerFactoryMock = vi.fn();

vi.mock("@midnight-ntwrk/midnight-did", () => {
  class MidnightDIDResolver {
    constructor(options: unknown) {
      resolverCtorMock(options);
    }

    resolveResult = resolveResultMock;
  }

  return {
    MidnightDIDResolver,
    MidnightNetwork: {
      DevNet: "devnet",
      Testnet: "testnet",
    },
  };
});

vi.mock("@midnight-ntwrk/midnight-js-indexer-public-data-provider", () => ({
  indexerPublicDataProvider: (...args: unknown[]) => {
    providerFactoryMock(...args);
    return {
      queryContractState: queryContractStateMock,
    };
  },
}));

vi.mock("@midnight-ntwrk/midnight-did-contract", () => ({
  DIDContract: {
    ledger: (...args: unknown[]) => ledgerFromStateMock(...args),
  },
}));

import { RESOLVER_CACHE_MAX_SIZE, ResolverService } from "../service";

describe("did-resolver-service service", () => {
  beforeEach(() => {
    resolveResultMock.mockReset();
    queryContractStateMock.mockReset();
    ledgerFromStateMock.mockReset();
    resolverCtorMock.mockClear();
    providerFactoryMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns resolved DID document with DID content type", async () => {
    resolveResultMock.mockResolvedValue({
      didDocument: { id: "did:midnight:devnet:abc" },
      didDocumentMetadata: { versionId: "1" },
      didResolutionMetadata: { error: null },
    });

    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
    });

    const result = await service.resolve("did:midnight:devnet:abc");
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

    const result = await service.resolve("did:midnight:devnet:abc");
    expect(result.statusCode).toBe(200);
    expect(result.payload.didResolutionMetadata.error).toBe("notFound");
  });

  it("derives ws indexer URL from provided http override", async () => {
    resolveResultMock.mockResolvedValue(null);
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      allowedIndexerHttpUrls: ["https://another.example/api/v3/graphql"],
    });

    await service.resolve("did:midnight:devnet:abc", {
      indexerUrl: "https://another.example/api/v3/graphql",
    });

    expect(providerFactoryMock).toHaveBeenCalledWith(
      "https://another.example/api/v3/graphql",
      "wss://another.example/api/v3/graphql/ws",
    );
  });

  it("rejects unallowlisted indexer overrides before provider creation", async () => {
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
    });

    const result = await service.resolve("did:midnight:devnet:abc", {
      indexerUrl: "http://169.254.169.254/latest/meta-data",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.didResolutionMetadata.error).toBe("invalidDid");
    expect(providerFactoryMock).not.toHaveBeenCalled();
  });

  it("reuses resolver instances for same endpoint pair", async () => {
    resolveResultMock.mockResolvedValue(null);
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
    });

    await service.resolve("did:midnight:devnet:abc");
    await service.resolve("did:midnight:devnet:def");

    expect(resolverCtorMock).toHaveBeenCalledTimes(1);
  });

  it("evicts least recently used resolver when cache size is exceeded", async () => {
    resolveResultMock.mockResolvedValue(null);
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      allowedIndexerHttpUrls: Array.from(
        { length: RESOLVER_CACHE_MAX_SIZE + 1 },
        (_value, index) => `http://idx-${index}.example/api/v3/graphql`,
      ),
    });

    for (let i = 0; i <= RESOLVER_CACHE_MAX_SIZE; i += 1) {
      await service.resolve("did:midnight:devnet:abc", {
        indexerUrl: `http://idx-${i}.example/api/v3/graphql`,
      });
    }

    expect(resolverCtorMock).toHaveBeenCalledTimes(RESOLVER_CACHE_MAX_SIZE + 1);

    await service.resolve("did:midnight:devnet:abc", {
      indexerUrl: "http://idx-0.example/api/v3/graphql",
    });

    expect(resolverCtorMock).toHaveBeenCalledTimes(RESOLVER_CACHE_MAX_SIZE + 2);
  });

  it("maps contract state through DIDContract.ledger in resolver reader", async () => {
    resolveResultMock.mockResolvedValue(null);
    queryContractStateMock.mockResolvedValue({ data: { state: "value" } });
    ledgerFromStateMock.mockReturnValue({ ledger: "mapped" });
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
    });

    await service.resolve("did:midnight:devnet:abc");

    const ctorArgs = resolverCtorMock.mock.calls[0]?.[0] as {
      ledgerReader: (address: string) => Promise<unknown>;
    };
    const mappedState = await ctorArgs.ledgerReader("contract-address");
    expect(queryContractStateMock).toHaveBeenCalledWith("contract-address");
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

    resolveResultMock.mockRejectedValueOnce(
      new Error("Invalid Midnight DID format"),
    );
    resolveResultMock.mockRejectedValueOnce(new Error("Network mismatch"));
    resolveResultMock.mockRejectedValueOnce(new Error("boom"));

    const invalidDid = await service.resolve("did:bad");
    const networkMismatch = await service.resolve("did:midnight:devnet:abc");
    const internalError = await service.resolve("did:midnight:devnet:abc");

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

  it("returns an internal error instead of parking slow resolution forever", async () => {
    vi.useFakeTimers();
    resolveResultMock.mockImplementationOnce(
      () => new Promise<never>(() => undefined),
    );
    const service = new ResolverService({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      requestTimeoutMs: 25,
    });

    const resultPromise = service.resolve("did:midnight:devnet:abc");
    await vi.advanceTimersByTimeAsync(25);
    const result = await resultPromise;

    expect(result.statusCode).toBe(500);
    expect(result.payload.didResolutionMetadata.error).toBe("internalError");
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

    resolveResultMock.mockRejectedValueOnce(new Error("boom"));
    await service.resolve("did:midnight:devnet:abc", {
      indexerUrl: "https://user:secret@indexer.example/api/v3/graphql",
    });

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "[did-resolver-service] resolve failed",
      expect.objectContaining({
        did: "did:midnight:devnet:abc",
        errorCode: "internalError",
        message: "boom",
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
