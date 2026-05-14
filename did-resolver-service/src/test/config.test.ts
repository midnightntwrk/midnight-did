import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../config";

describe("did-resolver-service config", () => {
  it("loads defaults", () => {
    const cfg = loadConfig({});
    expect(cfg).toEqual({
      host: "127.0.0.1",
      port: 3001,
      indexerHttpUrl: "http://127.0.0.1:8088/api/v3/graphql",
      indexerWsUrl: "ws://127.0.0.1:8088/api/v3/graphql/ws",
      allowedIndexerHttpUrls: [],
      allowedIndexerWsUrls: [],
      expectedNetwork: null,
      requestTimeoutMs: 10000,
      docsEnabled: true,
      debug: false,
    });
  });

  it("parses configured values including network", () => {
    const cfg = loadConfig({
      RESOLVER_HOST: "0.0.0.0",
      RESOLVER_PORT: "13001",
      MIDNIGHT_INDEXER_HTTP_URL: "https://indexer.example/api/v3/graphql",
      MIDNIGHT_INDEXER_WS_URL: "wss://indexer.example/api/v3/graphql/ws",
      MIDNIGHT_INDEXER_ALLOWLIST:
        "https://allow.example/api/v3/graphql,wss://ws-allow.example/api/v3/graphql/ws",
      MIDNIGHT_NETWORK: "PreProd",
      RESOLVER_REQUEST_TIMEOUT_MS: "2500",
      RESOLVER_DOCS_ENABLED: "false",
      RESOLVER_DEBUG: "true",
    });

    expect(cfg.host).toBe("0.0.0.0");
    expect(cfg.port).toBe(13001);
    expect(cfg.indexerHttpUrl).toBe("https://indexer.example/api/v3/graphql");
    expect(cfg.indexerWsUrl).toBe("wss://indexer.example/api/v3/graphql/ws");
    expect(cfg.allowedIndexerHttpUrls).toEqual([
      "https://allow.example/api/v3/graphql",
    ]);
    expect(cfg.allowedIndexerWsUrls).toEqual([
      "wss://allow.example/api/v3/graphql/ws",
      "wss://ws-allow.example/api/v3/graphql/ws",
    ]);
    expect(cfg.expectedNetwork).toBe(MidnightNetwork.Preprod);
    expect(cfg.requestTimeoutMs).toBe(2500);
    expect(cfg.docsEnabled).toBe(false);
    expect(cfg.debug).toBe(true);
  });

  it("disables docs by default in production", () => {
    const cfg = loadConfig({
      NODE_ENV: "production",
      MIDNIGHT_INDEXER_HTTP_URL: "https://indexer.example/api/v3/graphql",
      MIDNIGHT_INDEXER_WS_URL: "wss://indexer.example/api/v3/graphql/ws",
    });
    expect(cfg.docsEnabled).toBe(false);
  });

  it("requires explicit indexer urls in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(
      "MIDNIGHT_INDEXER_HTTP_URL is required when NODE_ENV=production",
    );
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        MIDNIGHT_INDEXER_HTTP_URL: "https://indexer.example/api/v3/graphql",
      }),
    ).toThrow("MIDNIGHT_INDEXER_WS_URL is required when NODE_ENV=production");
  });

  it("fails on unsupported network", () => {
    expect(() =>
      loadConfig({
        MIDNIGHT_NETWORK: "unknown",
      }),
    ).toThrow("Invalid MIDNIGHT_NETWORK value");
  });

  it("fails on invalid resolver port", () => {
    expect(() =>
      loadConfig({
        RESOLVER_PORT: "70000",
      }),
    ).toThrow("Invalid RESOLVER_PORT value");
    expect(() =>
      loadConfig({
        RESOLVER_REQUEST_TIMEOUT_MS: "0",
      }),
    ).toThrow("Invalid RESOLVER_REQUEST_TIMEOUT_MS value");
    expect(() =>
      loadConfig({
        RESOLVER_DOCS_ENABLED: "sometimes",
      }),
    ).toThrow("Invalid boolean value");
  });

  it("fails on invalid indexer urls", () => {
    expect(() =>
      loadConfig({
        MIDNIGHT_INDEXER_HTTP_URL: "ftp://indexer.example/graphql",
      }),
    ).toThrow("Invalid MIDNIGHT_INDEXER_HTTP_URL value");
    expect(() =>
      loadConfig({
        MIDNIGHT_INDEXER_WS_URL: "http://indexer.example/graphql/ws",
      }),
    ).toThrow("Invalid MIDNIGHT_INDEXER_WS_URL value");
    expect(() =>
      loadConfig({
        MIDNIGHT_INDEXER_ALLOWLIST: "file:///tmp/socket",
      }),
    ).toThrow("Invalid MIDNIGHT_INDEXER_ALLOWLIST value");
  });
});
