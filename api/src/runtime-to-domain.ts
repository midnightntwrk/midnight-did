import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

export class RuntimeToDomain {
  static readonly NetworkMap: Record<NetworkId, MidnightNetwork> = {
    ["undeployed"]: MidnightNetwork.Undeployed,
    ["devnet"]: MidnightNetwork.DevNet,
    ["testnet"]: MidnightNetwork.Testnet,
    ["mainnet"]: MidnightNetwork.Mainnet,
    ["preview"]: MidnightNetwork.Preview,
    ["preprod"]: MidnightNetwork.Preprod,
  };
}
