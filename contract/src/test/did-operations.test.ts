import { describe, expect, it } from "vitest";

import {
  createService,
  createVerificationMethod,
  CurveType,
  KeyType,
  parseDID,
  parseDIDKeyID,
  VerificationMethodType
} from "../did-document";
import { DIDOperationSchema, DIDOperationType } from "../did-operations";

describe("DIDOperationSchema", () => {
  const did = `did:midnight:devnet:${"0".repeat(68)}`;
  const vm = createVerificationMethod({
    id: parseDIDKeyID(`${did}#key-1`),
    type: VerificationMethodType.JsonWebKey,
    controller: parseDID(did),
    publicKeyJwk: { kty: KeyType.EC, crv: CurveType.ed25519, x: 1n, y: 2n }
  });
  const service = createService({
    id: "svc-1",
    type: "LinkedDomains",
    serviceEndpoint: ["https://a"]
  });

  it("parses AddVerificationMethod", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.AddVerificationMethod,
      verificationMethod: vm
    });
    expect(op.type).toBe(DIDOperationType.AddVerificationMethod);
  });

  it("parses UpdateVerificationMethod", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.UpdateVerificationMethod,
      verificationMethod: vm
    });
    expect(op.type).toBe(DIDOperationType.UpdateVerificationMethod);
  });

  it("parses RemoveVerificationMethod", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.RemoveVerificationMethod,
      id: vm.id
    });
    expect(op.type).toBe(DIDOperationType.RemoveVerificationMethod);
  });

  it("parses AddVerificationMethodRelation", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.AddVerificationMethodRelation,
      relation: "Authentication",
      methodId: vm.id
    });
    expect(op.type).toBe(DIDOperationType.AddVerificationMethodRelation);
  });

  it("parses RemoveVerificationMethodRelation", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.RemoveVerificationMethodRelation,
      relation: "AssertionMethod",
      methodId: vm.id
    });
    expect(op.type).toBe(DIDOperationType.RemoveVerificationMethodRelation);
  });

  it("parses Deactivate", () => {
    const op = DIDOperationSchema.parse({ type: DIDOperationType.Deactivate });
    expect(op.type).toBe(DIDOperationType.Deactivate);
  });

  it("rejects invalid discriminant", () => {
    expect(() => DIDOperationSchema.parse({ type: "Unknown" })).toThrow();
  });
});
