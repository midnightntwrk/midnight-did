import { describe, expect, it } from "vitest";

import {
  createVerificationMethod,
  CurveType,
  KeyType,
  parseDID,
  parseDIDKeyID,
  VerificationMethodRelationType,
  VerificationMethodType
} from "../did-document";
import { DIDOperationType } from "../did-operations";
import { DomainToLedger } from "../domain-to-ledger";
import {
  CurveType as LedgerCurveType,
  KeyType as LedgerKeyType,
  OperationType as LedgerOperationType,
  VerificationMethodRelation as LedgerVerificationMethodRelation,
  VerificationMethodType as LedgerVerificationMethodType
} from "../managed/did/contract/index.cjs";

describe("DomainToLedger mappings", () => {
  it("maps KeyType correctly including OKP", () => {
    expect(DomainToLedger.KeyTypeMap[KeyType.EC]).toBe(LedgerKeyType.EC);
    expect(DomainToLedger.KeyTypeMap[KeyType.RSA]).toBe(LedgerKeyType.RSA);
    expect(DomainToLedger.KeyTypeMap[KeyType.oct]).toBe(LedgerKeyType.oct);
    expect(DomainToLedger.KeyTypeMap[KeyType.OKP]).toBe(LedgerKeyType.OKP);
  });

  it("maps CurveType correctly", () => {
    expect(DomainToLedger.CurveTypeMap[CurveType.ed25519]).toBe(
      LedgerCurveType.ed25519
    );
    expect(DomainToLedger.CurveTypeMap[CurveType.Jubjub]).toBe(
      LedgerCurveType.Jubjub
    );
  });

  it("maps VerificationMethodType correctly", () => {
    expect(
      DomainToLedger.VerificationMethodTypeMap[VerificationMethodType.Undefined]
    ).toBe(LedgerVerificationMethodType.Undefined);
    expect(
      DomainToLedger.VerificationMethodTypeMap[
        VerificationMethodType.JsonWebKey
      ]
    ).toBe(LedgerVerificationMethodType.JsonWebKey);
  });

  it("maps VerificationMethodRelation correctly", () => {
    expect(
      DomainToLedger.VerificationMethodRelationMap[
        VerificationMethodRelationType.Authentication
      ]
    ).toBe(LedgerVerificationMethodRelation.Authentication);
    expect(
      DomainToLedger.VerificationMethodRelationMap[
        VerificationMethodRelationType.AssertionMethod
      ]
    ).toBe(LedgerVerificationMethodRelation.AssertionMethod);
    expect(
      DomainToLedger.VerificationMethodRelationMap[
        VerificationMethodRelationType.KeyAgreement
      ]
    ).toBe(LedgerVerificationMethodRelation.KeyAgreement);
    expect(
      DomainToLedger.VerificationMethodRelationMap[
        VerificationMethodRelationType.CapabilityInvocation
      ]
    ).toBe(LedgerVerificationMethodRelation.CapabilityInvocation);
    expect(
      DomainToLedger.VerificationMethodRelationMap[
        VerificationMethodRelationType.CapabilityDelegation
      ]
    ).toBe(LedgerVerificationMethodRelation.CapabilityDelegation);
  });
});

describe("DomainToLedger helpers", () => {
  const jwk = { kty: KeyType.EC, crv: CurveType.ed25519, x: 1n, y: 2n };

  it("converts PublicKeyJwk", () => {
    const out = DomainToLedger.publicKeyJwk(jwk);
    expect(out.kty).toBe(LedgerKeyType.EC);
    expect(out.crv).toBe(LedgerCurveType.ed25519);
    expect(out.x).toBe(1n);
    expect(out.y).toBe(2n);
  });

  it("converts verificationMethod", () => {
    const did = `did:midnight:devnet:${"0".repeat(68)}`;
    const vm = createVerificationMethod({
      id: parseDIDKeyID(`${did}#key-1`),
      type: VerificationMethodType.JsonWebKey,
      controller: parseDID(did),
      publicKeyJwk: jwk
    });
    const out = DomainToLedger.verificationMethod(vm);
    expect(out.id).toBe(vm.id);
    expect(out.type).toBe(LedgerVerificationMethodType.JsonWebKey);
    expect(out.publicKeyJwk.kty).toBe(LedgerKeyType.EC);
  });

  it("converts service: string type", () => {
    const svc = {
      id: "svc-1",
      type: "LinkedDomains",
      serviceEndpoint: ["https://a"]
    };
    const out = DomainToLedger.service(svc);
    expect(out.id).toBe("svc-1");
    expect(out.type).toBe("LinkedDomains");
    expect(out.serviceEndpoint.length).toBe(4);
    expect(out.serviceEndpoint[0]).toBe("https://a");
    expect(out.serviceEndpoint[1]).toBe("");
  });

  it("serviceType accepts one-element array and rejects others", () => {
    expect(DomainToLedger.serviceType("A")).toBe("A");
    expect(DomainToLedger.serviceType(["A"])).toBe("A");
    expect(() => DomainToLedger.serviceType(["A", "B"])).toThrow(
      /exactly one element/
    );
  });

  it("serviceEndpoint pads to 4 and rejects >4", () => {
    expect(DomainToLedger.serviceEndpoint("https://x")).toEqual([
      "https://x",
      "",
      "",
      ""
    ]);
    expect(DomainToLedger.serviceEndpoint(["a", "b"])).toEqual([
      "a",
      "b",
      "",
      ""
    ]);
    expect(() =>
      DomainToLedger.serviceEndpoint(["a", "b", "c", "d", "e"])
    ).toThrow(/at most four/);
  });
});

