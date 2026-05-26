import { beforeEach, describe, expect, it, vi } from "vitest";

type ContractModule = typeof import("@midnight-ntwrk/midnight-did-contract");

vi.mock("@midnight-ntwrk/midnight-did-contract", () => {
  const DIDContractMock = {
    CurveType: { Ed25519: 0, Jubjub: 1, P256: 2 },
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

import { MidnightDIDResolver, MidnightNetwork } from "../index.js";

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
              x: 1n,
              y: 0n,
            },
          },
        ],
      ]),
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

    const result = await resolver.resolveResult(did);

    expect(result).not.toBeNull();
    expect(result?.didDocument.id).toBe(did);
    expect(result?.didDocument.authentication).toEqual(["#key-1"]);
    expect(result?.didDocumentMetadata.versionId).toBe("1");
    expect(ledgerReader).toHaveBeenCalledWith("a".repeat(64));
  });

  it("returns null when DID state is not found", async () => {
    const resolver = new MidnightDIDResolver({
      ledgerReader: async () => null,
    });

    const result = await resolver.resolveResult(did);
    expect(result).toBeNull();
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
});
