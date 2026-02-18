import { describe, expect, it } from "vitest";

import {
  normalizeServiceEndpointValue,
  normalizeUriString,
} from "../uri-normalization";

describe("URI normalization helpers", () => {
  it("normalizes HTTP(S) URIs", () => {
    expect(
      normalizeUriString("HTTPS://Example.COM:443/path/../home?query=1#Frag"),
    ).toBe("https://example.com/home?query=1#Frag");
    expect(normalizeUriString("http://Example.com:80/")).toBe(
      "http://example.com/",
    );
  });

  it("leaves non-HTTP schemes unchanged", () => {
    const did = "did:example:123456";
    expect(normalizeUriString(did)).toBe(did);
  });

  it("normalizes nested service endpoint structures", () => {
    const endpoint = {
      uri: "HTTPS://Example.COM:443/a/../b",
      routingKeys: ["did:example:mediator"],
      nested: [{ uri: "wSs://Sample.org:443/socket" }],
    };
    expect(normalizeServiceEndpointValue(endpoint)).toEqual({
      uri: "https://example.com/b",
      routingKeys: ["did:example:mediator"],
      nested: [{ uri: "wss://sample.org/socket" }],
    });
  });

  it("normalizes arrays of endpoints", () => {
    const endpoints = [
      "HTTPS://Example.com:443/inbox",
      { uri: "Ws://Example.org:80/updates" },
    ];
    expect(normalizeServiceEndpointValue(endpoints)).toEqual([
      "https://example.com/inbox",
      { uri: "ws://example.org/updates" },
    ]);
  });

  it("removes default HTTP port 80", () => {
    expect(normalizeUriString("http://example.com:80/path")).toBe(
      "http://example.com/path",
    );
  });

  it("removes default WS port 80", () => {
    expect(normalizeUriString("ws://example.com:80/socket")).toBe(
      "ws://example.com/socket",
    );
  });

  it("keeps non-default ports", () => {
    expect(normalizeUriString("http://example.com:8080/path")).toBe(
      "http://example.com:8080/path",
    );
    expect(normalizeUriString("https://example.com:8443/path")).toBe(
      "https://example.com:8443/path",
    );
  });

  it("handles malformed URLs gracefully", () => {
    const malformed = "http://[invalid";
    expect(normalizeUriString(malformed)).toBe(malformed);
  });

  it("handles URLs with authentication", () => {
    expect(normalizeUriString("HTTPS://user:pass@Example.COM:443/path")).toBe(
      "https://user:pass@example.com/path",
    );
    expect(normalizeUriString("HTTPS://user@Example.COM:443/path")).toBe(
      "https://user@example.com/path",
    );
  });

  it("preserves trailing slash when present in original URL", () => {
    expect(normalizeUriString("https://example.com/path/")).toBe(
      "https://example.com/path/",
    );
  });

  it("normalizes primitive values correctly", () => {
    expect(normalizeServiceEndpointValue(null)).toBe(null);
    expect(normalizeServiceEndpointValue(undefined)).toBe(undefined);
    expect(normalizeServiceEndpointValue(123)).toBe(123);
    expect(normalizeServiceEndpointValue(true)).toBe(true);
  });

  it("normalizes nested objects with primitive values", () => {
    const complex = {
      uri: "HTTPS://Example.com/api",
      count: 42,
      active: true,
      metadata: null,
    };
    expect(normalizeServiceEndpointValue(complex)).toEqual({
      uri: "https://example.com/api",
      count: 42,
      active: true,
      metadata: null,
    });
  });
});
