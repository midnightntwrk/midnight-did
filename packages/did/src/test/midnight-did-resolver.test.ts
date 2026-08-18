import { beforeEach, describe, expect, it, vi } from "vitest";

type ContractModule = typeof import("@midnight-ntwrk/midnight-did-contract");

vi.mock("@midnight-ntwrk/midnight-did-contract", () => {
  const DIDContractMock = {
    CurveType: {
      Ed25519: 0,
      X25519: 1,
      Jubjub: 2,
      P256: 3,
      Secp256k1: 4,
      BLS12381G1: 5,
      BLS12381G2: 6,
    },
    KeyType: { EC: 0, RSA: 1, oct: 2, OKP: 3 },
    VerificationMethodType: { Undefined: 0, JsonWebKey: 1 },
    VerificationMethodRelation: {
      Undefined: 0,
      Authentication: 1,
      AssertionMethod: 2,
      KeyAgreement: 3,
      CapabilityInvocation: 4,
      CapabilityDelegation: 5,
    },
  } as const;
  return {
    DIDContract: DIDContractMock as unknown as ContractModule["DIDContract"],
  } satisfies Partial<ContractModule>;
});

import { parseMidnightDIDString } from "@midnight-ntwrk/midnight-did-domain";

import {
  MidnightDIDResolver,
  type MidnightDIDResolverInterface,
  MidnightNetwork,
} from "../index.js";

function makeIterablePairs<K, V>(entries: Array<[K, V]>) {
  return {
    [Symbol.iterator]: function* () {
      for (const e of entries) yield e as [K, V];
    },
    isEmpty: () => entries.length === 0,
  } as any;
}

function makeIterable<T>(items: T[]) {
  return {
    [Symbol.iterator]: function* () {
      for (const i of items) yield i as T;
    },
    isEmpty: () => items.length === 0,
  } as any;
}

