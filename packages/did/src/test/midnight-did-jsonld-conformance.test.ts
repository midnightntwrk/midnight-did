import { describe, expect, it, vi } from "vitest";

type ContractModule = typeof import("@midnight-ntwrk/midnight-did-contract");

vi.mock("@midnight-ntwrk/midnight-did-contract", () => {
  const DIDContractMock = {
    CurveType: { Ed25519: 0 },
    KeyType: { OKP: 3 },
    VerificationMethodType: { Undefined: 0, JsonWebKey: 1 },
  } as const;
  return {
    DIDContract: DIDContractMock as unknown as ContractModule["DIDContract"],
  } satisfies Partial<ContractModule>;
});

import {
  createVerificationMethod,
  CurveType,
  KeyType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import jsonld, { type JsonLdDocument } from "jsonld";

import { MidnightDIDSchema, MidnightNetwork } from "../midnight.js";
import { createMidnightDIDDocument } from "../midnight-did-document.js";
import { MidnightDIDResolver } from "../midnight-did-resolver.js";

const DID_CONTEXT_URL = "https://www.w3.org/ns/did/v1";
const JWK_CONTEXT_URL = "https://w3id.org/security/jwk/v1";
const SECURITY_IRI = "https://w3id.org/security#";
const JSON_WEB_KEY_IRI = `${SECURITY_IRI}JsonWebKey`;
const PUBLIC_KEY_JWK_IRI = `${SECURITY_IRI}publicKeyJwk`;

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
          "@protected": true,
          id: "@id",
          type: "@type",
          controller: { "@id": `${SECURITY_IRI}controller`, "@type": "@id" },
          verificationMethod: {
            "@id": `${SECURITY_IRI}verificationMethod`,
            "@type": "@id",
          },
          authentication: {
            "@id": `${SECURITY_IRI}authenticationMethod`,
            "@type": "@id",
            "@container": "@set",
          },
          assertionMethod: {
            "@id": `${SECURITY_IRI}assertionMethod`,
            "@type": "@id",
            "@container": "@set",
          },
          keyAgreement: {
            "@id": `${SECURITY_IRI}keyAgreementMethod`,
            "@type": "@id",
            "@container": "@set",
          },
          capabilityInvocation: {
            "@id": `${SECURITY_IRI}capabilityInvocationMethod`,
            "@type": "@id",
            "@container": "@set",
          },
          capabilityDelegation: {
            "@id": `${SECURITY_IRI}capabilityDelegationMethod`,
            "@type": "@id",
            "@container": "@set",
          },
        },
      },
    };
  }

  if (url === JWK_CONTEXT_URL) {
    return {
      documentUrl: url,
      document: {
        "@context": {
          JsonWebKey: {
            "@id": JSON_WEB_KEY_IRI,
            "@context": {
              "@protected": true,
              id: "@id",
              type: "@type",
              controller: {
                "@id": `${SECURITY_IRI}controller`,
                "@type": "@id",
              },
              revoked: {
                "@id": `${SECURITY_IRI}revoked`,
                "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
              },
              expires: {
                "@id": `${SECURITY_IRI}expiration`,
                "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
              },
              publicKeyJwk: {
                "@id": PUBLIC_KEY_JWK_IRI,
                "@type": "@json",
              },
              secretKeyJwk: {
                "@id": `${SECURITY_IRI}secretKeyJwk`,
                "@type": "@json",
              },
            },
          },
        },
      },
    };
  }

  throw new Error(`Unexpected remote JSON-LD context requested: ${url}`);
};

const compactMidnightDocument = async (
  document: JsonLdDocument,
): Promise<JsonLdDocument> => {
  const compact = jsonld.compact as (
    input: JsonLdDocument,
    context: JsonLdDocument,
    options: unknown,
  ) => Promise<JsonLdDocument>;
  return compact(
    document,
    { "@context": [DID_CONTEXT_URL, JWK_CONTEXT_URL] },
    { documentLoader },
  );
};

const makeIterable = <T>(items: T[]) => ({
  [Symbol.iterator]: function* () {
    yield* items;
  },
  isEmpty: () => items.length === 0,
});

const resolverLedgerState = () => ({
  id: { bytes: new Uint8Array(32).fill(0xaa) },
  version: 7n,
  active: true,
  created: 1n,
  updated: 2n,
  deactivated: false,
  operationCount: 3n,
  alsoKnownAs: makeIterable<string>([]),
  verificationMethods: makeIterable([
    [
      "key-ed25519",
      {
        typ: 1,
        publicKeyJwk: {
          kty: 3,
          crv: 0,
          x: encodeZeros(32),
          y: "",
        },
      },
    ] as const,
  ]),
  schnorrJubjubVerificationMethods: makeIterable([]),
  authenticationRelation: makeIterable(["key-ed25519"]),
  assertionMethodRelation: makeIterable<string>([]),
  keyAgreementRelation: makeIterable<string>([]),
  capabilityInvocationRelation: makeIterable<string>([]),
  capabilityDelegationRelation: makeIterable<string>([]),
  services: makeIterable([]),
});

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
  const verificationMethods =
    expandedRecord[`${SECURITY_IRI}verificationMethod`];
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
    if (!Array.isArray(methodRecord[PUBLIC_KEY_JWK_IRI])) {
      throw new Error("Expanded JsonWebKey is missing publicKeyJwk");
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

    const verificationMethods = expanded[`${SECURITY_IRI}verificationMethod`];
    expect(verificationMethods).toHaveLength(7);
    expect(expanded[`${SECURITY_IRI}authenticationMethod`]).toEqual([
      { "@id": `${exampleMidnightDid}#key-ed25519` },
    ]);
    expect(
      (verificationMethods as Record<string, unknown>[])[0]?.[
        PUBLIC_KEY_JWK_IRI
      ],
    ).toEqual([
      {
        "@type": "@json",
        "@value": {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: encodeZeros(32),
        },
      },
    ]);
  });

  it("preserves resolver-stream JSON-LD semantics through expansion and compaction", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => resolverLedgerState() as never,
      expectedNetwork: MidnightNetwork.Testnet,
    });

    const representation = await resolver.resolveRepresentation(
      exampleMidnightDid,
      { accept: "application/did+ld+json" },
    );

    expect(representation.didDocumentStream).not.toBeNull();
    expect(representation.didDocumentMetadata.versionId).toBe("7");
    expect(representation.didResolutionMetadata).toEqual({
      contentType: "application/did+ld+json",
    });

    const document = JSON.parse(
      new TextDecoder().decode(representation.didDocumentStream!),
    ) as JsonLdDocument;
    const before = await expandMidnightDocument(document);
    const compacted = await compactMidnightDocument(document);
    const after = await expandMidnightDocument(compacted);

    expect(after).toEqual(before);
  });

  it("preserves JSON-LD semantics through expansion and compaction", async () => {
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
      ],
      authentication: [`${exampleMidnightDid}#key-ed25519`],
      keyAgreement: [`${exampleMidnightDid}#key-x25519`],
    });

    const before = await expandMidnightDocument(document);
    const compacted = await compactMidnightDocument(document);
    const after = await expandMidnightDocument(compacted);

    expect(after).toEqual(before);
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
