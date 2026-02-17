import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import { describe, expect, it } from "vitest";

import { DomainToRuntime } from "../domain-to-runtime";
import { RuntimeToDomain } from "../runtime-to-domain";

describe("RuntimeToDomain.NetworkMap", () => {
  it("maps all NetworkId values to MidnightNetwork", () => {
    expect(RuntimeToDomain.NetworkMap["undeployed"]).toBe(
      MidnightNetwork.Undeployed,
    );
    expect(RuntimeToDomain.NetworkMap["devnet"]).toBe(MidnightNetwork.DevNet);
    expect(RuntimeToDomain.NetworkMap["testnet"]).toBe(MidnightNetwork.Testnet);
    expect(RuntimeToDomain.NetworkMap["mainnet"]).toBe(MidnightNetwork.Mainnet);
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
