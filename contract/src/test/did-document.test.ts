// Combined Test Suite: did-document.test.ts + did-document2.test.ts

import { describe, expect, it } from "vitest";

import {
  createDIDDocument,
  createService,
  createVerificationMethod,
  CurveType,
  KeyType,
  KnownDIDMediaTypesSchema,
  parseDID,
  parseDIDResolutionResult,
  parseDIDURL,
  VerificationMethodType
} from "../did-document";

describe("DID Schemas", () => {
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
        x: 0n,
        y: 0n
      }
    });
    expect(vm.id).toBe("did:example:123#key-1");
  });

  it("creates and validates Service", () => {
    const service = createService({
      id: "did:example:123#svc-1",
      type: "LinkedDomains",
      serviceEndpoint: "https://example.com"
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
            x: 0n,
            y: 0n
          }
        })
      ]
    });
    expect(doc.id).toBe("did:example:123");
  });

  it("parses full DIDResolutionResult", () => {
    const result = parseDIDResolutionResult({
      "@context": "https://w3id.org/did-resolution/v1",
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: "application/did+json"
      }
    });
    expect(result.didResolutionMetadata.contentType).toBe(
      "application/did+json"
    );
  });

  it("rejects unknown media type", () => {
    expect(() =>
      parseDIDResolutionResult({
        "@context": "https://w3id.org/did-resolution/v1",
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: "application/unknown"
        }
      })
    ).toThrow();
  });

  it("accepts all KnownDIDMediaTypes", () => {
    const allKnownTypes = Object.values(KnownDIDMediaTypesSchema.def.entries);

    for (const type of allKnownTypes) {
      expect(KnownDIDMediaTypesSchema.parse(type)).toBe(type);
    }
  });
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
        x: 0n,
        y: 0n
      }
    });
    expect(vm.id).toBe("did:example:123#key-1");
  });

  it("creates and validates Service", () => {
    const service = createService({
      id: "did:example:123#svc-1",
      type: "LinkedDomains",
      serviceEndpoint: "https://example.com"
    });
    expect(service.id).toBe("did:example:123#svc-1");
  });

  it("creates and validates DIDDocument", () => {
    const doc = createDIDDocument({
      id: "did:example:123",
      context: "https://www.w3.org/ns/did/v1",
      alsoKnownAs: undefined,
      controller: undefined,
      verificationMethod: [
        createVerificationMethod({
          id: "did:example:123#key-1",
          type: VerificationMethodType.JsonWebKey,
          controller: "did:example:123",
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.ed25519,
            x: 0n,
            y: 0n
          }
        })
      ]
    });
    expect(doc.id).toBe("did:example:123");
  });

  it("parses full DIDResolutionResult", () => {
    const result = parseDIDResolutionResult({
      "@context": "https://w3id.org/did-resolution/v1",
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: "application/did+json"
      }
    });
    expect(result.didResolutionMetadata.contentType).toBe(
      "application/did+json"
    );
  });

  it("rejects unknown media type", () => {
    expect(() =>
      parseDIDResolutionResult({
        "@context": "https://w3id.org/did-resolution/v1",
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: "application/unknown"
        }
      })
    ).toThrow();
  });

  it("accepts all KnownDIDMediaTypes", () => {
    const allKnownTypes = Object.values(KnownDIDMediaTypesSchema.def.entries);

    for (const type of allKnownTypes) {
      expect(KnownDIDMediaTypesSchema.parse(type)).toBe(type);
    }
  });

  it("parses string and string[] in controller field", () => {
    const single = createDIDDocument({
      id: "did:example:123",
      controller: "did:example:controller1"
    });
    expect(single.controller).toBe("did:example:controller1");

    const multiple = createDIDDocument({
      id: "did:example:123",
      controller: ["did:example:controller1", "did:example:controller2"]
    });
    expect(Array.isArray(multiple.controller)).toBe(true);
    expect(multiple.controller).toHaveLength(2);
  });

  it("parses string and string[] in service type", () => {
    const single = createService({
      id: "did:example:123#svc",
      type: "LinkedDomains",
      serviceEndpoint: "https://example.com"
    });
    expect(single.type).toBe("LinkedDomains");

    const multiple = createService({
      id: "did:example:123#svc",
      type: ["LinkedDomains", "Messaging"],
      serviceEndpoint: "https://example.com"
    });
    expect(Array.isArray(multiple.type)).toBe(true);
    expect(multiple.type).toContain("Messaging");
  });

  it("accepts nullish optional fields", () => {
    const doc = createDIDDocument({
      id: "did:example:abc",
      context: "https://w3id.org/did/v1",
      alsoKnownAs: undefined,
      controller: undefined,
      verificationMethod: undefined,
      authentication: undefined,
      assertionMethod: undefined,
      keyAgreement: undefined,
      capabilityInvocation: undefined,
      capabilityDelegation: undefined,
      service: undefined
    });

    expect(doc.id).toBe("did:example:abc");
    expect(doc.service).toBeNull();
    expect(doc.verificationMethod).toBeNull();
  });
});
