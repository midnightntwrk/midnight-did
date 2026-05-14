import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import { type ResolverService } from "../service";

describe("did-resolver-service app", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns health endpoint", async () => {
    const service = {
      resolve: vi.fn(),
    } as unknown as ResolverService;
    const app = await createApp(service);
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("resolves DID over GET endpoint", async () => {
    const service = {
      resolve: vi.fn().mockResolvedValue({
        statusCode: 200,
        payload: {
          didDocument: { id: "did:midnight:devnet:abc" },
          didDocumentMetadata: {},
          didResolutionMetadata: {
            contentType: "application/did+ld+json",
            error: null,
          },
        },
      }),
    } as unknown as ResolverService;
    const app = await createApp(service);
    const response = await app.inject({
      method: "GET",
      url: "/resolve/did%3Amidnight%3Adevnet%3Aabc",
    });

    expect(response.statusCode).toBe(200);
    expect(service.resolve).toHaveBeenCalledWith("did:midnight:devnet:abc", {
      indexerUrl: undefined,
      indexerWsUrl: undefined,
    });

    await app.close();
  });

  it("passes indexerUrl overrides from query", async () => {
    const service = {
      resolve: vi.fn().mockResolvedValue({
        statusCode: 200,
        payload: {
          didDocument: { id: "did:midnight:devnet:abc" },
          didDocumentMetadata: {},
          didResolutionMetadata: {
            contentType: "application/did+ld+json",
            error: null,
          },
        },
      }),
    } as unknown as ResolverService;
    const app = await createApp(service);
    const response = await app.inject({
      method: "GET",
      url: "/resolve/did%3Amidnight%3Adevnet%3Aabc?indexerUrl=http%3A%2F%2F127.0.0.1%3A8088%2Fapi%2Fv3%2Fgraphql",
    });

    expect(response.statusCode).toBe(200);
    expect(service.resolve).toHaveBeenCalledWith("did:midnight:devnet:abc", {
      indexerUrl: "http://127.0.0.1:8088/api/v3/graphql",
      indexerWsUrl: undefined,
    });

    await app.close();
  });

  it("resolves DID over POST endpoint", async () => {
    const service = {
      resolve: vi.fn().mockResolvedValue({
        statusCode: 200,
        payload: {
          didDocument: { id: "did:midnight:devnet:abc" },
          didDocumentMetadata: {},
          didResolutionMetadata: {
            contentType: "application/did+ld+json",
            error: null,
          },
        },
      }),
    } as unknown as ResolverService;
    const app = await createApp(service);
    const response = await app.inject({
      method: "POST",
      url: "/resolve",
      payload: {
        did: "did:midnight:devnet:abc",
        indexerUrl: "http://127.0.0.1:8088/api/v3/graphql",
        indexerWsUrl: "ws://127.0.0.1:8088/api/v3/graphql/ws",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(service.resolve).toHaveBeenCalledWith("did:midnight:devnet:abc", {
      indexerUrl: "http://127.0.0.1:8088/api/v3/graphql",
      indexerWsUrl: "ws://127.0.0.1:8088/api/v3/graphql/ws",
    });

    await app.close();
  });

  it("does not mount Swagger docs when docs are disabled", async () => {
    const service = {
      resolve: vi.fn(),
    } as unknown as ResolverService;
    const app = await createApp(service, { docsEnabled: false });
    const response = await app.inject({ method: "GET", url: "/docs" });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it("mounts Swagger docs when docs are enabled", async () => {
    const service = {
      resolve: vi.fn(),
    } as unknown as ResolverService;
    const app = await createApp(service, { docsEnabled: true });
    const response = await app.inject({ method: "GET", url: "/docs" });

    expect([200, 302]).toContain(response.statusCode);

    await app.close();
  });
});
