import { describe, expect, it } from "vitest";

import {
  Contract,
  pureCircuits,
} from "../managed/passport-compliance-demo/contract/index.js";

const bytes32 = () => new Uint8Array(32);

describe("passport and compliance composition contract", () => {
  it("generates a usable Layer 3 contract surface for two credential families", () => {
    const contract = new Contract<undefined>({
      holderSecret: () => [undefined, bytes32()],
      passportHolderSecretOpening: () => [undefined, bytes32()],
      passportHolderBindingBlindingFactor: () => [undefined, bytes32()],
      screeningHolderSecretOpening: () => [undefined, bytes32()],
      screeningHolderBindingBlindingFactor: () => [undefined, bytes32()],
      holderBirthDateDays: () => [undefined, 0n],
      holderBirthDateOpening: () => [undefined, bytes32()],
      screeningDateDay: () => [undefined, 0n],
      screeningDateOpening: () => [undefined, bytes32()],
    });

    expect(typeof pureCircuits.secretPassportCredentialBodyRoot).toBe("function");
    expect(typeof pureCircuits.sanctionScreeningCredentialBodyRoot).toBe("function");
    expect(typeof contract.impureCircuits.verifyPassportAndComplianceEligibility).toBe(
      "function",
    );
  });
});
