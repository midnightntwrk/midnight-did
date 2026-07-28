import {
  createVerificationMethod,
  CurveType,
  KeyType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import jsonld, { type JsonLdDocument } from "jsonld";
import { describe, expect, it } from "vitest";

import { MidnightDIDSchema } from "../midnight.js";
import { createMidnightDIDDocument } from "../midnight-did-document.js";

const DID_CONTEXT_URL = "https://www.w3.org/ns/did/v1";
const JWS_CONTEXT_URL = "https://w3c.github.io/vc-jws-2020/contexts/v1";
const DID_IRI = "https://www.w3.org/ns/did#";
const SECURITY_IRI = "https://w3id.org/security#";
const JSON_WEB_KEY_IRI = `${SECURITY_IRI}JsonWebKey`;

const exampleMidnightDid = MidnightDIDSchema.parse(
  "did:midnight:testnet:c569622e7f33d2d020ba1cae242e6077268941327846d62d8cbf0cc923ae41f6",
);

const encodeZeros = (byteLength: number) =>
  Buffer.alloc(byteLength).toString("base64url");

type TestRemoteDocument = {
  documentUrl: string;
  document: JsonLdDocument;
};

const documentLoader = async (url: string): Promise<TestRemoteDocument> => {
  if (url === DID_CONTEXT_URL) {
    return {
      documentUrl: url,
      document: {
        "@context": {
          id: "@id",
          type: "@type",
          controller: { "@id": `${DID_IRI}controller`, "@type": "@id" },
          verificationMethod: {
            "@id": `${DID_IRI}verificationMethod`,
            "@container": "@set",
          },
          authentication: {
            "@id": `${DID_IRI}authentication`,
            "@type": "@id",
            "@container": "@set",
          },
          assertionMethod: {
            "@id": `${DID_IRI}assertionMethod`,
            "@type": "@id",
            "@container": "@set",
          },
          keyAgreement: {
            "@id": `${DID_IRI}keyAgreement`,
            "@type": "@id",
            "@container": "@set",
          },
          capabilityInvocation: {
            "@id": `${DID_IRI}capabilityInvocation`,
            "@type": "@id",
            "@container": "@set",
          },
          capabilityDelegation: {
            "@id": `${DID_IRI}capabilityDelegation`,
            "@type": "@id",
            "@container": "@set",
          },
          publicKeyJwk: {
            "@id": `${SECURITY_IRI}publicKeyJwk`,
            "@type": "@json",
          },
          JsonWebKey: JSON_WEB_KEY_IRI,
        },
      },
    };
  }

  if (url === JWS_CONTEXT_URL) {
    return {
      documentUrl: url,
      document: {
        "@context": {
          publicKeyJwk: {
            "@id": `${SECURITY_IRI}publicKeyJwk`,
            "@type": "@json",
          },
          JsonWebKey: JSON_WEB_KEY_IRI,
        },
      },
    };
  }

  throw new Error(`Unexpected remote JSON-LD context requested: ${url}`);
};

const expandMidnightDocument = async (document: JsonLdDocument) => {
  const expand = jsonld.expand as (
    input: JsonLdDocument,
    options: unknown,
  ) => Promise<unknown[]>;
  const expanded = await expand(document, { documentLoader });
  if (expanded.length !== 1) {
    throw new Error(
      `Expected one expanded DID Document, got ${expanded.length}`,
    );
  }

  const [expandedDocument] = expanded;
  const expandedRecord = expandedDocument as Record<string, unknown>;
  const verificationMethods = expandedRecord[`${DID_IRI}verificationMethod`];
  if (!Array.isArray(verificationMethods)) {
    throw new Error("Expanded DID Document is missing verificationMethod");
  }

  for (const verificationMethod of verificationMethods) {
    const methodRecord = verificationMethod as Record<string, unknown>;
    const types = methodRecord["@type"];
    if (!Array.isArray(types) || !types.includes(JSON_WEB_KEY_IRI)) {
      throw new Error(
        `Unsupported verification method JSON-LD type: ${String(types)}`,
      );
    }
  }

  return expandedRecord;
};

describe("Midnight DID Document JSON-LD conformance", () => {
  it("expands resolved DID Documents with every supported verification method profile", async () => {
    const document = createMidnightDIDDocument({
      id: exampleMidnightDid,
      verificationMethod: [
        createVerificationMethod({
          id: "#key-ed25519",
          type: VerificationMethodType.JsonWebKey,
          controller: exampleMidnightDid,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            x: encodeZeros(32),
          },
        }),
        createVerificationMethod({
          id: "#key-x25519",
          type: VerificationMethodType.JsonWebKey,
          controller: exampleMidnightDid,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.X25519,
            x: encodeZeros(32),
          },
        }),
        createVerificationMethod({
          id: "#key-jubjub",
          type: VerificationMethodType.JsonWebKey,
          controller: exampleMidnightDid,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.Jubjub,
            x: encodeZeros(32),
            y: encodeZeros(32),
          },
        }),
        createVerificationMethod({
          id: "#key-p256",
          type: VerificationMethodType.JsonWebKey,
          controller: exampleMidnightDid,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.P256,
            x: encodeZeros(32),
            y: encodeZeros(32),
          },
        }),
        createVerificationMethod({
          id: "#key-secp256k1",
          type: VerificationMethodType.JsonWebKey,
          controller: exampleMidnightDid,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.Secp256k1,
            x: encodeZeros(32),
            y: encodeZeros(32),
          },
        }),
        createVerificationMethod({
          id: "#key-bls12381-g1",
          type: VerificationMethodType.JsonWebKey,
          controller: exampleMidnightDid,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.BLS12381G1,
            x: encodeZeros(48),
          },
        }),
        createVerificationMethod({
          id: "#key-bls12381-g2",
          type: VerificationMethodType.JsonWebKey,
          controller: exampleMidnightDid,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.BLS12381G2,
            x: encodeZeros(96),
          },
        }),
      ],
      authentication: [`${exampleMidnightDid}#key-ed25519`],
      assertionMethod: [`${exampleMidnightDid}#key-p256`],
      keyAgreement: [`${exampleMidnightDid}#key-x25519`],
      capabilityInvocation: [`${exampleMidnightDid}#key-jubjub`],
      capabilityDelegation: [`${exampleMidnightDid}#key-secp256k1`],
    });

    const expanded = await expandMidnightDocument(document);

    expect(expanded[`${DID_IRI}verificationMethod`]).toHaveLength(7);
    expect(expanded[`${DID_IRI}authentication`]).toEqual([
      { "@id": `${exampleMidnightDid}#key-ed25519` },
    ]);
    expect(expanded[`${SECURITY_IRI}publicKeyJwk`]).toBeUndefined();
  });

  it("documents that JsonWebKey2020 is not the Midnight JSON-LD verification method type", async () => {
    const document = {
      ...createMidnightDIDDocument({
        id: exampleMidnightDid,
        verificationMethod: [
          createVerificationMethod({
            id: "#key-ed25519",
            type: VerificationMethodType.JsonWebKey,
            controller: exampleMidnightDid,
            publicKeyJwk: {
              kty: KeyType.OKP,
              crv: CurveType.Ed25519,
              x: encodeZeros(32),
            },
          }),
        ],
      }),
      verificationMethod: [
        {
          id: `${exampleMidnightDid}#key-ed25519`,
          type: "JsonWebKey2020",
          controller: exampleMidnightDid,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            x: encodeZeros(32),
          },
        },
      ],
    } as unknown as JsonLdDocument;

    await expect(expandMidnightDocument(document)).rejects.toThrow(
      /Unsupported verification method JSON-LD type/,
    );
  });
});
