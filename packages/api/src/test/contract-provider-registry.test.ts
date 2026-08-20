import { describe, expect, it } from "vitest";

import {
  registerContractProviders,
  registeredContractProviders,
} from "../contract-provider-registry.js";

describe("contract provider registry", () => {
  it("associates providers with an API-created contract handle", () => {
    const didContract = {} as any;
    const providers = {} as any;

    expect(registeredContractProviders(didContract)).toBeUndefined();
    registerContractProviders(didContract, providers);
    expect(registeredContractProviders(didContract)).toBe(providers);
  });
});
