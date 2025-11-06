import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OperationBuilder } from "../ledger-operation-builder";
import { addVerificationMethod, createSimulator } from "./fixtures/simulator";

describe("MidnightDIDSimulator lifecycle", () => {
  let simulator: ReturnType<typeof createSimulator>;
  const initialTime = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(initialTime);
    simulator = createSimulator();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(ledger.created).toBe(BigInt(initialTime.getTime()));
    expect(ledger.updated).toBe(BigInt(initialTime.getTime()));
    expect(ledger.deactivated).toBe(false);
  });

  it("deactivates the DID", () => {
    const deactivatedAt = new Date("2024-01-01T00:10:00.000Z");
    vi.setSystemTime(deactivatedAt);
    const ledger = simulator.applyOperation(OperationBuilder.deactivate());
    expect(ledger.active).toBe(false);
    expect(ledger.deactivated).toBe(true);
    expect(ledger.updated).toBe(BigInt(deactivatedAt.getTime()));
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

  it("updates the ledger timestamp when operations succeed", () => {
    const nextTime = new Date("2024-01-01T00:05:00.000Z");
    vi.setSystemTime(nextTime);
    const ledger = simulator.applyOperation(addVerificationMethod());
    expect(ledger.updated).toBe(BigInt(nextTime.getTime()));
  });
});
