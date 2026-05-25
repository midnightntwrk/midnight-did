import { MidnightNetwork } from "@midnight-ntwrk/midnight-did/midnight";
import { describe, expect, it } from "vitest";

import { DomainToRuntime } from "../domain-to-runtime.js";
import { RUNTIME_TO_DOMAIN_NETWORK_MAP } from "../network-mapping.js";
import { RuntimeToDomain } from "../runtime-to-domain.js";

describe("RuntimeToDomain.NetworkMap", () => {
  it("maps all NetworkId values to MidnightNetwork", () => {
    expect(RuntimeToDomain.NetworkMap).toBe(RUNTIME_TO_DOMAIN_NETWORK_MAP);
    expect(Object.isFrozen(RuntimeToDomain.NetworkMap)).toBe(true);
    expect(RuntimeToDomain.NetworkMap["undeployed"]).toBe(
      MidnightNetwork.Undeployed,
    );
    expect(RuntimeToDomain.NetworkMap["devnet"]).toBe(MidnightNetwork.DevNet);
    expect(RuntimeToDomain.NetworkMap["testnet"]).toBe(MidnightNetwork.Testnet);
    expect(RuntimeToDomain.NetworkMap["mainnet"]).toBe(MidnightNetwork.Mainnet);
    expect(RuntimeToDomain.NetworkMap["preview"]).toBe(MidnightNetwork.Preview);
    expect(RuntimeToDomain.NetworkMap["preprod"]).toBe(MidnightNetwork.Preprod);
  });

  it("is inverse of DomainToRuntime.NetworkMap for all defined values", () => {
    const entries = Object.entries(DomainToRuntime.NetworkMap) as Array<
      [keyof typeof MidnightNetwork, string]
    >;
    for (const [, nid] of entries) {
      expect(RuntimeToDomain.NetworkMap[nid]).toBeDefined();
    }
  });
});
