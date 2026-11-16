import type { NetworkId } from "@midnight-ntwrk/midnight-js-types";

// SDK5 removes the upstream process-global network id. The CLI-style API keeps
// one local default per process so config profiles can initialize wallet and
// provider construction. Provider sets still carry their own `config.networkId`.
let currentNetworkId: NetworkId = "undeployed";

export const setCurrentNetworkId = (networkId: NetworkId): void => {
  currentNetworkId = networkId;
};

export const getCurrentNetworkId = (): NetworkId => currentNetworkId;
