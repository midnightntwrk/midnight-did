import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import { describe, expect, it } from "vitest";

import { RuntimeToDomain } from "../runtime-to-domain.js";
import { MidnightDIDPrivateStateId, NetworkMapping } from "../types.js";

describe("types", () => {
  it("exposes expected private state id", () => {
    expect(MidnightDIDPrivateStateId).toBe("midnightDIDPrivateState");
  });

  it("maps runtime network ids to MidnightNetwork", () => {
    expect(NetworkMapping).toBe(RuntimeToDomain.NetworkMap);
    expect(NetworkMapping.undeployed).toBe(MidnightNetwork.Undeployed);
    expect(NetworkMapping.devnet).toBe(MidnightNetwork.DevNet);
    expect(NetworkMapping.testnet).toBe(MidnightNetwork.Testnet);
    expect(NetworkMapping.mainnet).toBe(MidnightNetwork.Mainnet);
    expect(NetworkMapping.preview).toBe(MidnightNetwork.Preview);
    expect(NetworkMapping.preprod).toBe(MidnightNetwork.Preprod);
  });
});