describe("DomainToLedger operations", () => {
  const did = `did:midnight:devnet:${"0".repeat(68)}`;
  const vm = createVerificationMethod({
    id: parseDIDKeyID(`${did}#key-1`),
    type: VerificationMethodType.JsonWebKey,
    controller: parseDID(did),
    publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.ed25519, x: 3n, y: 4n }
  });

  it("maps Add/Update/Remove VerificationMethod ops", () => {
    const add = DomainToLedger.updateOperation({
      type: DIDOperationType.AddVerificationMethod,
      verificationMethod: vm
    });
    expect(add.operationType).toBe(LedgerOperationType.AddVerificationMethod);
    expect(add.addVerificationMethodOptions.verificationMethod.id).toBe(vm.id);

    const upd = DomainToLedger.updateOperation({
      type: DIDOperationType.UpdateVerificationMethod,
      verificationMethod: vm
    });
    expect(upd.operationType).toBe(
      LedgerOperationType.UpdateVerificationMethod
    );

    const rem = DomainToLedger.updateOperation({
      type: DIDOperationType.RemoveVerificationMethod,
      id: vm.id
    });
    expect(rem.operationType).toBe(
      LedgerOperationType.RemoveVerificationMethod
    );
    expect(rem.removeVerificationMethodOptions.id).toBe(vm.id);
  });

  it("maps relation ops", () => {
    const addRel = DomainToLedger.updateOperation({
      type: DIDOperationType.AddVerificationMethodRelation,
      relation: VerificationMethodRelationType.Authentication,
      methodId: vm.id
    });
    expect(addRel.operationType).toBe(
      LedgerOperationType.AddVerificationMethodRelation
    );
    expect(addRel.addVerificationMethodRelationOptions.relation).toBe(
      LedgerVerificationMethodRelation.Authentication
    );

    const remRel = DomainToLedger.updateOperation({
      type: DIDOperationType.RemoveVerificationMethodRelation,
      relation: VerificationMethodRelationType.AssertionMethod,
      methodId: vm.id
    });
    expect(remRel.operationType).toBe(
      LedgerOperationType.RemoveVerificationMethodRelation
    );
    expect(remRel.removeVerificationMethodRelationOptions.relation).toBe(
      LedgerVerificationMethodRelation.AssertionMethod
    );
  });

  it("maps service ops", () => {
    const service = {
      id: "svc-1",
      type: "LinkedDomains",
      serviceEndpoint: ["u"]
    };
    const add = DomainToLedger.updateOperation({
      type: DIDOperationType.AddService,
      service
    });
    expect(add.operationType).toBe(LedgerOperationType.AddService);
    expect(add.addServiceOptions.service.id).toBe("svc-1");

    const upd = DomainToLedger.updateOperation({
      type: DIDOperationType.UpdateService,
      service
    });
    expect(upd.operationType).toBe(LedgerOperationType.UpdateService);

    const rem = DomainToLedger.updateOperation({
      type: DIDOperationType.RemoveService,
      serviceId: "svc-1"
    });
    expect(rem.operationType).toBe(LedgerOperationType.RemoveService);
    expect(rem.removeServiceOptions.id).toBe("svc-1");
  });

  it("updateOperations maps arrays", () => {
    const ops = DomainToLedger.updateOperations([
      { type: DIDOperationType.Deactivate },
      { type: DIDOperationType.RemoveService, serviceId: "x" }
    ]);
    expect(ops.length).toBe(2);
    expect(ops[0].operationType).toBe(LedgerOperationType.Deactivate);
    expect(ops[1].operationType).toBe(LedgerOperationType.RemoveService);
  });
});
