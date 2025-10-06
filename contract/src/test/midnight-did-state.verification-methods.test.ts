import { beforeEach, describe, expect, it } from "vitest";

import { OperationBuilder } from "../ledger-operation-builder";
import {
  addVerificationMethod,
  createSimulator,
  mockVerificationMethod
} from "./fixtures/simulator";

describe("MidnightDIDSimulator verification methods", () => {
  let simulator = createSimulator();

  beforeEach(() => {
    simulator = createSimulator();
  });

  it("adds a verification method", () => {
    const operations = OperationBuilder.padding([addVerificationMethod()]);
    const ledger = simulator.applyOperations(operations);
    expect(ledger.verificationMethods.member(mockVerificationMethod.id)).toBe(
      true
    );
  });

  it("fails to add duplicate verification method", () => {
    simulator.applyOperation(addVerificationMethod());
    expect(() => simulator.applyOperation(addVerificationMethod())).toThrow();
  });

  it("updates an existing verification method", () => {
    simulator.applyOperation(addVerificationMethod());
    const updated = {
      ...mockVerificationMethod,
      publicKeyJwk: { ...mockVerificationMethod.publicKeyJwk, x: 9n }
    };
    const ledger = simulator.applyOperation(
      OperationBuilder.updateVerificationMethod({
        verificationMethod: updated
      })
    );
    expect(
      ledger.verificationMethods.lookup(mockVerificationMethod.id).publicKeyJwk
    ).toEqual(updated.publicKeyJwk);
  });

  it("fails to update non-existent verification method", () => {
    expect(() =>
      simulator.applyOperation(
        OperationBuilder.updateVerificationMethod({
          verificationMethod: mockVerificationMethod
        })
      )
    ).toThrow();
  });

  it("removes an existing verification method", () => {
    simulator.applyOperation(addVerificationMethod());
    const ledger = simulator.applyOperation(
      OperationBuilder.removeVerificationMethod({
        id: mockVerificationMethod.id
      })
    );
    expect(ledger.verificationMethods.member(mockVerificationMethod.id)).toBe(
      false
    );
  });

  it("fails to remove non-existent verification method", () => {
    expect(() =>
      simulator.applyOperation(
        OperationBuilder.removeVerificationMethod({
          id: mockVerificationMethod.id
        })
      )
    ).toThrow();
  });
});
