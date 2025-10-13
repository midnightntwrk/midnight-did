import { describe, expect, it } from "vitest";

import {
  KnownDIDMediaTypesSchema,
  parseDID,
  parseDIDDocument,
  parseDIDKeyID,
  parseDIDResolutionResult,
  parseDIDURL,
  parseService,
  parseVerificationMethod,
  parseVerificationMethodRelation,
  parseVerificationMethodType,
  VerificationMethodType,
} from "../did-document";
import {
  exampleDid,
  exampleDidUrl,
  exampleMethodId,
  exampleResolutionPayload,
  exampleServiceInput,
  exampleVerificationMethodInput,
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
    expect(parseDIDKeyID("#rel-key" as const)).toBe("#rel-key");
    expect(() => parseDIDKeyID(exampleDid)).toThrow();
    expect(() => parseDIDKeyID("did:example:abc#key?bad")).toThrow();
    expect(() => parseDIDKeyID("not/allowed/path" as const)).toThrow();
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

  it("parses verification method and service helpers", () => {
    expect(parseVerificationMethod(exampleVerificationMethodInput)).toEqual(
      exampleVerificationMethodInput,
    );
    expect(parseService(exampleServiceInput)).toEqual(exampleServiceInput);
    expect(parseVerificationMethodType(VerificationMethodType.JsonWebKey)).toBe(
      VerificationMethodType.JsonWebKey,
    );
    expect(parseVerificationMethodRelation("Authentication")).toBe(
      "Authentication",
    );
  });

  it("parses DID Documents", () => {
    const doc = parseDIDDocument({
      "@context": "https://www.w3.org/ns/did/v1",
      id: exampleDid,
      verificationMethod: [exampleVerificationMethodInput],
      authentication: [exampleVerificationMethodInput.id],
      service: [exampleServiceInput],
    });
    expect(doc.id).toBe(exampleDid);
    expect(doc.authentication).toEqual([exampleVerificationMethodInput.id]);
  });
});
