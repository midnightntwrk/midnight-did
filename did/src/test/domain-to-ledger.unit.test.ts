// moved from domain to did package
import { describe, expect, it, vi } from "vitest";

// Mock managed enums to avoid loading WASM/runtime
vi.mock(
  "@midnight-ntwrk/midnight-did-contract/dist/managed/did/contract/index.cjs",
  () => ({
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
    VerificationMethodRelation: {
      Undefined: 0,
      Authentication: 1,
      AssertionMethod: 2,
      KeyAgreement: 3,
      CapabilityInvocation: 4,
      CapabilityDelegation: 5,
    },
    VerificationMethodType: { Undefined: 0, JsonWebKey: 1 },
    KeyType: { EC: 0, RSA: 1, oct: 2, OKP: 3 },
    CurveType: { ed25519: 0, Jubjub: 1 },
  }),
);

// Import after mocks are defined
import {
  OperationType as LOp,
  VerificationMethodRelation as LRel,
} from "@midnight-ntwrk/midnight-did-contract/dist/managed/did/contract/index.cjs";

import { DIDOperationType, DomainToLedger } from "..";

describe("DomainToLedger (unit, mocked)", () => {
  it("publicKeyJwk decodes base64url to bigint", () => {
    const out = DomainToLedger.publicKeyJwk({
      kty: "OKP" as any,
      crv: "ed25519" as any,
      x: "AQ",
    } as any);
    expect(out.x).toBe(1n);
    expect(out.y).toBe(0n);
  });

  it("publicKeyJwk retains y for JubJub keys", () => {
    const out = DomainToLedger.publicKeyJwk({
      kty: "EC" as any,
      crv: "Jubjub" as any,
      x: "AQ",
      y: "Ag",
    } as any);
    expect(out.x).toBe(1n);
    expect(out.y).toBe(2n);
  });

  it("serviceType and serviceEndpoint behave correctly", () => {
    expect(DomainToLedger.serviceType("A")).toBe("A");
    expect(DomainToLedger.serviceType(["A"])).toBe("A");
    expect(() => DomainToLedger.serviceType(["A", "B"] as any)).toThrow();

    expect(DomainToLedger.serviceEndpoint("u")).toEqual(["u", "", "", ""]);
    expect(() =>
      DomainToLedger.serviceEndpoint(["a", "b", "c", "d", "e"] as any),
    ).toThrow();
  });

  it("updateOperation maps domain ops to managed types", () => {
    const vm = {
      id: "did:midnight:testnet:0#key-1",
      type: "JsonWebKey" as any,
      controller: "did:midnight:testnet:0",
      publicKeyJwk: {
        kty: "OKP" as any,
        crv: "ed25519" as any,
        x: "AQ",
      },
    };
    const add = DomainToLedger.updateOperation({
      type: DIDOperationType.AddVerificationMethod,
      verificationMethod: vm as any,
    });
    expect(add.operationType).toBe(LOp.AddVerificationMethod);

    const rel = DomainToLedger.updateOperation({
      type: DIDOperationType.AddVerificationMethodRelation,
      relation: "Authentication" as any,
      methodId: vm.id,
    });
    expect(rel.addVerificationMethodRelationOptions.relation).toBe(
      LRel.Authentication,
    );
  });
});
