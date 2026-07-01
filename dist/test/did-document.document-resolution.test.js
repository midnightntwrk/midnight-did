import { describe, expect, it } from "vitest";
import { createDIDDocument, createService, createVerificationMethod, parseDIDResolutionResult, parseDIDURL, } from "../did-document.js";
import { exampleDid, exampleEcJsonWebKey, examplePathServiceInput, exampleRelativeServiceInput, exampleResolutionPayload, exampleSegmentServiceInput, exampleServiceInput, exampleServiceObjectInput, exampleServiceSet, exampleVerificationMethodInput, } from "./fixtures/did.js";
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
    it("accepts object service endpoints", () => {
        const service = createService(exampleServiceObjectInput);
        expect(service.serviceEndpoint).toEqual(exampleServiceObjectInput.serviceEndpoint);
    });
    it("creates services for DID Core endpoint variations", () => {
        const services = exampleServiceSet.map(({ service }) => createService({
            ...service,
            serviceEndpoint: Array.isArray(service.serviceEndpoint)
                ? service.serviceEndpoint.map((entry) => typeof entry === "string" ? entry : { ...entry })
                : typeof service.serviceEndpoint === "object"
                    ? { ...service.serviceEndpoint }
                    : service.serviceEndpoint,
        }));
        services.forEach((service, index) => {
            expect(service.id).toBe(exampleServiceSet[index].service.id);
            expect(service.type).toBe(exampleServiceSet[index].service.type);
            expect(service.serviceEndpoint).toEqual(exampleServiceSet[index].expectedEndpoint);
        });
        const document = createDIDDocument({
            id: exampleDid,
            context: "https://www.w3.org/ns/did/v1",
            service: services,
        });
        expect(document.service?.length).toBe(exampleServiceSet.length);
    });
    it("rejects non-DID absolute service identifiers", () => {
        expect(() => createService({
            id: "https://example.com/service",
            type: "LinkedDomains",
            serviceEndpoint: "https://example.com/service",
        })).toThrow();
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
    it("reports duplicate service endpoints", () => {
        try {
            createDIDDocument({
                id: exampleDid,
                service: [
                    {
                        id: parseDIDURL(`${exampleDid}#svc-dup`),
                        type: "DIDCommV2",
                        serviceEndpoint: [
                            "https://example.com/didcomm",
                            "https://example.com/didcomm",
                        ],
                    },
                ],
            });
            throw new Error("Expected duplicate serviceEndpoint error");
        }
        catch (error) {
            expect(error).toBeInstanceOf(Error);
            const err = error;
            expect(err.message).toMatch(/serviceEndpoint values must be unique/);
            expect(err.issues?.[0]?.message).toBe("serviceEndpoint values must be unique");
        }
    });
    it("rejects invalid service endpoints", () => {
        expect(() => createService({
            id: `${exampleDid}#svc-invalid`,
            type: "DIDCommV2",
            serviceEndpoint: "not-a-uri",
        })).toThrow(/Invalid URI/);
    });
    it("creates a DID Document with a verification method", () => {
        const verificationMethod = createVerificationMethod(exampleVerificationMethodInput);
        const document = createDIDDocument({
            id: exampleDid,
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
            verificationMethod: [verificationMethod],
        });
        const inserted = document.verificationMethod?.find((vm) => vm.id === verificationMethod.id);
        expect(inserted?.publicKeyJwk).toEqual(exampleEcJsonWebKey);
    });
});
describe("DID resolution payloads", () => {
    it.each(["application/did+json", "application/did+ld+json"])("parses representation DIDResolutionResult with %s contentType", (contentType) => {
        const payload = parseDIDResolutionResult({
            ...exampleResolutionPayload,
            didResolutionMetadata: { contentType },
        });
        expect(payload.didResolutionMetadata.contentType).toBe(contentType);
    });
    it("rejects unknown resolution media type", () => {
        expect(() => parseDIDResolutionResult({
            ...exampleResolutionPayload,
            didResolutionMetadata: {
                contentType: "application/unknown",
            },
        })).toThrow();
    });
    it("accepts abstract DID resolution results without contentType", () => {
        const payload = parseDIDResolutionResult({
            ...exampleResolutionPayload,
            didResolutionMetadata: {},
        });
        expect(payload.didResolutionMetadata.contentType).toBeUndefined();
    });
    it("preserves extension fields in DID resolution metadata", () => {
        const payload = parseDIDResolutionResult({
            ...exampleResolutionPayload,
            didResolutionMetadata: {
                retrieved: "2026-05-29T03:41:00Z",
                pattern: "midnight-ledger",
            },
        });
        expect(payload.didResolutionMetadata.retrieved).toBe("2026-05-29T03:41:00Z");
        expect(payload.didResolutionMetadata.pattern).toBe("midnight-ledger");
    });
    it.each([
        "invalidDid",
        "internalError",
        "methodNotSupported",
        "notFound",
        "representationNotSupported",
        "notAllowedVerificationMethodType",
        "customResolverError",
    ])("accepts DID resolution error keyword %s", (error) => {
        const payload = parseDIDResolutionResult({
            ...exampleResolutionPayload,
            didResolutionMetadata: { error },
        });
        expect(payload.didResolutionMetadata.error).toBe(error);
    });
    it.each([
        "",
        "not found",
        "not-found",
        "resolver:error",
        "123error",
    ])("rejects invalid DID resolution error keyword %s", (error) => {
        expect(() => parseDIDResolutionResult({
            ...exampleResolutionPayload,
            didResolutionMetadata: { error },
        })).toThrow();
    });
    it("rejects envelope media types in didResolutionMetadata.contentType", () => {
        expect(() => parseDIDResolutionResult({
            ...exampleResolutionPayload,
            didResolutionMetadata: {
                contentType: "application/json",
            },
        })).toThrow();
    });
});
//# sourceMappingURL=did-document.document-resolution.test.js.map