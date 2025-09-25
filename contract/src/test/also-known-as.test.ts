import { describe, expect, it } from "vitest";

import { OperationBuilder } from "../ledger-operation-builder";
import {
  type DIDUpdateOperation,
  OperationType
} from "../managed/did/contract/index.cjs";
import { MidnightDIDSimulator } from "./midnight-did-simulator";

describe("alsoKnownAs operations", () => {
  it("adds an alias to alsoKnownAs set", () => {
    const sim = new MidnightDIDSimulator();

    const addAlias: DIDUpdateOperation = {
      ...OperationBuilder.defaultDIDUpdateOperation,
      operationType: OperationType.AddAlsoKnownAs,
      addAlsoKnownAsOptions: { value: "aka-1" }
    };

    sim.applyOperations(OperationBuilder.padding([addAlias]));
    const ledger = sim.getLedger();
    expect(ledger.alsoKnownAs.member("aka-1")).toBeTruthy();
  });

  it("fails to add duplicate alias", () => {
    const sim = new MidnightDIDSimulator();
    const addAlias: DIDUpdateOperation = {
      ...OperationBuilder.defaultDIDUpdateOperation,
      operationType: OperationType.AddAlsoKnownAs,
      addAlsoKnownAsOptions: { value: "aka-dup" }
    };

    sim.applyOperation(addAlias);
    expect(() => sim.applyOperation(addAlias)).toThrow();
  });

  it("removes an existing alias", () => {
    const sim = new MidnightDIDSimulator();
    const addAlias: DIDUpdateOperation = {
      ...OperationBuilder.defaultDIDUpdateOperation,
      operationType: OperationType.AddAlsoKnownAs,
      addAlsoKnownAsOptions: { value: "aka-rem" }
    };
    const removeAlias: DIDUpdateOperation = {
      ...OperationBuilder.defaultDIDUpdateOperation,
      operationType: OperationType.RemoveAlsoKnownAs,
      removeAlsoKnownAsOptions: { value: "aka-rem" }
    };

    sim.applyOperation(addAlias);
    let ledger = sim.getLedger();
    expect(ledger.alsoKnownAs.member("aka-rem")).toBeTruthy();

    sim.applyOperation(removeAlias);
    ledger = sim.getLedger();
    expect(ledger.alsoKnownAs.member("aka-rem")).not.toBeTruthy();
  });

  it("fails to remove non-existent alias", () => {
    const sim = new MidnightDIDSimulator();
    const removeAlias: DIDUpdateOperation = {
      ...OperationBuilder.defaultDIDUpdateOperation,
      operationType: OperationType.RemoveAlsoKnownAs,
      removeAlsoKnownAsOptions: { value: "aka-missing" }
    };

    expect(() => sim.applyOperation(removeAlias)).toThrow();
  });
});
