import { describe, expect, it } from "vitest";

import {
  assertAbsoluteUri,
  normalizeBoundDIDURL,
  normalizeBoundFragmentId,
  normalizeFragmentId,
  serviceEndpointToLedger,
  serviceTypeToLedger,
} from "../ledger-utils.js";

describe("ledger-utils", () => {
  const did =
    "did:midnight:testnet:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  it("normalizes fragments", () => {
    expect(normalizeFragmentId("key-1")).toBe("#key-1");
    expect(normalizeFragmentId("#key-1")).toBe("#key-1");
    expect(normalizeFragmentId(`${did}#key-1`)).toBe("#key-1");
    expect(normalizeFragmentId("/services/a#key-1#alias")).toBe("#alias");
  });

  it("resolves bound references without losing URL components", () => {
    expect(normalizeBoundFragmentId("key-1", "methodId", did)).toBe(
      `${did}#key-1`,
    );
    expect(normalizeBoundFragmentId("#key-1", "methodId", did)).toBe(
      `${did}#key-1`,
    );
    expect(normalizeBoundFragmentId(`${did}#key-1`, "methodId", did)).toBe(
      `${did}#key-1`,
    );
    expect(
      normalizeBoundFragmentId("/services/a#key-1", "service.id", did),
    ).toBe(`${did}/services/a#key-1`);
    expect(normalizeBoundDIDURL("?service=messaging", "service.id", did)).toBe(
      `${did}?service=messaging`,
    );
    expect(
      normalizeBoundDIDURL("https://example.com/service", "service.id", did),
    ).toBe("https://example.com/service");
    expect(() => normalizeBoundFragmentId("#", "service.id", did)).toThrow(
      /non-empty fragment/,
    );
    expect(() =>
      normalizeBoundFragmentId("/services/a#", "service.id", did),
    ).toThrow(/non-empty fragment/);
  });

  it("rejects did url bound to a different did subject", () => {
    expect(() =>
      normalizeBoundFragmentId(
        "did:midnight:testnet:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#k",
        "methodId",
        did,
      ),
    ).toThrow(/must match the current DID/);
  });

  it("normalizes and serializes service values", () => {
    expect(serviceTypeToLedger(" Messaging ")).toBe("Messaging");
    expect(serviceTypeToLedger(["A", "B"])).toBe(JSON.stringify(["A", "B"]));
    expect(serviceEndpointToLedger("https://example.com/path")).toBe(
      JSON.stringify("https://example.com/path"),
    );
    expect(
      serviceEndpointToLedger([
        "https://example.com",
        "https://EXAMPLE.com:443",
      ]),
    ).toBe(JSON.stringify(["https://example.com", "https://example.com"]));
  });

  it("validates absolute alias uri", () => {
    expect(assertAbsoluteUri("https://example.com", "aliasUri")).toBe(
      "https://example.com",
    );
    expect(() => assertAbsoluteUri("not a uri", "aliasUri")).toThrow(
      /valid absolute URI/,
    );
  });
});
