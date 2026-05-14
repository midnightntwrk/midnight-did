import { describe, expect, it } from "vitest";

import { IndexerEndpointPolicy } from "../indexer-endpoint-policy";
import { ResolverInputError } from "../resolution-errors";

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
    const policy = new IndexerEndpointPolicy(
      {
        indexerHttpUrl: "http://default.example/api/v3/graphql",
        indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
      },
      {
        indexerHttpUrls: ["https://another.example/api/v3/graphql"],
        indexerWsUrls: ["wss://another.example/api/v3/graphql/ws"],
      },
    );

    expect(
      policy.resolve({
        indexerUrl: "https://another.example/api/v3/graphql/",
      }),
    ).toEqual({
      indexerHttpUrl: "https://another.example/api/v3/graphql",
      indexerWsUrl: "wss://another.example/api/v3/graphql/ws",
    });
  });

  it("strips query strings and fragments before allowlist matching", () => {
    const policy = new IndexerEndpointPolicy(
      {
        indexerHttpUrl: "http://default.example/api/v3/graphql",
        indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
      },
      {
        indexerHttpUrls: ["https://another.example/api/v3/graphql"],
      },
    );

    expect(
      policy.resolve({
        indexerUrl:
          "https://another.example/api/v3/graphql?requestId=abc#ignored",
      }),
    ).toEqual({
      indexerHttpUrl: "https://another.example/api/v3/graphql",
      indexerWsUrl: "wss://another.example/api/v3/graphql/ws",
    });
  });

  it("strips URL credentials before allowlist matching", () => {
    const policy = new IndexerEndpointPolicy(
      {
        indexerHttpUrl: "http://default.example/api/v3/graphql",
        indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
      },
      {
        indexerHttpUrls: ["https://another.example/api/v3/graphql"],
      },
    );

    expect(
      policy.resolve({
        indexerUrl: "https://user:pass@another.example/api/v3/graphql",
      }),
    ).toEqual({
      indexerHttpUrl: "https://another.example/api/v3/graphql",
      indexerWsUrl: "wss://another.example/api/v3/graphql/ws",
    });
  });

  it("normalizes explicit ws override", () => {
    const policy = new IndexerEndpointPolicy(
      {
        indexerHttpUrl: "http://default.example/api/v3/graphql",
        indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
      },
      {
        indexerHttpUrls: ["http://another.example/api/v3/graphql"],
        indexerWsUrls: ["ws://override.example/api/v3/graphql/ws"],
      },
    );

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

  it("rejects endpoint overrides that are not allowlisted", () => {
    const policy = new IndexerEndpointPolicy({
      indexerHttpUrl: "http://default.example/api/v3/graphql",
      indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
    });

    expect(() =>
      policy.resolve({
        indexerUrl: "http://169.254.169.254/latest/meta-data",
      }),
    ).toThrow("indexerUrl is not in MIDNIGHT_INDEXER_ALLOWLIST");
    expect(() =>
      policy.resolve({
        indexerUrl: "http://169.254.169.254/latest/meta-data",
      }),
    ).toThrowError(ResolverInputError);
    expect(() =>
      policy.resolve({
        indexerWsUrl: "ws://localhost:6379/api/v3/graphql/ws",
      }),
    ).toThrow("indexerWsUrl is not in MIDNIGHT_INDEXER_ALLOWLIST");
  });

  it.each([
    "http://allowed.example@169.254.169.254/api/v3/graphql",
    "http://user:pass@allowed.example/api/v3/graphql",
    "http://a@b@allowed.example/api/v3/graphql",
    "http://[::1]:8088/api/v3/graphql",
    "http://[::ffff:127.0.0.1]:8088/api/v3/graphql",
    "https://allowed.example//api/v3/graphql",
  ])("rejects URL parser bypass attempt %s", (indexerUrl) => {
    const policy = new IndexerEndpointPolicy(
      {
        indexerHttpUrl: "http://default.example/api/v3/graphql",
        indexerWsUrl: "ws://default.example/api/v3/graphql/ws",
      },
      {
        indexerHttpUrls: ["https://allowed.example/api/v3/graphql"],
      },
    );

    expect(() => policy.resolve({ indexerUrl })).toThrow(
      "indexerUrl is not in MIDNIGHT_INDEXER_ALLOWLIST",
    );
  });
});
