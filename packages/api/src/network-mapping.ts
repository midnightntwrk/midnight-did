import type { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

export const RUNTIME_TO_DOMAIN_NETWORK_MAP = Object.freeze({
  undeployed: "Undeployed",
  devnet: "DevNet",
  testnet: "Testnet",
  mainnet: "Mainnet",
  preview: "Preview",
  preprod: "Preprod",
}) as Record<NetworkId, MidnightNetwork>;

export const DOMAIN_TO_RUNTIME_NETWORK_MAP = Object.freeze({
  Undeployed: "undeployed",
  DevNet: "devnet",
  Testnet: "testnet",
  Mainnet: "mainnet",
  Preview: "preview",
  Preprod: "preprod",
}) as Record<MidnightNetwork, NetworkId>;
