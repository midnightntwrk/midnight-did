import type { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const networkMap = Object.freeze({
  undeployed: "Undeployed",
  devnet: "DevNet",
  testnet: "Testnet",
  mainnet: "Mainnet",
  preview: "Preview",
  preprod: "Preprod",
}) as Record<NetworkId, MidnightNetwork>;

export class RuntimeToDomain {
  static get NetworkMap(): Record<NetworkId, MidnightNetwork> {
    return networkMap;
  }
}
