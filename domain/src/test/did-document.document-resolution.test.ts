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
  exampleResolutionPayload,
  exampleServiceInput,
  exampleVerificationMethodInput,
} from "./fixtures/did";

describe("DID document construction", () => {
  it("creates and validates a Service", () => {
    const service = createService(exampleServiceInput);
    expect(service.id).toBe(exampleServiceInput.id);
    expect(service.serviceEndpoint).toBe(exampleServiceInput.serviceEndpoint);
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
