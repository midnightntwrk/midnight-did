// moved from domain to did package
import { describe, expect, it, vi } from "vitest";

type ContractModule = typeof import("@midnight-ntwrk/midnight-did-contract");

vi.mock("@midnight-ntwrk/midnight-did-contract", () => {
  const DIDContractMock = {
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
    CurveType: { Ed25519: 0, Jubjub: 1 },
    PublicKeyJwk: {},
    Service: {},
  } as const;
  const OperationBuilderMock = {
    defaultPublicKeyJwk: { kty: 0, crv: 0, x: 0n, y: 0n },
  } as const;
  return {
    DIDContract: DIDContractMock as unknown as ContractModule["DIDContract"],
    OperationBuilder:
      OperationBuilderMock as unknown as ContractModule["OperationBuilder"],
  } satisfies Partial<ContractModule>;
});

import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";

import { DIDOperationType, DomainToLedger } from "..";

const { OperationType: LOp, VerificationMethodRelation: LRel } = DIDContract;

describe("DomainToLedger (unit, mocked)", () => {
  it("publicKeyJwk decodes base64url to bigint", () => {
    const out = DomainToLedger.publicKeyJwk({
      kty: "OKP" as any,
      crv: "Ed25519" as any,
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

    expect(DomainToLedger.serviceEndpoint("https://u.example")).toEqual([
      "https://u.example",
      "",
      "",
      "",
    ]);
    expect(() =>
      DomainToLedger.serviceEndpoint(["a", "b", "c", "d", "e"] as any),
    ).toThrow();

    const ledgerService = DomainToLedger.service({
      id: "#svc-1",
      type: "LinkedDomains",
      serviceEndpoint: "https://example.com",
    } as any);
    expect(ledgerService.id).toBe("svc-1");
    expect(DomainToLedger.serviceId("did:midnight:testnet:0#svc-ledger")).toBe(
      "svc-ledger",
    );
    expect(DomainToLedger.serviceId("/services/messaging")).toBe(
      "/services/messaging",
    );
    expect(DomainToLedger.serviceId("  #trimmed\t")).toBe("trimmed");
  });

  it("updateOperation maps domain ops to managed types", () => {
    const vm = {
      id: "did:midnight:testnet:0#key-1",
      type: "JsonWebKey" as any,
      controller: "did:midnight:testnet:0",
      publicKeyJwk: {
        kty: "OKP" as any,
        crv: "Ed25519" as any,
        x: "AQ",
      },
    };
    const add = DomainToLedger.updateOperation({
      type: DIDOperationType.AddVerificationMethod,
      verificationMethod: vm as any,
    });
    expect(add.operationType).toBe(LOp.AddVerificationMethod);
    expect(add.addVerificationMethodOptions.verificationMethod.id).toBe(
      "key-1",
    );

    const rel = DomainToLedger.updateOperation({
      type: DIDOperationType.AddVerificationMethodRelation,
      relation: "Authentication" as any,
      methodId: vm.id as any,
    });
    expect(rel.addVerificationMethodRelationOptions.relation).toBe(
      LRel.Authentication,
    );
    expect(rel.addVerificationMethodRelationOptions.methodId).toBe("key-1");
  });
});
