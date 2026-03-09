import { describe, expect, it } from "vitest";

import { IndexerEndpointPolicy } from "../indexer-endpoint-policy";

describe("did-resolver-service indexer endpoint policy", () => {
  it("uses defaults when no overrides provided", () => {
    const policy = new IndexerEndpointPolicy({
      indexerHttpUrl: "http://default.example/api/v3/graphql",
      indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
    });

    expect(policy.resolve()).toEqual({
      indexerHttpUrl: "http://default.example/api/v3/graphql",
      indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
    });
  });

  it("normalizes and derives ws url from http override", () => {
    const policy = new IndexerEndpointPolicy({
      indexerHttpUrl: "http://default.example/api/v3/graphql",
      indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
    });

    expect(
      policy.resolve({
        indexerUrl: "https://another.example/api/v3/graphql/",
      }),
    ).toEqual({
      indexerHttpUrl: "https://another.example/api/v3/graphql",
      indexerWsUrl: "wss://another.example/api/v3/graphql/ws",
    });
  });

  it("normalizes explicit ws override", () => {
    const policy = new IndexerEndpointPolicy({
      indexerHttpUrl: "http://default.example/api/v3/graphql",
      indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
    });

    expect(
      policy.resolve({
        indexerUrl: "http://another.example/api/v3/graphql/",
        indexerWsUrl: "ws://override.example/api/v3/graphql/ws/",
      }),
    ).toEqual({
      indexerHttpUrl: "http://another.example/api/v3/graphql",
      indexerWsUrl: "ws://override.example/api/v3/graphql/ws",
    });
  });

  it("fails on invalid protocols", () => {
    const policy = new IndexerEndpointPolicy({
      indexerHttpUrl: "http://default.example/api/v3/graphql",
      indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
    });

    expect(() =>
      policy.resolve({ indexerUrl: "ftp://example.com/graphql" }),
    ).toThrow("indexerUrl must use http or https");
    expect(() =>
      policy.resolve({ indexerWsUrl: "http://example.com/graphql/ws" }),
    ).toThrow("indexerWsUrl must use ws or wss");
  });
});
