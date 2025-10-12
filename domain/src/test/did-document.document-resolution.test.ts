import { describe, expect, it } from "vitest";

import {
  createDIDDocument,
  createService,
  createVerificationMethod,
  parseDIDResolutionResult,
} from "../did-document";
import {
  exampleDid,
  exampleEcJsonWebKey,
  examplePathServiceInput,
  exampleRelativeServiceInput,
  exampleResolutionPayload,
  exampleSegmentServiceInput,
  exampleServiceInput,
  exampleVerificationMethodInput,
} from "./fixtures/did";

describe("DID document construction", () => {
  it("creates and validates a Service", () => {
    const service = createService(exampleServiceInput);
    expect(service.id).toBe(exampleServiceInput.id);
    expect(service.serviceEndpoint).toBe(exampleServiceInput.serviceEndpoint);
  });

  it("accepts fragment-only service identifiers", () => {
    const service = createService(exampleRelativeServiceInput);
    expect(service.id).toBe(exampleRelativeServiceInput.id);
  });

  it("accepts relative path service identifiers", () => {
    const service = createService(examplePathServiceInput);
    expect(service.id).toBe(examplePathServiceInput.id);
  });

  it("accepts relative segment service identifiers", () => {
    const service = createService(exampleSegmentServiceInput);
    expect(service.id).toBe(exampleSegmentServiceInput.id);
  });

  it("rejects non-DID absolute service identifiers", () => {
    expect(() =>
      createService({
        id: "https://example.com/service",
        type: "LinkedDomains",
        serviceEndpoint: "https://example.com/service",
      }),
    ).toThrow();
  });

  it("accepts multiple service endpoints", () => {
    const service = createService({
      id: `${exampleDid}#svc-multi`,
      type: "DIDCommV2",
      serviceEndpoint: [
        "https://example.com/didcomm",
        "wss://example.com/didcomm",
      ],
    });
    expect(Array.isArray(service.serviceEndpoint)).toBe(true);
    expect(service.serviceEndpoint).toHaveLength(2);
  });

  it("rejects invalid service endpoints", () => {
    expect(() =>
      createService({
        id: `${exampleDid}#svc-invalid`,
        type: "DIDCommV2",
        serviceEndpoint: "not-a-uri",
      }),
    ).toThrow(/Invalid URI/);
  });

  it("creates a DID Document with a verification method", () => {
    const verificationMethod = createVerificationMethod(
      exampleVerificationMethodInput,
    );
    const document = createDIDDocument({
      id: exampleDid,
      context: "https://www.w3.org/ns/did/v1",
      verificationMethod: [verificationMethod],
    });
    expect(document.id).toBe(exampleDid);
    expect(document.verificationMethod?.[0]).toEqual(verificationMethod);
  });

  it("accepts EC verification method with retained y coordinate", () => {
    const verificationMethod = createVerificationMethod({
      ...exampleVerificationMethodInput,
      id: `${exampleDid}#key-ec`,
      publicKeyJwk: exampleEcJsonWebKey,
    });
    const document = createDIDDocument({
      id: exampleDid,
      context: "https://www.w3.org/ns/did/v1",
      verificationMethod: [verificationMethod],
    });
    const inserted = document.verificationMethod?.find(
      (vm) => vm.id === verificationMethod.id,
    );
    expect(inserted?.publicKeyJwk).toEqual(exampleEcJsonWebKey);
  });
});

describe("DID resolution payloads", () => {
  it("parses valid DIDResolutionResult", () => {
    const payload = parseDIDResolutionResult(exampleResolutionPayload);
    expect(payload.didResolutionMetadata.contentType).toBe(
      exampleResolutionPayload.didResolutionMetadata.contentType,
    );
  });
});
