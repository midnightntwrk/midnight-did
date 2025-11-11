import { describe, expect, it } from "vitest";

import { OperationBuilder } from "../ledger-operation-builder";
import { createSimulator } from "./fixtures/simulator";

describe("MidnightDIDSimulator alsoKnownAs operations", () => {
  it("adds an alias to the alsoKnownAs set", () => {
    const simulator = createSimulator();
    simulator.applyOperations(
      OperationBuilder.padding([OperationBuilder.addAlsoKnownAs("aka-1")])
    );
    const ledger = simulator.getLedger();
    expect(ledger.alsoKnownAs.member("aka-1")).toBe(true);
  });

  it("fails to add duplicate alias", () => {
    const simulator = createSimulator();
    simulator.applyOperation(OperationBuilder.addAlsoKnownAs("aka-dup"));
    expect(() =>
      simulator.applyOperation(OperationBuilder.addAlsoKnownAs("aka-dup"))
    ).toThrow();
  });

  it("removes an existing alias", () => {
    const simulator = createSimulator();
    simulator.applyOperation(OperationBuilder.addAlsoKnownAs("aka-rem"));
    expect(simulator.getLedger().alsoKnownAs.member("aka-rem")).toBe(true);

    simulator.applyOperation(OperationBuilder.removeAlsoKnownAs("aka-rem"));
    expect(simulator.getLedger().alsoKnownAs.member("aka-rem")).toBe(false);
  });

  it("fails to remove non-existent alias", () => {
    const simulator = createSimulator();
    expect(() =>
      simulator.applyOperation(
        OperationBuilder.removeAlsoKnownAs("aka-missing")
      )
    ).toThrow();
  });
});
