import { MidnightNetwork } from "@midnight-ntwrk/midnight-did/midnight";
const runtimeToDomainNetworkMap = {
    undeployed: MidnightNetwork.Undeployed,
    devnet: MidnightNetwork.DevNet,
    testnet: MidnightNetwork.Testnet,
    mainnet: MidnightNetwork.Mainnet,
    preview: MidnightNetwork.Preview,
    preprod: MidnightNetwork.Preprod,
};
const domainToRuntimeNetworkMap = {
    [MidnightNetwork.Undeployed]: "undeployed",
    [MidnightNetwork.DevNet]: "devnet",
    [MidnightNetwork.Testnet]: "testnet",
    [MidnightNetwork.Mainnet]: "mainnet",
    [MidnightNetwork.Preview]: "preview",
    [MidnightNetwork.Preprod]: "preprod",
};
export const RUNTIME_TO_DOMAIN_NETWORK_MAP = Object.freeze(runtimeToDomainNetworkMap);
export const DOMAIN_TO_RUNTIME_NETWORK_MAP = Object.freeze(domainToRuntimeNetworkMap);
//# sourceMappingURL=network-mapping.js.map