import { Buffer } from "node:buffer";

// moved from domain to did package
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
    PublicKeyJwk: {},
    Service: {},
  } as const;
  return {
    DIDContract: DIDContractMock as unknown as ContractModule["DIDContract"],
  } satisfies Partial<ContractModule>;
});

import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";

import {
  LedgerToDomain,
  MidnightNetwork,
  parseContractAddress,
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

describe("LedgerToDomain (unit, mocked managed runtime)", () => {
  const bytes32 = (fill: number) => new Uint8Array(32).fill(fill);
  const keyString = (fill: number) =>
    Buffer.from(bytes32(fill)).toString("base64url");
  const keyStringOfLength = (fill: number, length: number) =>
    Buffer.from(new Uint8Array(length).fill(fill)).toString("base64url");
  const bigintTo32Le = (value: bigint) => {
    const bytes = new Uint8Array(32);
    let remaining = value;
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
    return bytes;
  };
  const fieldString = (value: bigint) =>
    Buffer.from(bigintTo32Le(value)).toString("base64url");

  let stubLedger: any;

  beforeEach(() => {
    const idBytes = new Uint8Array(32).fill(1);

    const verificationMethods = makeIterablePairs<string, any>([
      [
        "key-1",
        {
          typ: DIDContract.VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: DIDContract.KeyType.OKP,
            crv: DIDContract.CurveType.Ed25519,
            x: keyString(1),
            y: "",
          },
        },
      ],
    ]);

    const services = makeIterablePairs<string, any>([
      [
        "svc-1",
        {
          id: "svc-1",
          typ: "SVC",
          serviceEndpoint: JSON.stringify("https://u.example"),
        },
      ],
      [
        "svc-2",
        {
          id: "svc-2",
          typ: "SVC2",
          serviceEndpoint: JSON.stringify([
            "wss://x.example",
            { uri: "https://y.example" },
          ]),
        },
      ],
    ]);

    stubLedger = {
      id: { bytes: idBytes },
      version: 1n,
      active: true,
      created: 1n,
      updated: 2n,
      deactivated: false,
      operationCount: 3n,
      alsoKnownAs: makeIterable<string>(["did:alias:one"]),
      verificationMethods,
      schnorrJubjubVerificationMethods: makeIterablePairs<string, any>([]),
      authenticationRelation: makeIterable<string>(["key-1"]),
      assertionMethodRelation: makeIterable<string>([]),
      keyAgreementRelation: makeIterable<string>([]),
      capabilityInvocationRelation: makeIterable<string>([]),
      capabilityDelegationRelation: makeIterable<string>([]),
      services,
    };
  });

  it("publicKeyJwk encodes 32-byte ledger key material as base64url", () => {
    const out = LedgerToDomain.publicKeyJwk({
      kty: DIDContract.KeyType.OKP,
      crv: DIDContract.CurveType.Ed25519,
      x: keyString(7),
      y: "",
    } as any);
    expect(out.kty).toBe("OKP");
    expect(out.crv).toBe("Ed25519");
    expect(out.x).toBe("BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc");
    expect("y" in out).toBe(false);
  });

  it("publicKeyJwk decodes opaque string byte views", () => {
    const encoded = new TextEncoder().encode(keyString(4));
    const out = LedgerToDomain.publicKeyJwk({
      kty: DIDContract.KeyType.OKP,
      crv: DIDContract.CurveType.Ed25519,
      x: encoded,
      y: new Uint8Array(),
    } as any);
    expect(out.x).toBe("BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ");
    expect("y" in out).toBe(false);
  });

  it("publicKeyJwk rejects malformed opaque string values", () => {
    expect(() =>
      LedgerToDomain.publicKeyJwk({
        kty: DIDContract.KeyType.OKP,
        crv: DIDContract.CurveType.Ed25519,
        x: "not-base64url!",
        y: "",
      } as any),
    ).toThrow(/publicKeyJwk.x/);
    expect(() =>
      LedgerToDomain.publicKeyJwk({
        kty: DIDContract.KeyType.OKP,
        crv: DIDContract.CurveType.Ed25519,
        x: { bytes: new Uint8Array() },
        y: "",
      } as any),
    ).toThrow(/unsupported runtime shape: Object/);
  });

  it("publicKeyJwk maps X25519", () => {
    const out = LedgerToDomain.publicKeyJwk({
      kty: DIDContract.KeyType.OKP,
      crv: DIDContract.CurveType.X25519,
      x: keyString(6),
      y: "",
    } as any);
    expect(out.crv).toBe("X25519");
    expect("y" in out).toBe(false);
  });

  it("publicKeyJwk maps BLS12-381 OKP curve values", () => {
    const g1 = LedgerToDomain.publicKeyJwk({
      kty: DIDContract.KeyType.OKP,
      crv: DIDContract.CurveType.BLS12381G1,
      x: keyStringOfLength(8, 48),
      y: "",
    } as any);
    expect(g1).toEqual({
      kty: "OKP",
      crv: "BLS12381G1",
      x: "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
    });

    const g2 = LedgerToDomain.publicKeyJwk({
      kty: DIDContract.KeyType.OKP,
      crv: DIDContract.CurveType.BLS12381G2,
      x: keyStringOfLength(9, 96),
      y: "",
    } as any);
    expect(g2.crv).toBe("BLS12381G2");
    expect("y" in g2).toBe(false);
  });

  it("publicKeyJwk retains y for non-OKP keys", () => {
    const out = LedgerToDomain.publicKeyJwk({
      kty: DIDContract.KeyType.EC,
      crv: DIDContract.CurveType.Jubjub,
      x: keyString(5),
      y: keyString(9),
    } as any);
    expect(out.kty).toBe("EC");
    expect(out.crv).toBe("Jubjub");
    expect(out.x).toBe("BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU");
    expect(out.y).toBe("CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk");
  });

  it("publicKeyJwk maps P-256 curve values", () => {
    const out = LedgerToDomain.publicKeyJwk({
      kty: DIDContract.KeyType.EC,
      crv: DIDContract.CurveType.P256,
      x: keyString(5),
      y: keyString(9),
    } as any);
    expect(out.kty).toBe("EC");
    expect(out.crv).toBe("P-256");
  });

  it("publicKeyJwk maps secp256k1 curve values", () => {
    expect(
      LedgerToDomain.publicKeyJwk({
        kty: DIDContract.KeyType.EC,
        crv: DIDContract.CurveType.Secp256k1,
        x: keyString(6),
        y: keyString(7),
      } as any).crv,
    ).toBe("secp256k1");
  });

  it("schnorrJubjubPublicKeyJwk projects native Jubjub points to canonical JWK", () => {
    const out = LedgerToDomain.schnorrJubjubPublicKeyJwk({
      id: "key-native",
      publicKey: { x: 1n, y: 256n },
    } as any);
    expect(out).toEqual({
      kty: "EC",
      crv: "Jubjub",
      x: fieldString(1n),
      y: fieldString(256n),
    });
  });

  it("service filters blank endpoints and preserves id/type", () => {
    const svc = LedgerToDomain.service({
      id: "svc-x",
      type: "T",
      serviceEndpoint: JSON.stringify("https://a.example"),
    } as any);
    expect(svc.id).toBe("#svc-x");
    expect(typeof svc.serviceEndpoint).toBe("string");
    expect(svc.serviceEndpoint).toBe("https://a.example");

    const didService = LedgerToDomain.service({
      id: "did:midnight:testnet:00#svc-y",
      type: "T",
      serviceEndpoint: JSON.stringify({ uri: "https://b.example" }),
    } as any);
    expect(didService.id).toBe("did:midnight:testnet:00#svc-y");

    const relativeService = LedgerToDomain.service({
      id: "/routes/messaging",
      type: "T",
      serviceEndpoint: JSON.stringify([
        { uri: "https://c.example" },
        "https://c.example/alt",
      ]),
    } as any);
    expect(relativeService.id).toBe("/routes/messaging");

    const networkPathService = LedgerToDomain.service({
      id: "//peer",
      type: "T",
      serviceEndpoint: JSON.stringify({ uri: "https://d.example" }),
    } as any);
    expect(networkPathService.id).toBe("#//peer");

    const legacyService = LedgerToDomain.service({
      id: "legacy",
      type: "Legacy",
      serviceEndpoint: ["https://legacy.example", "", "", ""],
    } as any);
    expect(legacyService.serviceEndpoint).toBe("https://legacy.example");

    const multiTypeService = LedgerToDomain.service({
      id: "svc-multi-type",
      typ: JSON.stringify(["DIDCommV2", "LinkedDomains"]),
      serviceEndpoint: JSON.stringify("https://multi.example"),
    } as any);
    expect(multiTypeService.type).toEqual(["DIDCommV2", "LinkedDomains"]);
  });

  it("service rejects malformed serviceType and serviceEndpoint payloads", () => {
    expect(() =>
      LedgerToDomain.service({
        id: "svc-invalid-type",
        typ: JSON.stringify(["DIDCommV2", "DIDCommV2"]),
        serviceEndpoint: JSON.stringify("https://valid.example"),
      } as any),
    ).toThrow(/Invalid service type/);

    expect(() =>
      LedgerToDomain.service({
        id: "svc-invalid-endpoint",
        typ: "LinkedDomains",
        serviceEndpoint: "not-json",
      } as any),
    ).toThrow(/Invalid serviceEndpoint/);
  });

  it("toJSON flattens ledger to plain JSON with arrays", () => {
    const json = LedgerToDomain.toJSON(stubLedger) as any;
    expect(typeof json.id).toBe("string");
    expect(json.id.length).toBe(64); // 32 bytes hex
    expect(json.version).toBe(1);
    expect(json.active).toBe(true);
    expect(json.operationCount).toBe(3);
    expect(Array.isArray(json.verificationMethods)).toBe(true);
    expect(json.verificationMethods[0].id).toBe("#key-1");
    expect(json.verificationMethods[0].publicKeyJwk.x).toBe(
      "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
    );
    expect(Array.isArray(json.authenticationRelation)).toBe(true);
    expect(json.authenticationRelation[0]).toBe("#key-1");
    expect(Array.isArray(json.services)).toBe(true);
    expect(typeof json.services[0].serviceEndpoint).toBe("string");
    expect(json.services[0].serviceEndpoint).toBe("https://u.example");
    expect(json.services[1].serviceEndpoint).toEqual([
      "wss://x.example",
      { uri: "https://y.example" },
    ]);
  });

  it("ledgerStateToDIDDocument builds DID Document and assigns alsoKnownAs when present", () => {
    const addr = parseContractAddress("0".repeat(64));
    const didSubject = `did:midnight:devnet:${"0".repeat(64)}`;
    const normalizedServices = Array.from(stubLedger.services, ([, service]) =>
      LedgerToDomain.service(service),
    );
    expect(normalizedServices[0].id).toBe("#svc-1");
    expect(normalizedServices[1].id).toBe("#svc-2");
    let doc;
    try {
      doc = LedgerToDomain.ledgerStateToDIDDocument(
        stubLedger,
        MidnightNetwork.DevNet,
        addr,
      );
    } catch (error) {
      console.error("ledger services", normalizedServices);
      throw error;
    }
    expect(doc.id.startsWith("did:midnight:devnet:")).toBe(true);
    expect(doc["@context"]).toEqual([
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/jwk/v1",
    ]);
    expect(doc.controller).toBeDefined();
    expect(doc.verificationMethod?.length).toBe(1);
    expect(doc.authentication?.length).toBe(1);
    expect(doc.verificationMethod?.[0].id).toBe(`${didSubject}#key-1`);
    expect(doc.authentication?.[0]).toBe("#key-1");
    expect(doc).not.toHaveProperty("assertionMethod");
    expect(doc).not.toHaveProperty("keyAgreement");
    expect(doc).not.toHaveProperty("capabilityInvocation");
    expect(doc).not.toHaveProperty("capabilityDelegation");
    expect(doc.service?.length).toBe(2);
    expect(doc.service?.[0].id).toBe(`${didSubject}#svc-1`);
    expect(doc.service?.[0].serviceEndpoint).toBe("https://u.example");
    expect(doc.service?.[1].id).toBe(`${didSubject}#svc-2`);
    expect(doc.service?.[1].serviceEndpoint).toEqual([
      "wss://x.example",
      { uri: "https://y.example" },
    ]);
    expect(doc.alsoKnownAs?.[0]).toBe("did:alias:one");
    expect("y" in (doc.verificationMethod?.[0]?.publicKeyJwk ?? {})).toBe(
      false,
    );
  });

  it("ledgerStateToDIDDocument merges native SchnorrJubjub methods", () => {
    const addr = parseContractAddress("0".repeat(64));
    const didSubject = `did:midnight:devnet:${"0".repeat(64)}`;
    stubLedger.schnorrJubjubVerificationMethods = makeIterablePairs<
      string,
      any
    >([
      [
        "key-schnorr-jubjub",
        {
          id: "key-schnorr-jubjub",
          publicKey: { x: 1n, y: 256n },
        },
      ],
    ]);
    stubLedger.assertionMethodRelation = makeIterable<string>([
      "key-schnorr-jubjub",
    ]);

    const doc = LedgerToDomain.ledgerStateToDIDDocument(
      stubLedger,
      MidnightNetwork.DevNet,
      addr,
    );

    expect(doc.verificationMethod?.length).toBe(2);
    const nativeMethod = doc.verificationMethod?.find((method) =>
      method.id.endsWith("#key-schnorr-jubjub"),
    );
    expect(nativeMethod?.id).toBe(`${didSubject}#key-schnorr-jubjub`);
    expect(nativeMethod?.publicKeyJwk).toEqual({
      kty: "EC",
      crv: "Jubjub",
      x: fieldString(1n),
      y: fieldString(256n),
    });
    expect(doc.assertionMethod).toEqual(["#key-schnorr-jubjub"]);
  });

  it("ledgerStateToDIDDocument rejects duplicate normalized verification method ids", () => {
    const addr = parseContractAddress("0".repeat(64));
    stubLedger.schnorrJubjubVerificationMethods = makeIterablePairs<
      string,
      any
    >([
      [
        "#key-1",
        {
          id: "#key-1",
          publicKey: { x: 1n, y: 256n },
        },
      ],
    ]);

    expect(() =>
      LedgerToDomain.ledgerStateToDIDDocument(
        stubLedger,
        MidnightNetwork.DevNet,
        addr,
      ),
    ).toThrow(/Duplicate verification method id/);
  });

  it("ledgerStateToDIDDocument rejects relations to missing verification methods", () => {
    const addr = parseContractAddress("0".repeat(64));
    stubLedger.authenticationRelation = makeIterable<string>(["missing-key"]);
    expect(() =>
      LedgerToDomain.ledgerStateToDIDDocument(
        stubLedger,
        MidnightNetwork.DevNet,
        addr,
      ),
    ).toThrow(/references missing verification method/);
  });

  it("ledgerStateToMetadata maps counters and timestamps", () => {
    const metadata = LedgerToDomain.ledgerStateToMetadata(stubLedger);
    expect(metadata.versionId).toBe("1");
    expect(metadata.deactivated).toBeUndefined();
    expect(metadata.created).toBe("1970-01-01T00:00:00Z");
    expect(metadata.updated).toBe("1970-01-01T00:00:00Z");
  });

  it("ledgerStateToMetadata reports deactivation state", () => {
    stubLedger.active = false;
    stubLedger.deactivated = true;
    stubLedger.updated = 10_000n;
    const metadata = LedgerToDomain.ledgerStateToMetadata(stubLedger);
    expect(metadata.deactivated).toBe(true);
    expect(metadata.updated).toBe("1970-01-01T00:00:10Z");
  });
});
