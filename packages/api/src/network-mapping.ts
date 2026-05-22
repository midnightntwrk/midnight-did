import type { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const runtimeToDomainNetworkMap = {
  undeployed: "Undeployed",
  devnet: "DevNet",
  testnet: "Testnet",
  mainnet: "Mainnet",
  preview: "Preview",
  preprod: "Preprod",
} as const satisfies Record<NetworkId, MidnightNetwork>;

const domainToRuntimeNetworkMap = {
  Undeployed: "undeployed",
  DevNet: "devnet",
  Testnet: "testnet",
  Mainnet: "mainnet",
  Preview: "preview",
  Preprod: "preprod",
} as const satisfies Record<MidnightNetwork, NetworkId>;

export const RUNTIME_TO_DOMAIN_NETWORK_MAP = Object.freeze(
  runtimeToDomainNetworkMap,
);

export const DOMAIN_TO_RUNTIME_NETWORK_MAP = Object.freeze(
  domainToRuntimeNetworkMap,
);
