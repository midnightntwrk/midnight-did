import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

export class DomainToRuntime {
  static readonly NetworkMap: Record<MidnightNetwork, NetworkId> = {
    [MidnightNetwork.Undeployed]: "undeployed",
    [MidnightNetwork.DevNet]: "devnet",
    [MidnightNetwork.Testnet]: "testnet",
    [MidnightNetwork.Mainnet]: "mainnet",
    [MidnightNetwork.Preview]: "preview",
    [MidnightNetwork.Preprod]: "preprod",
  };
}
