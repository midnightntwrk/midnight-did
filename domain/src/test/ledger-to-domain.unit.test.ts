import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the managed runtime enums used by the contract source to avoid loading WASM/runtime
vi.mock("@midnight-ntwrk/midnight-did-contract/dist/managed/did/contract/index.cjs", () => ({
  CurveType: { ed25519: 0, Jubjub: 1 },
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
  OperationType: {
    Undefined: 0,
    AddVerificationMethod: 1,
    UpdateVerificationMethod: 2,
    RemoveVerificationMethod: 3,
    AddVerificationMethodRelation: 4,
    RemoveVerificationMethodRelation: 5,
    AddService: 6,
    UpdateService: 7,
    RemoveService: 8,
    AddAlsoKnownAs: 9,
    RemoveAlsoKnownAs: 10,
    Deactivate: 11,
  },
}));

// Import after mocks are defined
import { LedgerToDomain, MidnightNetwork, parseContractAddress } from "@midnight-ntwrk/midnight-did-contract";

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

describe("LedgerToDomain (unit, mocked managed runtime)", () => {
  let stubLedger: any;

  beforeEach(() => {
    const idBytes = new Uint8Array(32).fill(1);

    const verificationMethods = makeIterablePairs<string, any>([
      [
        "did:midnight:devnet:" + "0".repeat(68) + "#key-1",
        {
          type: 1, // JsonWebKey
          publicKeyJwk: { kty: 3, crv: 0, x: 1n, y: 2n }, // OKP, ed25519
        },
      ],
    ]);

    const services = makeIterablePairs<string, any>([
      [
        "svc-1",
        { id: "svc-1", type: "SVC", serviceEndpoint: ["https://u", "", "", ""] },
      ],
      [
        "svc-2",
        {
          id: "svc-2",
          type: "SVC2",
          serviceEndpoint: ["wss://x", "https://y", "", ""],
        },
      ],
    ]);

    stubLedger = {
      id: { bytes: idBytes },
      version: 1n,
      active: true,
      operationCount: 3n,
      alsoKnownAs: makeIterable<string>(["did:alias:one"]),
      verificationMethods,
      authenticationRelation: makeIterable<string>([
        "did:midnight:devnet:" + "0".repeat(68) + "#key-1",
      ]),
      assertionMethodRelation: makeIterable<string>([]),
      keyAgreementRelation: makeIterable<string>([]),
      capabilityInvocationRelation: makeIterable<string>([]),
      capabilityDelegationRelation: makeIterable<string>([]),
      services,
    };
  });

  it("publicKeyJwk encodes bigint field elements as base64url", () => {
    const out = LedgerToDomain.publicKeyJwk({ kty: 3, crv: 0, x: 7n, y: 9n } as any);
    expect(out.kty).toBe("OKP");
    expect(out.crv).toBe("ed25519");
    expect(out.x).toBe("Bw");
    expect(out.y).toBe("CQ");
  });

  it("service filters blank endpoints and preserves id/type", () => {
    const svc = LedgerToDomain.service({
      id: "svc-x",
      type: "T",
      serviceEndpoint: ["https://a", "", "", ""],
    } as any);
    expect(svc.id).toBe("svc-x");
    expect(Array.isArray(svc.serviceEndpoint)).toBe(true);
    expect((svc.serviceEndpoint as string[])[0]).toBe("https://a");
    expect((svc.serviceEndpoint as string[]).length).toBe(1);
  });

  it("toJSON flattens ledger to plain JSON with arrays", () => {
    const json = LedgerToDomain.toJSON(stubLedger) as any;
    expect(typeof json.id).toBe("string");
    expect(json.id.length).toBe(64); // 32 bytes hex
    expect(json.version).toBe(1);
    expect(json.active).toBe(true);
    expect(json.operationCount).toBe(3);
    expect(Array.isArray(json.verificationMethods)).toBe(true);
    expect(json.verificationMethods[0].publicKeyJwk.x).toBe("AQ"); // 1n -> AQ
    expect(Array.isArray(json.authenticationRelation)).toBe(true);
    expect(Array.isArray(json.services)).toBe(true);
    // ensure blank endpoints removed
    expect(json.services[0].serviceEndpoint.length).toBe(1);
  });

  it("ledgerStateToDIDDocument builds DID Document and assigns alsoKnownAs when present", () => {
    const addr = parseContractAddress("0".repeat(68));
    const doc = LedgerToDomain.ledgerStateToDIDDocument(
      stubLedger,
      MidnightNetwork.DevNet,
      addr
    );
    expect(doc.id.startsWith("did:midnight:devnet:")).toBe(true);
    expect(doc.controller).toBeDefined();
    expect(doc.verificationMethod?.length).toBe(1);
    expect(doc.authentication?.length).toBe(1);
    expect(doc.service?.length).toBe(2);
    expect(doc.alsoKnownAs?.[0]).toBe("did:alias:one");
  });
});