describe("MidnightDIDResolver", () => {
  const did = parseMidnightDIDString(`did:midnight:devnet:${"a".repeat(64)}`);

  let ledgerState: any;

  beforeEach(() => {
    ledgerState = {
      id: { bytes: new Uint8Array(32).fill(0xaa) },
      version: 1n,
      active: true,
      created: 1n,
      updated: 2n,
      deactivated: false,
      operationCount: 3n,
      alsoKnownAs: makeIterable<string>(["https://example.com/aka"]),
      verificationMethods: makeIterablePairs<string, any>([
        [
          "key-1",
          {
            typ: 1,
            publicKeyJwk: {
              kty: 3,
              crv: 0,
              x: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
              y: "",
            },
          },
        ],
      ]),
      schnorrJubjubVerificationMethods: makeIterablePairs<string, any>([]),
      authenticationRelation: makeIterable<string>(["key-1"]),
      assertionMethodRelation: makeIterable<string>([]),
      keyAgreementRelation: makeIterable<string>([]),
      capabilityInvocationRelation: makeIterable<string>([]),
      capabilityDelegationRelation: makeIterable<string>([]),
      services: makeIterablePairs<string, any>([
        [
          "svc-1",
          {
            id: "svc-1",
            typ: "LinkedDomains",
            serviceEndpoint: JSON.stringify("https://example.com"),
          },
        ],
      ]),
    };
  });

  it("resolves DID to document + metadata", async () => {
    const ledgerReader = vi.fn().mockResolvedValue(ledgerState);
    const resolver = new MidnightDIDResolver({
      ledgerReader,
      expectedNetwork: MidnightNetwork.DevNet,
    });
    const resolverContract: MidnightDIDResolverInterface = resolver;

    const result = await resolverContract.resolveResult(did);

    expect(result).not.toBeNull();
    expect(result?.didDocument.id).toBe(did);
    expect(result?.didDocument.authentication).toEqual([`${did}#key-1`]);
    expect(result?.didDocumentMetadata.versionId).toBe("1");
    expect(ledgerReader).toHaveBeenCalledWith("a".repeat(64));
  });

  it("normalizes uppercase ledger identifiers before reading and emitting documents", async () => {
    const mixedCaseAddress = `${"A".repeat(32)}${"b".repeat(32)}`;
    const ledgerReader = vi.fn().mockResolvedValue(ledgerState);
    const resolver = new MidnightDIDResolver({
      ledgerReader,
      expectedNetwork: MidnightNetwork.DevNet,
    });

    const result = await resolver.resolveResult(
      `did:midnight:devnet:${mixedCaseAddress}`,
    );

    expect(result?.didDocument.id).toBe(
      `did:midnight:devnet:${mixedCaseAddress.toLowerCase()}`,
    );
    expect(result?.didDocument.controller).toBe(
      `did:midnight:devnet:${mixedCaseAddress.toLowerCase()}`,
    );
    expect(ledgerReader).toHaveBeenCalledWith(mixedCaseAddress.toLowerCase());
  });

  it("returns null when DID state is not found", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => null,
    });

    const result = await resolver.resolveResult(did);
    expect(result).toBeNull();
  });

  it("returns a DID Core resolution envelope on success", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
      expectedNetwork: MidnightNetwork.DevNet,
    });

    const result = await resolver.resolveDIDResolutionResult(did);

    expect(result.didDocument?.id).toBe(did);
    expect(result.didDocumentMetadata.versionId).toBe("1");
    expect(result.didResolutionMetadata).toEqual({});
  });

  it("returns notFound in the DID Core resolution envelope", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => null,
    });

    const result = await resolver.resolveDIDResolutionResult(did);

    expect(result.didDocument).toBeNull();
    expect(result.didDocumentMetadata).toEqual({});
    expect(result.didResolutionMetadata.error).toBe("notFound");
  });

  it("returns invalidDid in the DID Core resolution envelope", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveDIDResolutionResult("did:bad");

    expect(result.didDocument).toBeNull();
    expect(result.didResolutionMetadata.error).toBe("invalidDid");
  });

  it("preserves distinct path services with the same fragment", async () => {
    ledgerState.services = makeIterablePairs<string, any>([
      [
        "service-a",
        {
          id: "/routes/a#service",
          typ: "LinkedDomains",
          serviceEndpoint: JSON.stringify("https://a.example"),
        },
      ],
      [
        "service-b",
        {
          id: "/routes/b#service",
          typ: "LinkedDomains",
          serviceEndpoint: JSON.stringify("https://b.example"),
        },
      ],
    ]);

    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveDIDResolutionResult(did);

    expect(result.didDocument?.service?.map((service) => service.id)).toEqual([
      `${did}/routes/a#service`,
      `${did}/routes/b#service`,
    ]);
    expect(result.didResolutionMetadata.error).toBeUndefined();
  });

  it("maps invalid ledger document state to invalidDid", async () => {
    ledgerState.services = makeIterablePairs<string, any>([
      [
        "invalid-service",
        {
          id: "#",
          typ: "LinkedDomains",
          serviceEndpoint: JSON.stringify("https://example.com"),
        },
      ],
    ]);

    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveDIDResolutionResult(did);

    expect(result.didDocument).toBeNull();
    expect(result.didResolutionMetadata.error).toBe("invalidDid");
  });

  it("maps schema validation failures to invalidDid", async () => {
    ledgerState.alsoKnownAs = makeIterable<string>(["not a URI"]);

    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveDIDResolutionResult(did);

    expect(result.didDocument).toBeNull();
    expect(result.didResolutionMetadata.error).toBe("invalidDid");
  });

  it("throws on network mismatch", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
      expectedNetwork: MidnightNetwork.Testnet,
    });

    await expect(() => resolver.resolveResult(did)).rejects.toThrow(
      /Network mismatch/,
    );
  });

  it("throws on resolve when DID is not found", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => null,
    });

    await expect(() => resolver.resolve(did)).rejects.toThrow(/DID not found/);
  });

  it("rejects offchain Midnight DIDs in the ledger resolver", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    await expect(() =>
      resolver.resolveResult(`did:midnight:offchain:${"b".repeat(64)}`),
    ).rejects.toThrow(/long-form encoded state/);
  });

  it("returns methodNotSupported for offchain DIDs in resolution envelopes", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveDIDResolutionResult(
      `did:midnight:offchain:${"b".repeat(64)}`,
    );

    expect(result.didDocument).toBeNull();
    expect(result.didResolutionMetadata.error).toBe("methodNotSupported");
  });

  it("returns a JSON-LD DID Document representation by default", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
      expectedNetwork: MidnightNetwork.DevNet,
    });

    const result = await resolver.resolveRepresentation(did);

    expect(result.didDocumentStream).not.toBeNull();
    expect(
      JSON.parse(new TextDecoder().decode(result.didDocumentStream!)),
    ).toEqual(expect.objectContaining({ id: did }));
    expect(result.didResolutionMetadata).toEqual({
      contentType: "application/did+ld+json",
    });
  });

  it("selects DID Core JSON when requested", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
      expectedNetwork: MidnightNetwork.DevNet,
    });

    const result = await resolver.resolveRepresentation(did, {
      accept: "application/did+json",
    });

    expect(result.didDocumentStream).not.toBeNull();
    const didDocument = JSON.parse(
      new TextDecoder().decode(result.didDocumentStream!),
    );
    expect(didDocument).toEqual(expect.objectContaining({ id: did }));
    expect(didDocument).not.toHaveProperty("@context");
    expect(result.didResolutionMetadata.contentType).toBe(
      "application/did+json",
    );
  });

  it("accepts case-insensitive media types and array input", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
      expectedNetwork: MidnightNetwork.DevNet,
    });

    const result = await resolver.resolveRepresentation(did, {
      accept: ["application/json", "Application/DID+JSON"],
    });

    expect(result.didResolutionMetadata.contentType).toBe(
      "application/did+json",
    );
  });

  it("honors a preferred supported type before a wildcard fallback", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
      expectedNetwork: MidnightNetwork.DevNet,
    });

    const result = await resolver.resolveRepresentation(did, {
      accept: "application/did+json;q=0.9, */*;q=0.8",
    });

    expect(result.didResolutionMetadata.contentType).toBe(
      "application/did+json",
    );
  });

  it("returns representationNotSupported without reading the ledger", async () => {
    const ledgerReader = vi.fn();
    const resolver = new MidnightDIDResolver({ ledgerReader });

    const result = await resolver.resolveRepresentation(did, {
      accept: "application/json",
    });

    expect(result).toEqual({
      didDocumentStream: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "representationNotSupported" },
    });
    expect(ledgerReader).not.toHaveBeenCalled();
  });

  it("does not select a representation explicitly rejected by q=0", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveRepresentation(did, {
      accept: "application/did+json;q=0, application/json;q=1",
    });

    expect(result.didDocumentStream).toBeNull();
    expect(result.didResolutionMetadata.error).toBe(
      "representationNotSupported",
    );
  });

  it("does not fall back when every requested type has q=0", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveRepresentation(did, {
      accept: "application/did+ld+json;q=0, application/did+json;q=0",
    });

    expect(result).toEqual({
      didDocumentStream: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "representationNotSupported" },
    });
  });

  it("normalizes comma-separated media types in array input", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
      expectedNetwork: MidnightNetwork.DevNet,
    });

    const result = await resolver.resolveRepresentation(did, {
      accept: ["application/did+json, application/json"],
    });

    expect(result.didResolutionMetadata.contentType).toBe(
      "application/did+json",
    );
  });

  it("uses the default representation for an empty Accept value", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
      expectedNetwork: MidnightNetwork.DevNet,
    });

    const result = await resolver.resolveRepresentation(did, { accept: "" });

    expect(result.didResolutionMetadata.contentType).toBe(
      "application/did+ld+json",
    );
  });

  it("returns notFound without a representation stream", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => null,
    });

    const result = await resolver.resolveRepresentation(did, {
      accept: "application/did+json",
    });

    expect(result).toEqual({
      didDocumentStream: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "notFound" },
    });
  });

  it("maps invalid DIDs to the representation error envelope", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveRepresentation("did:bad", {
      accept: "application/did+json",
    });

    expect(result).toEqual({
      didDocumentStream: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "invalidDid" },
    });
  });

  it("maps offchain DIDs to methodNotSupported", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => ledgerState,
    });

    const result = await resolver.resolveRepresentation(
      `did:midnight:offchain:${"b".repeat(64)}`,
      { accept: "application/did+json" },
    );

    expect(result).toEqual({
      didDocumentStream: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "methodNotSupported" },
    });
  });
});
