import { MidnightNetwork } from "@midnight-ntwrk/midnight-did-domain";
// Minimal stub to avoid importing runtime-dependent module in unit tests
const NetworkId = { Undeployed: 0, DevNet: 1, TestNet: 2, MainNet: 3 } as const;
import { describe, expect, it } from "vitest";

import { DomainToRuntime } from "../domain-to-runtime";

describe("DomainToRuntime.NetworkMap", () => {
  it("maps all MidnightNetwork values to NetworkId", () => {
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Undeployed]).toBe(
      NetworkId.Undeployed,
    );
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.DevNet]).toBe(
      NetworkId.DevNet,
    );
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Testnet]).toBe(
      NetworkId.TestNet,
    );
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Mainnet]).toBe(
      NetworkId.MainNet,
    );
  });
});
