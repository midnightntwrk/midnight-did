import { beforeEach, describe, expect, it } from "vitest";

import { OperationBuilder } from "../ledger-operation-builder";
import {
  addAuthenticationRelation,
  addVerificationMethod,
  createSimulator,
  mockAuthenticationRelation,
  mockVerificationMethod
} from "./fixtures/simulator";

describe("MidnightDIDSimulator verification relations", () => {
  let simulator = createSimulator();

  beforeEach(() => {
    simulator = createSimulator();
  });

  it("adds and removes a relation", () => {
    simulator.applyOperations([
      addVerificationMethod(),
      addAuthenticationRelation()
    ]);
    let ledger = simulator.getLedger();
    expect(
      ledger.authenticationRelation.member(mockVerificationMethod.id)
    ).toBe(true);

    simulator.applyOperation(
      OperationBuilder.removeVerificationMethodRelation(
        mockAuthenticationRelation
      )
    );
    ledger = simulator.getLedger();
    expect(
      ledger.authenticationRelation.member(mockVerificationMethod.id)
    ).toBe(false);
  });

  it("fails to add relation for unknown method", () => {
    expect(() =>
      simulator.applyOperation(addAuthenticationRelation())
    ).toThrow();
  });

  it("fails to remove unknown relation", () => {
    simulator.applyOperation(addVerificationMethod());
    expect(() =>
      simulator.applyOperation(
        OperationBuilder.removeVerificationMethodRelation(
          mockAuthenticationRelation
        )
      )
    ).toThrow();
  });
});
