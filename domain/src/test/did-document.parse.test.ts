import { describe, expect, it } from "vitest";

import {
  DIDDocumentMetadataSchema,
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
  exampleServiceObjectInput,
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
    expect(parseService(exampleServiceObjectInput)).toEqual(
      exampleServiceObjectInput,
    );
    expect(parseVerificationMethodType(VerificationMethodType.JsonWebKey)).toBe(
      VerificationMethodType.JsonWebKey,
    );
    expect(parseVerificationMethodRelation("Authentication")).toBe(
      "Authentication",
    );
  });

  it("parses DID Documents with array @context", () => {
    const doc = parseDIDDocument({
      "@context": ["https://www.w3.org/ns/did/v1"],
      id: exampleDid,
      verificationMethod: [exampleVerificationMethodInput],
      authentication: [exampleVerificationMethodInput.id],
      service: [exampleServiceInput],
    });
    expect(doc.id).toBe(exampleDid);
    expect(doc.authentication).toEqual([exampleVerificationMethodInput.id]);
  });

  it("parses DID Documents with string @context (W3C DID Core compliant)", () => {
    const doc = parseDIDDocument({
      "@context": "https://www.w3.org/ns/did/v1",
      id: exampleDid,
      verificationMethod: [exampleVerificationMethodInput],
      authentication: [exampleVerificationMethodInput.id],
    });
    expect(doc.id).toBe(exampleDid);
    expect(doc["@context"]).toBe("https://www.w3.org/ns/did/v1");
  });

  it("rejects DID Documents with empty verification relationship arrays", () => {
    expect(() =>
      parseDIDDocument({
        "@context": "https://www.w3.org/ns/did/v1",
        id: exampleDid,
        verificationMethod: [exampleVerificationMethodInput],
        authentication: [],
      }),
    ).toThrow();
  });

  it("accepts relative relation references when verificationMethod ids are absolute DID URLs", () => {
    const vmId = `${exampleDid}#key-1`;
    const doc = parseDIDDocument({
      "@context": "https://www.w3.org/ns/did/v1",
      id: exampleDid,
      verificationMethod: [
        {
          ...exampleVerificationMethodInput,
          id: vmId,
        },
      ],
      authentication: ["#key-1"],
    });
    expect(doc.verificationMethod?.[0].id).toBe(vmId);
    expect(doc.authentication).toEqual(["#key-1"]);
  });

  it("accepts URI aliases in alsoKnownAs", () => {
    const doc = parseDIDDocument({
      "@context": "https://www.w3.org/ns/did/v1",
      id: exampleDid,
      alsoKnownAs: ["https://example.com/aka", "did:example:aka-1"],
    });
    expect(doc.alsoKnownAs).toEqual([
      "https://example.com/aka",
      "did:example:aka-1",
    ]);
  });

  it("validates DID metadata timestamps", () => {
    const metadata = DIDDocumentMetadataSchema.parse({
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T12:30:05Z",
      deactivated: false,
    });
    expect(metadata.created).toBe("2024-01-01T00:00:00Z");
    expect(metadata.updated).toBe("2024-01-02T12:30:05Z");
  });

  it("rejects metadata timestamps with sub-second precision", () => {
    expect(() =>
      DIDDocumentMetadataSchema.parse({
        created: "2024-01-01T00:00:00.123Z",
      }),
    ).toThrow(/Invalid input|datetime/);
  });
});
