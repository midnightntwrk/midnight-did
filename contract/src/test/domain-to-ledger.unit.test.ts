import { describe, expect, it, vi } from "vitest";

vi.mock("../managed/did/contract/index.cjs", () => ({
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
    Deactivate: 11
  },
  VerificationMethodRelation: {
    Undefined: 0,
    Authentication: 1,
    AssertionMethod: 2,
    KeyAgreement: 3,
    CapabilityInvocation: 4,
    CapabilityDelegation: 5
  },
  VerificationMethodType: { Undefined: 0, JsonWebKey: 1 },
  KeyType: { EC: 0, RSA: 1, oct: 2, OKP: 3 },
  CurveType: { ed25519: 0, Jubjub: 1 }
}));

import { DIDOperationType } from "../did-operations";
import { DomainToLedger } from "../domain-to-ledger";
import {
  CurveType as LCurveType,
  KeyType as LKeyType,
  OperationType as LOp,
  VerificationMethodRelation as LRel,
  VerificationMethodType as LVMType
} from "../managed/did/contract/index.cjs";

describe("DomainToLedger (unit, mocked)", () => {
  it("publicKeyJwk decodes base64url to bigint", () => {
    const out = DomainToLedger.publicKeyJwk({
      kty: "EC" as any,
      crv: "ed25519" as any,
      x: "AQ",
      y: "Ag"
    } as any);
    expect(typeof out.x).toBe("bigint");
    expect(out.x).toBe(1n);
    expect(out.y).toBe(2n);
  });

  it("serviceType handles string and one-element array, rejects larger arrays", () => {
    expect(DomainToLedger.serviceType("A")).toBe("A");
    expect(DomainToLedger.serviceType(["A"])).toBe("A");
    expect(() => DomainToLedger.serviceType(["A", "B"] as any)).toThrow(
      /exactly one element/
    );
  });

  it("serviceEndpoint pads to length 4 and rejects >4", () => {
    expect(DomainToLedger.serviceEndpoint("u")).toEqual(["u", "", "", ""]);
    expect(DomainToLedger.serviceEndpoint(["a", "b"]).slice(0, 2)).toEqual([
      "a",
      "b"
    ]);
    expect(() =>
      DomainToLedger.serviceEndpoint(["a", "b", "c", "d", "e"] as any)
    ).toThrow(/at most four/);
  });

  it("updateOperation maps domain ops to managed OperationType", () => {
    const vm = {
      id: "did:midnight:testnet:0#key-1",
      type: "JsonWebKey" as any,
      controller: "did:midnight:testnet:0",
      publicKeyJwk: {
        kty: "EC" as any,
        crv: "ed25519" as any,
        x: "AQ",
        y: "Ag"
      }
    };
    const add = DomainToLedger.updateOperation({
      type: DIDOperationType.AddVerificationMethod,
      verificationMethod: vm as any
    });
    expect(add.operationType).toBe(LOp.AddVerificationMethod);

    const rel = DomainToLedger.updateOperation({
      type: DIDOperationType.AddVerificationMethodRelation,
      relation: "Authentication" as any,
      methodId: vm.id
    });
    expect(rel.operationType).toBe(LOp.AddVerificationMethodRelation);
    expect(rel.addVerificationMethodRelationOptions.relation).toBe(
      LRel.Authentication
    );

    const svc = DomainToLedger.updateOperation({
      type: DIDOperationType.AddService,
      service: { id: "svc-1", type: "T", serviceEndpoint: ["u"] } as any
    });
    expect(svc.operationType).toBe(LOp.AddService);
    expect(Array.isArray(svc.addServiceOptions.service.serviceEndpoint)).toBe(
      true
    );
  });
});
