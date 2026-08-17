import {
  createService,
  createVerificationMethod,
  CurveType,
  KeyType,
  Service,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { describe, expect, it } from "vitest";

import { MidnightDIDSchema } from "../midnight.js";
import {
  createMidnightDIDDocument,
  parseMidnightDIDDocument,
} from "../midnight-did-document.js";

const exampleMidnightDid = MidnightDIDSchema.parse(
  "did:midnight:testnet:c569622e7f33d2d020ba1cae242e6077268941327846d62d8cbf0cc923ae41f6",
);

const exampleVerificationMethod = createVerificationMethod({
  id: "#key-1",
  type: VerificationMethodType.JsonWebKey,
  controller: exampleMidnightDid,
  publicKeyJwk: {
    kty: KeyType.OKP,
    crv: CurveType.Ed25519,
    x: "VCpo2LMLhn6iWku8MKvSLg2ZAoC-nlOyPVQaO3FxVeQ",
  },
});

const optionalDIDDocumentMembers = [
  "alsoKnownAs",
  "controller",
  "verificationMethod",
  "authentication",
  "assertionMethod",
  "keyAgreement",
  "capabilityInvocation",
  "capabilityDelegation",
  "service",
] as const;

const exampleJubjubVerificationMethod = createVerificationMethod({
  id: "#key-jubjub",
  type: VerificationMethodType.JsonWebKey,
  controller: exampleMidnightDid,
  publicKeyJwk: {
    kty: KeyType.EC,
    crv: CurveType.Jubjub,
    x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    y: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
  },
});

describe("Midnight DID Document", () => {
  describe("createMidnightDIDDocument", () => {
    it("creates a valid Midnight DID Document with required contexts", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        verificationMethod: [exampleVerificationMethod],
        authentication: ["#key-1"],
      });

      expect(doc.id).toBe(exampleMidnightDid);
      expect(doc["@context"]).toEqual([
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/jwk/v1",
      ]);
      expect(doc.controller).toBe(exampleMidnightDid);
      expect(doc.verificationMethod).toHaveLength(1);
      expect(doc.authentication).toEqual(["#key-1"]);
      expect(doc).not.toHaveProperty("assertionMethod");
      expect(doc).not.toHaveProperty("keyAgreement");
      expect(doc).not.toHaveProperty("capabilityInvocation");
      expect(doc).not.toHaveProperty("capabilityDelegation");
    });

    it("allows additional contexts beyond the required two", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        additionalContexts: ["https://example.com/custom-context"],
      });

      expect(doc["@context"]).toHaveLength(3);
      expect(doc["@context"][2]).toBe("https://example.com/custom-context");
    });

    it("sets controller equal to id (single-controller model)", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
      });

      expect(doc.controller).toBe(exampleMidnightDid);
    });

    it("omits absent optional members instead of emitting null", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
      });

      for (const member of optionalDIDDocumentMembers) {
        if (member === "controller") continue;
        expect(doc).not.toHaveProperty(member);
      }
    });

    it("omits empty optional arrays", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        alsoKnownAs: [],
        verificationMethod: [],
        service: [],
      });

      expect(doc).not.toHaveProperty("alsoKnownAs");
      expect(doc).not.toHaveProperty("verificationMethod");
      expect(doc).not.toHaveProperty("service");
    });

    it("accepts Ed25519 (OKP) verification methods", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        verificationMethod: [exampleVerificationMethod],
      });

      expect(doc.verificationMethod?.[0].publicKeyJwk.kty).toBe(KeyType.OKP);
      expect(doc.verificationMethod?.[0].publicKeyJwk.crv).toBe(
        CurveType.Ed25519,
      );
    });

    it("accepts Jubjub (EC) verification methods", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        verificationMethod: [exampleJubjubVerificationMethod],
      });

      expect(doc.verificationMethod?.[0].publicKeyJwk.kty).toBe(KeyType.EC);
      expect(doc.verificationMethod?.[0].publicKeyJwk.crv).toBe(
        CurveType.Jubjub,
      );
    });

    it("includes alsoKnownAs when provided", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        alsoKnownAs: ["did:example:alias"],
      });

      expect(doc.alsoKnownAs).toEqual(["did:example:alias"]);
    });

    it("accepts non-DID URI values in alsoKnownAs", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        alsoKnownAs: ["https://example.com/alias"],
      });

      expect(doc.alsoKnownAs).toEqual(["https://example.com/alias"]);
    });

    it("includes service endpoints when provided", () => {
      const service = createService({
        id: "#service-1",
        type: "LinkedDomains",
        serviceEndpoint: "https://example.com",
      });

      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        service: [service],
      });

      expect(doc.service).toHaveLength(1);
      expect(doc.service?.[0].id).toBe("#service-1");
    });
  });

  describe("parseMidnightDIDDocument", () => {
    it("parses a valid Midnight DID Document", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        controller: exampleMidnightDid,
        verificationMethod: [exampleVerificationMethod],
        authentication: ["#key-1"],
      };

      const doc = parseMidnightDIDDocument(input);
      expect(doc.id).toBe(exampleMidnightDid);
    });

    it("normalizes case-divergent document id and controller", () => {
      const mixedCaseDid = exampleMidnightDid.replace("c569", "C569");
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: mixedCaseDid,
        controller: exampleMidnightDid,
        verificationMethod: [exampleVerificationMethod],
        authentication: ["#key-1"],
      };

      const doc = parseMidnightDIDDocument(input);
      expect(doc.id).toBe(exampleMidnightDid);
      expect(doc.controller).toBe(exampleMidnightDid);
    });

    it("canonicalizes absolute method references with mixed-case DIDs", () => {
      const mixedCaseDid = exampleMidnightDid.replace("c569", "C569");
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: mixedCaseDid,
        controller: mixedCaseDid,
        verificationMethod: [
          {
            ...exampleVerificationMethod,
            id: `${mixedCaseDid}#key-1`,
            controller: mixedCaseDid,
          },
        ],
        authentication: ["#key-1"],
      };

      const doc = parseMidnightDIDDocument(input);
      expect(doc.id).toBe(exampleMidnightDid);
      expect(doc.verificationMethod?.[0]?.id).toBe(
        `${exampleMidnightDid}#key-1`,
      );
      expect(doc.verificationMethod?.[0]?.controller).toBe(exampleMidnightDid);
    });

    it("canonicalizes path and query DID URL references to fragments", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        verificationMethod: [
          {
            ...exampleVerificationMethod,
            id: `${exampleMidnightDid}/keys?versionId=1#key-1`,
          },
        ],
        authentication: [`${exampleMidnightDid}#key-1`],
      };

      const doc = parseMidnightDIDDocument(input);
      expect(doc.verificationMethod?.[0]?.id).toBe(
        `${exampleMidnightDid}#key-1`,
      );
    });

    it("rejects verification methods from another DID subject", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        verificationMethod: [
          {
            ...exampleVerificationMethod,
            id: `did:midnight:testnet:${"f".repeat(64)}#key-1`,
          },
        ],
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /verificationMethod id .* must be subject-bound/,
      );
    });

    it("rejects null optional DID Document members", () => {
      for (const member of optionalDIDDocumentMembers) {
        expect(() =>
          parseMidnightDIDDocument({
            "@context": [
              "https://www.w3.org/ns/did/v1",
              "https://w3id.org/security/jwk/v1",
            ],
            id: exampleMidnightDid,
            [member]: null,
          }),
        ).toThrow();
      }
    });

    it("preserves omission of optional DID Document members", () => {
      const doc = parseMidnightDIDDocument({
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
      });

      for (const member of optionalDIDDocumentMembers) {
        expect(doc).not.toHaveProperty(member);
      }
    });

    it("omits empty optional arrays when parsing", () => {
      const doc = parseMidnightDIDDocument({
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        alsoKnownAs: [],
        verificationMethod: [],
        service: [],
      });

      expect(doc).not.toHaveProperty("alsoKnownAs");
      expect(doc).not.toHaveProperty("verificationMethod");
      expect(doc).not.toHaveProperty("service");
    });

    it("rejects document with string @context", () => {
      const input = {
        "@context": "https://www.w3.org/ns/did/v1",
        id: exampleMidnightDid,
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /@context must be an array/,
      );
    });

    it("rejects document with only one @context entry", () => {
      const input = {
        "@context": ["https://www.w3.org/ns/did/v1"],
        id: exampleMidnightDid,
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /@context must contain at least 2 entries/,
      );
    });

    it("rejects document with wrong first @context entry", () => {
      const input = {
        "@context": [
          "https://example.com/wrong",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /First @context entry must be/,
      );
    });

    it("rejects document with wrong second @context entry", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://example.com/wrong",
        ],
        id: exampleMidnightDid,
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /Second @context entry must be/,
      );
    });

    it("rejects document with non-Midnight DID", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: "did:example:123",
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /must be a valid Midnight DID/,
      );
    });

    it("reports invalid id cleanly when controller is present", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: "did:example:123",
        controller: exampleMidnightDid,
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /id must be a valid Midnight DID \(did:midnight:<network>:<identifier>\)/,
      );
      expect(() => parseMidnightDIDDocument(input)).not.toThrow(
        /controller must equal DID subject/,
      );
    });

    it("rejects document where controller does not equal id", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        controller: `did:midnight:testnet:${"f".repeat(64)}`,
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /controller must equal DID subject/,
      );
    });

    it("rejects verification method with non-JsonWebKey type", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        controller: exampleMidnightDid,
        verificationMethod: [
          {
            ...exampleVerificationMethod,
            type: "EcdsaSecp256k1VerificationKey2019", // Not supported
          },
        ],
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(/JsonWebKey/);
    });

    it("rejects verification method with unsupported key type (RSA)", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        controller: exampleMidnightDid,
        verificationMethod: [
          {
            ...exampleVerificationMethod,
            publicKeyJwk: {
              kty: KeyType.RSA, // Not supported
              crv: CurveType.Ed25519,
              x: "VCpo2LMLhn6iWku8MKvSLg2ZAoC-nlOyPVQaO3FxVeQ",
            },
          },
        ],
      };

      // Throws error - caught by base DID schema's key validation
      expect(() => parseMidnightDIDDocument(input)).toThrow();
    });

    it("rejects embedded verification method (without fragment)", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        controller: exampleMidnightDid,
        verificationMethod: [
          {
            ...exampleVerificationMethod,
            id: exampleMidnightDid, // No fragment - embedded
          },
        ],
      };

      // Throws error - caught by base DID schema's key ID validation
      expect(() => parseMidnightDIDDocument(input)).toThrow();
    });

    it("preserves service endpoint spelling while validating consistency", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        service: [
          {
            id: "#service-1",
            type: "LinkedDomains",
            serviceEndpoint: "https://Example.com:443/",
          } as Service,
        ],
      });

      expect(doc.service?.[0]?.serviceEndpoint).toBe(
        "https://Example.com:443/",
      );
    });

    it("rejects duplicate verification method ids", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        verificationMethod: [
          exampleVerificationMethod,
          exampleVerificationMethod,
        ],
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /verificationMethod ids must be unique/,
      );
    });

    it("rejects dangling verification relationships", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        authentication: ["#missing-key"],
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /authentication references a verificationMethod id that does not exist/,
      );
    });

    it("rejects duplicate service ids", () => {
      const service = createService({
        id: "#service-1",
        type: "LinkedDomains",
        serviceEndpoint: "https://example.com",
      });
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        service: [
          service,
          { ...service, id: `${exampleMidnightDid}#service-1` },
        ],
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /service ids must be unique/,
      );
    });

    it("rejects services from another DID subject", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        service: [
          {
            id: "did:example:other#service-1",
            type: "LinkedDomains",
            serviceEndpoint: "https://example.com",
          },
        ],
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /service id .* must be subject-bound/,
      );
    });

    it("canonicalizes path-form relative service identifiers", () => {
      const doc = createMidnightDIDDocument({
        id: exampleMidnightDid,
        service: [
          {
            id: "/services/a#service-1",
            type: "LinkedDomains",
            serviceEndpoint: "https://example.com",
          } as Service,
        ],
      });

      expect(doc.service?.[0]?.id).toBe("#service-1");
    });

    it("rejects relative service identifiers that normalize to duplicates", () => {
      expect(() =>
        createMidnightDIDDocument({
          id: exampleMidnightDid,
          service: [
            {
              id: "service-1",
              type: "LinkedDomains",
              serviceEndpoint: "https://example.com",
            } as Service,
            {
              id: "#service-1",
              type: "LinkedDomains",
              serviceEndpoint: "https://example.org",
            } as Service,
          ],
        }),
      ).toThrow(/service ids must be unique/);
    });

    it("accepts verification method with DID URL containing fragment", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        controller: exampleMidnightDid,
        verificationMethod: [
          {
            ...exampleVerificationMethod,
            id: `${exampleMidnightDid}#key-1`, // Full DID URL with fragment
          },
        ],
        authentication: [`${exampleMidnightDid}#key-1`],
      };

      const doc = parseMidnightDIDDocument(input);
      expect(doc.verificationMethod?.[0].id).toBe(
        `${exampleMidnightDid}#key-1`,
      );
    });

    it("accepts verification method with relative fragment identifier", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/jwk/v1",
        ],
        id: exampleMidnightDid,
        controller: exampleMidnightDid,
        verificationMethod: [exampleVerificationMethod], // Uses #key-1
        authentication: ["key-1"],
      };

      const doc = parseMidnightDIDDocument(input);
      expect(doc.authentication).toEqual(["#key-1"]);
      expect(doc.verificationMethod?.[0].id).toBe("#key-1");
    });
  });
});
