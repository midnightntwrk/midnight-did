import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import { describe, expect, it } from "vitest";

import { DomainToRuntime } from "../domain-to-runtime.js";
import { DOMAIN_TO_RUNTIME_NETWORK_MAP } from "../network-mapping.js";

describe("DomainToRuntime.NetworkMap", () => {
  it("maps all MidnightNetwork values to NetworkId", () => {
    expect(DomainToRuntime.NetworkMap).toBe(DOMAIN_TO_RUNTIME_NETWORK_MAP);
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Undeployed]).toBe(
      "undeployed",
    );
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.DevNet]).toBe("devnet");
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Testnet]).toBe("testnet");
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Mainnet]).toBe("mainnet");
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Preview]).toBe("preview");
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Preprod]).toBe("preprod");
  });
});
