import { describe, expect, it } from "vitest";

import {
  createDIDDocument,
  createService,
  createVerificationMethod,
  CurveType,
  KeyType,
  KnownDIDMediaTypesSchema,
  parseDID,
  parseDIDKeyID,
  parseDIDResolutionResult,
  parseDIDURL,
  VerificationMethodType,
} from "../did-document";

describe("DID Schemas (domain)", () => {
  it("parses valid DID", () => {
    const result = parseDID("did:example:123");
    expect(result).toBe("did:example:123");
  });

  it("rejects invalid DID", () => {
    expect(() => parseDID("not-a-did")).toThrow();
  });

  it("parses valid DID URL", () => {
    const result = parseDIDURL("did:example:123/path?query#frag");
    expect(result).toBe("did:example:123/path?query#frag");
  });

  it("rejects malformed DID URL", () => {
    expect(() => parseDIDURL("http://example.com")).toThrow();
  });

  it("creates and validates VerificationMethod", () => {
    const vm = createVerificationMethod({
      id: "did:example:123#key-1",
      type: VerificationMethodType.JsonWebKey,
      controller: "did:example:123",
      publicKeyJwk: {
        kty: KeyType.EC,
        crv: CurveType.ed25519,
        x: "AA",
        y: "AA",
      },
    });
    expect(vm.id).toBe("did:example:123#key-1");
  });

  it("creates and validates Service", () => {
    const service = createService({
      id: "did:example:123#svc-1",
      type: "LinkedDomains",
      serviceEndpoint: "https://example.com",
    });
    expect(service.id).toBe("did:example:123#svc-1");
  });

  it("creates and validates DIDDocument", () => {
    const doc = createDIDDocument({
      id: "did:example:123",
      context: "https://www.w3.org/ns/did/v1",
      verificationMethod: [
        createVerificationMethod({
          id: "did:example:123#key-1",
          type: VerificationMethodType.JsonWebKey,
          controller: "did:example:123",
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.ed25519,
            x: "AA",
            y: "AA",
          },
        }),
      ],
    });
    expect(doc.id).toBe("did:example:123");
  });

  it("parses full DIDResolutionResult", () => {
    const result = parseDIDResolutionResult({
      "@context": "https://w3id.org/did-resolution/v1",
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: "application/did+json",
      },
    });
    expect(result.didResolutionMetadata.contentType).toBe(
      "application/did+json",
    );
  });

  it("rejects unknown media type", () => {
    expect(() =>
      parseDIDResolutionResult({
        "@context": "https://w3id.org/did-resolution/v1",
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: "application/unknown",
        },
      }),
    ).toThrow();
  });

  it("accepts all KnownDIDMediaTypes", () => {
    const allKnownTypes = Object.values(KnownDIDMediaTypesSchema.def.entries);
    for (const type of allKnownTypes) {
      expect(KnownDIDMediaTypesSchema.parse(type)).toBe(type as any);
    }
  });

  it("validates DID URL with and without fragments correctly", () => {
    expect(parseDIDURL("did:example:xyz/path?query#frag")).toBe(
      "did:example:xyz/path?query#frag",
    );
    expect(() => parseDIDURL("example:xyz#key-1")).toThrow();
  });

  it("rejects invalid DID string shapes and accepts valid ones", () => {
    expect(() => parseDID("did:ex")).toThrow();
    expect(() => parseDID("did:example:abc#frag")).toThrow();
    expect(parseDID("did:example:abc")).toBe("did:example:abc");
  });

  it("parses and rejects DID Key IDs depending on fragment presence", () => {
    expect(parseDIDKeyID("did:example:abc#key-1")).toBe(
      "did:example:abc#key-1",
    );
    expect(() => parseDIDKeyID("did:example:abc")).toThrow();
    expect(() => parseDIDKeyID("did:example:abc#key?bad")).toThrow();
  });

  it("validates PublicKeyJwk x/y as base64url strings", () => {
    const vm = createVerificationMethod({
      id: "did:example:123#key-1",
      type: VerificationMethodType.JsonWebKey,
      controller: "did:example:123",
      publicKeyJwk: {
        kty: KeyType.EC,
        crv: CurveType.ed25519,
        x: "AA",
        y: "AQ",
      },
    });
    expect(vm.publicKeyJwk.x).toBe("AA");
    expect(() =>
      createVerificationMethod({
        id: "did:example:123#key-2",
        type: VerificationMethodType.JsonWebKey,
        controller: "did:example:123",
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.ed25519,
          x: "+A/",
          y: "AA",
        },
      }),
    ).toThrow();
  });

  it("creates DIDDocument with optional arrays and nullish fields", () => {
    const doc = createDIDDocument({
      id: "did:example:xyz",
      context: ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/v2"],
      alsoKnownAs: ["did:alias:one", "did:alias:two"],
      controller: ["did:example:ctrl1", "did:example:ctrl2"],
      verificationMethod: [],
      authentication: ["did:example:xyz#key-1"],
      assertionMethod: ["did:example:xyz#key-2"],
      keyAgreement: [],
      capabilityInvocation: [],
      capabilityDelegation: [],
      service: [],
    });
    expect(
      Array.isArray(doc["@context"]) || typeof doc["@context"] === "string",
    ).toBe(true);
    expect(doc.alsoKnownAs?.length).toBe(2);
    expect(Array.isArray(doc.controller)).toBe(true);
    expect(doc.authentication?.[0]).toBe("did:example:xyz#key-1");
    expect(doc.assertionMethod?.[0]).toBe("did:example:xyz#key-2");
  });
});
