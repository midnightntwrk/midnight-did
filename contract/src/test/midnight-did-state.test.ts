import { beforeEach, describe, expect, it } from "vitest";

import { OperationBuilder } from "../ledger-operation-builder";
import {
  CurveType,
  KeyType,
  VerificationMethodRelation,
  VerificationMethodType
} from "../managed/did/contract/index.cjs";
import { MidnightDIDSimulator } from "./midnight-did-simulator";

export const BigIntReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

const mockMethod = {
  id: "did:midnight:xyz#key-1",
  type: VerificationMethodType.JsonWebKey,
  publicKeyJwk: {
    kty: KeyType.EC,
    crv: CurveType.ed25519,
    x: 0n,
    y: 0n
  }
};

describe("MidnightDIDSimulator", () => {
  let sim: MidnightDIDSimulator;

  beforeEach(() => {
    sim = new MidnightDIDSimulator();
  });

  it("initializes with an empty ledger", () => {
    const ledger = sim.getLedger();
    expect(ledger.id.bytes.length).toBe(32);
    expect(ledger.version).toBe(0n);
    expect(ledger.active).toBe(true);
    expect(ledger.verificationMethods.isEmpty).toBeTruthy();
    expect(ledger.authenticationRelation.isEmpty).toBeTruthy();
    expect(ledger.capabilityInvocationRelation.isEmpty).toBeTruthy();
    expect(ledger.capabilityDelegationRelation.isEmpty).toBeTruthy();
  });

  it("adds a verification method", () => {
    const operation = OperationBuilder.addVerificationMethod({
      verificationMethod: mockMethod
    });
    const operations = OperationBuilder.padding(Array.of(operation));
    const ledger = sim.applyOperations(operations);
    expect(ledger.verificationMethods.member(mockMethod.id)).toBeTruthy();
  });

  it("fails to add duplicate verification method", () => {
    sim.applyOperation(
      OperationBuilder.addVerificationMethod({ verificationMethod: mockMethod })
    );
    expect(() =>
      sim.applyOperation(
        OperationBuilder.addVerificationMethod({
          verificationMethod: mockMethod
        })
      )
    ).toThrow();
  });

  it("updates a verification method", () => {
    sim.applyOperation(
      OperationBuilder.addVerificationMethod({ verificationMethod: mockMethod })
    );
    const updated = { ...mockMethod, publicKey: new Uint8Array(32).fill(9) };
    const ledger = sim.applyOperation(
      OperationBuilder.updateVerificationMethod({ verificationMethod: updated })
    );
    expect(
      ledger.verificationMethods.lookup(mockMethod.id).publicKeyJwk
    ).toEqual(updated.publicKeyJwk);
    expect(ledger.verificationMethods.lookup(mockMethod.id).type).toEqual(
      mockMethod.type
    );
    expect(ledger.verificationMethods.lookup(mockMethod.id).id).toEqual(
      mockMethod.id
    );
  });

  it("fails to update non-existent verification method", () => {
    expect(() =>
      sim.applyOperation(
        OperationBuilder.updateVerificationMethod({
          verificationMethod: mockMethod
        })
      )
    ).toThrow();
  });

  it("removes a verification method", () => {
    sim.applyOperation(
      OperationBuilder.addVerificationMethod({ verificationMethod: mockMethod })
    );
    const ledger = sim.applyOperation(
      OperationBuilder.removeVerificationMethod({ id: mockMethod.id })
    );
    expect(ledger.verificationMethods.member(mockMethod.id)).not.toBeTruthy();
  });

  it("fails to remove non-existent verification method", () => {
    expect(() =>
      sim.applyOperation(
        OperationBuilder.removeVerificationMethod({ id: mockMethod.id })
      )
    ).toThrow();
  });

  it("adds and removes a relation", () => {
    sim.applyOperations([
      OperationBuilder.addVerificationMethod({
        verificationMethod: mockMethod
      }),
      OperationBuilder.addVerificationMethodRelation({
        relation: VerificationMethodRelation.Authentication,
        methodId: mockMethod.id
      })
    ]);
    let ledger = sim.getLedger();

    expect(ledger.authenticationRelation.member(mockMethod.id)).toBeTruthy();

    sim.applyOperation(
      OperationBuilder.removeVerificationMethodRelation({
        relation: VerificationMethodRelation.Authentication,
        methodId: mockMethod.id
      })
    );

    ledger = sim.getLedger();
    expect(
      ledger.authenticationRelation.member(mockMethod.id)
    ).not.toBeTruthy();
  });

  it("fails to add relation to unknown method", () => {
    expect(() =>
      sim.applyOperation(
        OperationBuilder.addVerificationMethodRelation({
          relation: VerificationMethodRelation.Authentication,
          methodId: mockMethod.id
        })
      )
    ).toThrow();
  });

  it("fails to remove unknown relation", () => {
    sim.applyOperation(
      OperationBuilder.addVerificationMethod({ verificationMethod: mockMethod })
    );
    expect(() =>
      sim.applyOperation(
        OperationBuilder.removeVerificationMethodRelation({
          relation: VerificationMethodRelation.Authentication,
          methodId: mockMethod.id
        })
      )
    ).toThrow();
  });

  it("deactivates the DID", () => {
    const ledger = sim.applyOperation(OperationBuilder.deactivate());
    expect(ledger.active).toBe(false);
  });

  it("fails to perform operations after deactivation", () => {
    sim.applyOperation(OperationBuilder.deactivate());
    expect(() =>
      sim.applyOperation(
        OperationBuilder.addVerificationMethod({
          verificationMethod: mockMethod
        })
      )
    ).toThrow();
  });

  it("batch update mode: initializes with multiple operations", () => {
    const operations = [
      OperationBuilder.addVerificationMethod({
        verificationMethod: mockMethod
      }),
      OperationBuilder.addVerificationMethodRelation({
        relation: VerificationMethodRelation.Authentication,
        methodId: mockMethod.id
      })
    ];

    sim = new MidnightDIDSimulator();
    sim.applyOperations(OperationBuilder.padding(operations));
    const ledger = sim.getLedger();
    expect(ledger.verificationMethods.member(mockMethod.id)).toBeTruthy();
    expect(ledger.authenticationRelation.member(mockMethod.id)).toBeTruthy();
  });

  it("throws error when more than 5 operations are passed", () => {
    const ops = Array.from({ length: 5 }, () => OperationBuilder.deactivate());
    expect(() => new MidnightDIDSimulator().applyOperations(ops)).toThrow(
      "Cannot pad: input exceeds 4 operations"
    );
  });
});
