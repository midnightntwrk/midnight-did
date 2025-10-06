import { describe, expect, it } from "vitest";

import {
  KnownDIDMediaTypesSchema,
  parseDID,
  parseDIDKeyID,
  parseDIDResolutionResult,
  parseDIDURL,
} from "../did-document";
import {
  exampleDid,
  exampleDidUrl,
  exampleMethodId,
  exampleResolutionPayload,
  invalidDidStrings,
} from "./fixtures/did";

describe("DID parsing utilities", () => {
  it("parses valid DID", () => {
    expect(parseDID(exampleDid)).toBe(exampleDid);
  });

  it("rejects invalid DID strings", () => {
    for (const candidate of invalidDidStrings) {
      expect(() => parseDID(candidate)).toThrow();
    }
  });

  it("parses valid DID URL", () => {
    expect(parseDIDURL(exampleDidUrl)).toBe(exampleDidUrl);
  });

  it("rejects malformed DID URLs", () => {
    expect(() => parseDIDURL("http://example.com")).toThrow();
  });

  it("parses and validates DID Key IDs", () => {
    expect(parseDIDKeyID(exampleMethodId)).toBe(exampleMethodId);
    expect(() => parseDIDKeyID(exampleDid)).toThrow();
    expect(() => parseDIDKeyID("did:example:abc#key?bad")).toThrow();
  });

  it("accepts all known DID media types", () => {
    const entries = Object.values(
      KnownDIDMediaTypesSchema.def.entries,
    ) as string[];
    for (const type of entries) {
      expect(KnownDIDMediaTypesSchema.parse(type)).toBe(type);
    }
  });

  it("rejects unknown resolution media type", () => {
    expect(() =>
      parseDIDResolutionResult({
        ...exampleResolutionPayload,
        didResolutionMetadata: { contentType: "application/unknown" },
      }),
    ).toThrow();
  });
});
