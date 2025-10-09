import {
  createVerificationMethod,
  CurveType,
  KeyType,
  parseDID,
  parseDIDKeyID,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { describe, expect, it } from "vitest";

import { DIDOperationSchema, DIDOperationType } from "../did-operations";

describe("DIDOperationSchema (did)", () => {
  const did = `did:midnight:devnet:${"0".repeat(68)}`;
  const vm = createVerificationMethod({
    id: parseDIDKeyID(`${did}#key-1`),
    type: VerificationMethodType.JsonWebKey,
    controller: parseDID(did),
    publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: "AQ" },
  });

  it("parses AddVerificationMethod", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.AddVerificationMethod,
      verificationMethod: vm,
    });
    expect(op.type).toBe(DIDOperationType.AddVerificationMethod);
  });

  it("parses UpdateVerificationMethod", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.UpdateVerificationMethod,
      verificationMethod: vm,
    });
    expect(op.type).toBe(DIDOperationType.UpdateVerificationMethod);
  });

  it("parses RemoveVerificationMethod", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.RemoveVerificationMethod,
      id: vm.id,
    });
    expect(op.type).toBe(DIDOperationType.RemoveVerificationMethod);
  });

  it("parses AddVerificationMethodRelation", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.AddVerificationMethodRelation,
      relation: "Authentication",
      methodId: vm.id,
    });
    expect(op.type).toBe(DIDOperationType.AddVerificationMethodRelation);
  });

  it("parses RemoveVerificationMethodRelation", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.RemoveVerificationMethodRelation,
      relation: "AssertionMethod",
      methodId: vm.id,
    });
    expect(op.type).toBe(DIDOperationType.RemoveVerificationMethodRelation);
  });

  it("parses AddAlsoKnownAs when aliasUri is a valid URI", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.AddAlsoKnownAs,
      aliasUri: "did:example:aka-1",
    });
    expect(op.type).toBe(DIDOperationType.AddAlsoKnownAs);
  });

  it("rejects AddAlsoKnownAs when aliasUri is not a URI", () => {
    expect(() =>
      DIDOperationSchema.parse({
        type: DIDOperationType.AddAlsoKnownAs,
        aliasUri: "not-an-uri",
      }),
    ).toThrow(/aliasUri must be a valid RFC3986 URI/);
  });

  it("parses RemoveAlsoKnownAs when aliasUri is a valid URI", () => {
    const op = DIDOperationSchema.parse({
      type: DIDOperationType.RemoveAlsoKnownAs,
      aliasUri: "did:example:aka-1",
    });
    expect(op.type).toBe(DIDOperationType.RemoveAlsoKnownAs);
  });

  it("rejects RemoveAlsoKnownAs when aliasUri is not a URI", () => {
    expect(() =>
      DIDOperationSchema.parse({
        type: DIDOperationType.RemoveAlsoKnownAs,
        aliasUri: "aka-1",
      }),
    ).toThrow(/aliasUri must be a valid RFC3986 URI/);
  });

  it("parses Deactivate", () => {
    const op = DIDOperationSchema.parse({ type: DIDOperationType.Deactivate });
    expect(op.type).toBe(DIDOperationType.Deactivate);
  });

  it("rejects invalid discriminant", () => {
    expect(() => DIDOperationSchema.parse({ type: "Unknown" })).toThrow();
  });
});
