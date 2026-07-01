import { MidnightNetwork } from "@midnight-ntwrk/midnight-did/midnight";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
export type RuntimeToDomainNetworkMap = Readonly<Record<NetworkId, MidnightNetwork>>;
export type DomainToRuntimeNetworkMap = Readonly<Record<Exclude<MidnightNetwork, MidnightNetwork.Offchain>, NetworkId>>;
export declare const RUNTIME_TO_DOMAIN_NETWORK_MAP: RuntimeToDomainNetworkMap;
export declare const DOMAIN_TO_RUNTIME_NETWORK_MAP: DomainToRuntimeNetworkMap;
