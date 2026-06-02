import {
  createService,
  createVerificationMethod,
  CurveType,
  KeyType,
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
        "https://w3c.github.io/vc-jws-2020/contexts/v1",
      ]);
      expect(doc.controller).toBe(exampleMidnightDid);
      expect(doc.verificationMethod).toHaveLength(1);
      expect(doc.authentication).toEqual(["#key-1"]);
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
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
        ],
        id: exampleMidnightDid,
        controller: exampleMidnightDid,
        verificationMethod: [exampleVerificationMethod],
        authentication: ["#key-1"],
      };

      const doc = parseMidnightDIDDocument(input);
      expect(doc.id).toBe(exampleMidnightDid);
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
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
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
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
        ],
        id: "did:example:123",
      };

      expect(() => parseMidnightDIDDocument(input)).toThrow(
        /must be a valid Midnight DID/,
      );
    });

    it("rejects document where controller does not equal id", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
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
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
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
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
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
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
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

    it("accepts verification method with DID URL containing fragment", () => {
      const input = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
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
          "https://w3c.github.io/vc-jws-2020/contexts/v1",
        ],
        id: exampleMidnightDid,
        controller: exampleMidnightDid,
        verificationMethod: [exampleVerificationMethod], // Uses #key-1
        authentication: ["#key-1"],
      };

      const doc = parseMidnightDIDDocument(input);
      expect(doc.verificationMethod?.[0].id).toBe("#key-1");
    });
  });
});
