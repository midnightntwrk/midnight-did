import { MidnightNetwork } from "@midnight-ntwrk/midnight-did/midnight";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

export type RuntimeToDomainNetworkMap = Readonly<
  Record<NetworkId, MidnightNetwork>
>;

export type DomainToRuntimeNetworkMap = Readonly<
  Record<Exclude<MidnightNetwork, MidnightNetwork.Offchain>, NetworkId>
>;

const runtimeToDomainNetworkMap = {
  undeployed: MidnightNetwork.Undeployed,
  devnet: MidnightNetwork.DevNet,
  testnet: MidnightNetwork.Testnet,
  mainnet: MidnightNetwork.Mainnet,
  preview: MidnightNetwork.Preview,
  preprod: MidnightNetwork.Preprod,
} as const satisfies Record<NetworkId, MidnightNetwork>;

const domainToRuntimeNetworkMap = {
  [MidnightNetwork.Undeployed]: "undeployed",
  [MidnightNetwork.DevNet]: "devnet",
  [MidnightNetwork.Testnet]: "testnet",
  [MidnightNetwork.Mainnet]: "mainnet",
  [MidnightNetwork.Preview]: "preview",
  [MidnightNetwork.Preprod]: "preprod",
} as const satisfies Record<
  Exclude<MidnightNetwork, MidnightNetwork.Offchain>,
  NetworkId
>;

export const RUNTIME_TO_DOMAIN_NETWORK_MAP: RuntimeToDomainNetworkMap =
  Object.freeze(runtimeToDomainNetworkMap);

export const DOMAIN_TO_RUNTIME_NETWORK_MAP: DomainToRuntimeNetworkMap =
  Object.freeze(domainToRuntimeNetworkMap);
