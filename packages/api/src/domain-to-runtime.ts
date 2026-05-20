import type { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const networkMap = Object.freeze({
  Undeployed: "undeployed",
  DevNet: "devnet",
  Testnet: "testnet",
  Mainnet: "mainnet",
  Preview: "preview",
  Preprod: "preprod",
}) as Record<MidnightNetwork, NetworkId>;

export class DomainToRuntime {
  static get NetworkMap(): Record<MidnightNetwork, NetworkId> {
    return networkMap;
  }
}
