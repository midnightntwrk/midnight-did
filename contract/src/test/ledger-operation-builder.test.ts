import { describe, expect, it } from "vitest";

import { OperationBuilder } from "../ledger-operation-builder";
import {
  CurveType,
  KeyType,
  OperationType,
  VerificationMethodRelation,
  VerificationMethodType
} from "../managed/did/contract/index.cjs";

describe("OperationBuilder", () => {
  const sampleVM = {
    id: "key-1",
    type: VerificationMethodType.JsonWebKey,
    publicKeyJwk: {
      kty: KeyType.EC,
      crv: CurveType.Ed25519,
      x: 8n,
      y: 16n
    }
  };

  it("should build addVerificationMethod operation", () => {
    const op = OperationBuilder.addVerificationMethod({
      verificationMethod: sampleVM
    });
    expect(op.operationType).toBe(OperationType.AddVerificationMethod);
    expect(op.addVerificationMethodOptions.verificationMethod).toEqual(
      sampleVM
    );
  });

  it("should build updateVerificationMethod operation", () => {
    const op = OperationBuilder.updateVerificationMethod({
      verificationMethod: sampleVM
    });
    expect(op.operationType).toBe(OperationType.UpdateVerificationMethod);
    expect(op.updateVerificationMethodOptions.verificationMethod).toEqual(
      sampleVM
    );
  });

  it("should build removeVerificationMethod operation", () => {
    const op = OperationBuilder.removeVerificationMethod({ id: "key-1" });
    expect(op.operationType).toBe(OperationType.RemoveVerificationMethod);
    expect(op.removeVerificationMethodOptions.id).toBe("key-1");
  });

  it("should build addVerificationMethodRelation operation", () => {
    const op = OperationBuilder.addVerificationMethodRelation({
      relation: VerificationMethodRelation.Authentication,
      methodId: "key-1"
    });
    expect(op.operationType).toBe(OperationType.AddVerificationMethodRelation);
    expect(op.addVerificationMethodRelationOptions.relation).toBe(
      VerificationMethodRelation.Authentication
    );
    expect(op.addVerificationMethodRelationOptions.methodId).toBe("key-1");
  });

  it("should build removeVerificationMethodRelation operation", () => {
    const op = OperationBuilder.removeVerificationMethodRelation({
      relation: VerificationMethodRelation.AssertionMethod,
      methodId: "key-2"
    });
    expect(op.operationType).toBe(
      OperationType.RemoveVerificationMethodRelation
    );
    expect(op.removeVerificationMethodRelationOptions.relation).toBe(
      VerificationMethodRelation.AssertionMethod
    );
    expect(op.removeVerificationMethodRelationOptions.methodId).toBe("key-2");
  });

  it("should build addService operation", () => {
    const service = {
      id: "svc-1",
      type: "LinkedDomains",
      serviceEndpoint: JSON.stringify("https://example.com")
    };
    const op = OperationBuilder.addService({ service: service });
    expect(op.operationType).toBe(OperationType.AddService);
    expect(op.addServiceOptions.service).toEqual(service);
  });

  it("should build updateService operation", () => {
    const service = {
      id: "svc-1",
      type: "LinkedDomains",
      serviceEndpoint: JSON.stringify([
        "https://example.org",
        { uri: "https://example.org/alt" }
      ])
    };
    const op = OperationBuilder.updateService({ service: service });
    expect(op.operationType).toBe(OperationType.UpdateService);
    expect(op.updateServiceOptions.service).toEqual(service);
  });

  it("should build removeService operation", () => {
    const op = OperationBuilder.removeService({ id: "svc-1" });
    expect(op.operationType).toBe(OperationType.RemoveService);
    expect(op.removeServiceOptions.id).toBe("svc-1");
  });

  it("should build addAlsoKnownAs operation", () => {
    const op = OperationBuilder.addAlsoKnownAs("aka-1");
    expect(op.operationType).toBe(OperationType.AddAlsoKnownAs);
    expect(op.addAlsoKnownAsOptions.value).toBe("aka-1");
  });

  it("should build removeAlsoKnownAs operation", () => {
    const op = OperationBuilder.removeAlsoKnownAs("aka-1");
    expect(op.operationType).toBe(OperationType.RemoveAlsoKnownAs);
    expect(op.removeAlsoKnownAsOptions.value).toBe("aka-1");
  });

  it("should build deactivate operation", () => {
    const op = OperationBuilder.deactivate();
    expect(op.operationType).toBe(OperationType.Deactivate);
  });

  it("padding pads to exactly 4 operations and rejects >4", () => {
    const ops = [OperationBuilder.deactivate(), OperationBuilder.deactivate()];
    const padded = OperationBuilder.padding(ops);
    expect(padded.length).toBe(4);
    // first two preserved, last two undefined ops
    expect(padded[0].operationType).toBe(OperationType.Deactivate);
    expect(padded[1].operationType).toBe(OperationType.Deactivate);
    expect(padded[2].operationType).toBe(OperationType.Undefined);
    expect(padded[3].operationType).toBe(OperationType.Undefined);

    expect(() =>
      OperationBuilder.padding([
        OperationBuilder.deactivate(),
        OperationBuilder.deactivate(),
        OperationBuilder.deactivate(),
        OperationBuilder.deactivate(),
        OperationBuilder.deactivate()
      ])
    ).toThrow(/exceeds 4/);
  });

  it("verifyOperations accepts well-formed array of 4 operations", () => {
    const addVM = OperationBuilder.addVerificationMethod({
      verificationMethod: sampleVM
    });
    const updVM = OperationBuilder.updateVerificationMethod({
      verificationMethod: sampleVM
    });
    const addRel = OperationBuilder.addVerificationMethodRelation({
      relation: VerificationMethodRelation.Authentication,
      methodId: "key-1"
    });
    const addSvc = OperationBuilder.addService({
      service: {
        id: "svc-1",
        type: "LinkedDomains",
        serviceEndpoint: JSON.stringify(["a", { uri: "b" }])
      }
    });
    const out = OperationBuilder.verifyOperations([
      addVM,
      updVM,
      addRel,
      addSvc
    ]);
    expect(out).toHaveLength(4);
    expect(out[0].operationType).toBe(OperationType.AddVerificationMethod);
    expect(out[3].operationType).toBe(OperationType.AddService);
  });

  it("verifyOperations rejects non-array and >4 length", () => {
    expect(() => OperationBuilder.verifyOperations({} as any)).toThrow(
      /must be an array/
    );
    expect(() =>
      OperationBuilder.verifyOperations([
        OperationBuilder.deactivate(),
        OperationBuilder.deactivate(),
        OperationBuilder.deactivate(),
        OperationBuilder.deactivate(),
        OperationBuilder.deactivate()
      ] as any)
    ).toThrow(/at most 4/);
  });

  it("verifyOperations rejects invalid operationType and malformed shapes", () => {
    const bad = OperationBuilder.deactivate();
    (bad as any).operationType = 999; // invalid enum range
    // Use three valid ops to reach length 4
    const ops = [
      bad,
      OperationBuilder.addVerificationMethod({ verificationMethod: sampleVM }),
      OperationBuilder.updateVerificationMethod({
        verificationMethod: sampleVM
      }),
      OperationBuilder.addService({
        service: {
          id: "s",
          type: "T",
          serviceEndpoint: JSON.stringify("https://example.com")
        }
      })
    ];
    expect(() => OperationBuilder.verifyOperations(ops as any)).toThrow(
      /operationType/
    );

    // Invalid relation value in removeVerificationMethodRelationOptions
    const okOps = [
      OperationBuilder.addVerificationMethod({ verificationMethod: sampleVM }),
      OperationBuilder.updateVerificationMethod({
        verificationMethod: sampleVM
      }),
      OperationBuilder.removeVerificationMethodRelation({
        relation: -1 as any,
        methodId: "k"
      }),
      OperationBuilder.addService({
        service: {
          id: "s",
          type: "T",
          serviceEndpoint: JSON.stringify("https://example.org")
        }
      })
    ];
    expect(() => OperationBuilder.verifyOperations(okOps as any)).toThrow(
      /removeVerificationMethodRelationOptions\.relation/
    );

    // Invalid serviceEndpoint length in updateServiceOptions
    const ops2 = [
      OperationBuilder.addVerificationMethod({ verificationMethod: sampleVM }),
      OperationBuilder.updateVerificationMethod({
        verificationMethod: sampleVM
      }),
      OperationBuilder.addVerificationMethodRelation({
        relation: VerificationMethodRelation.Authentication,
        methodId: "k"
      }),
      OperationBuilder.updateService({
        service: {
          id: "s",
          type: "T",
          serviceEndpoint: 42 as any
        }
      })
    ];
    expect(() => OperationBuilder.verifyOperations(ops2 as any)).toThrow(
      /updateServiceOptions\.service\.serviceEndpoint/
    );

    const ops3 = [
      OperationBuilder.addVerificationMethod({ verificationMethod: sampleVM }),
      OperationBuilder.updateVerificationMethod({
        verificationMethod: sampleVM
      }),
      OperationBuilder.addVerificationMethodRelation({
        relation: VerificationMethodRelation.Authentication,
        methodId: "k"
      }),
      OperationBuilder.updateService({
        service: {
          id: "s",
          type: "T",
          serviceEndpoint: "not-json"
        }
      })
    ];
    expect(() => OperationBuilder.verifyOperations(ops3 as any)).toThrow(
      /expected valid JSON string/
    );
  });
});
