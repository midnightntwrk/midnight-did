import { beforeEach, describe, expect, it } from "vitest";

import { OperationBuilder } from "../ledger-operation-builder";
import { addVerificationMethod, createSimulator } from "./fixtures/simulator";

describe("MidnightDIDSimulator lifecycle", () => {
  let simulator = createSimulator();

  beforeEach(() => {
    simulator = createSimulator();
  });

  it("initializes with an empty ledger", () => {
    const ledger = simulator.getLedger();
    expect(ledger.id.bytes.length).toBe(32);
    expect(ledger.version).toBe(0n);
    expect(ledger.active).toBe(true);
    expect(ledger.verificationMethods.isEmpty).toBeTruthy();
    expect(ledger.authenticationRelation.isEmpty).toBeTruthy();
    expect(ledger.capabilityDelegationRelation.isEmpty).toBeTruthy();
    expect(ledger.capabilityInvocationRelation.isEmpty).toBeTruthy();
  });

  it("deactivates the DID", () => {
    const ledger = simulator.applyOperation(OperationBuilder.deactivate());
    expect(ledger.active).toBe(false);
  });

  it("rejects operations after deactivation", () => {
    simulator.applyOperation(OperationBuilder.deactivate());
    expect(() => simulator.applyOperation(addVerificationMethod())).toThrow();
  });

  it("throws when array exceeds max operations", () => {
    const ops = Array.from({ length: 5 }, () => OperationBuilder.deactivate());
    expect(() => simulator.applyOperations(ops)).toThrow(
      "Cannot pad: input exceeds 4 operations"
    );
  });
});
