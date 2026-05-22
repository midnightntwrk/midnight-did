import path from "node:path";

import {
  type NetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";

export interface MidnightEndpointConfig {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
}

export type MidnightEndpointOverrides = Partial<MidnightEndpointConfig>;

export interface MidnightNetworkProfile {
  readonly name: string;
  readonly networkId: NetworkId;
  readonly endpoints: MidnightEndpointConfig;
}

export const MIDNIGHT_NETWORK_PROFILES = {
  "testnet-local": {
    name: "testnet-local",
    networkId: "testnet",
    endpoints: {
      indexer: "http://127.0.0.1:8088/api/v3/graphql",
      indexerWS: "ws://127.0.0.1:8088/api/v3/graphql/ws",
      node: "http://127.0.0.1:9944",
      proofServer: "http://127.0.0.1:6300",
    },
  },
  standalone: {
    name: "standalone",
    networkId: "undeployed",
    endpoints: {
      indexer: "http://127.0.0.1:8088/api/v3/graphql",
      indexerWS: "ws://127.0.0.1:8088/api/v3/graphql/ws",
      node: "http://127.0.0.1:9944",
      proofServer: "http://127.0.0.1:6300",
    },
  },
  "testnet-remote": {
    name: "testnet-remote",
    networkId: "testnet",
    endpoints: {
      indexer: "https://indexer.testnet-02.midnight.network/api/v3/graphql",
      indexerWS: "wss://indexer.testnet-02.midnight.network/api/v3/graphql/ws",
      node: "https://rpc.testnet-02.midnight.network",
      proofServer: "http://127.0.0.1:6300",
    },
  },
  preprod: {
    name: "preprod",
    networkId: "preprod",
    endpoints: {
      indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
      indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
      node: "https://rpc.preprod.midnight.network",
      proofServer: "http://127.0.0.1:6300",
    },
  },
  mainnet: {
    name: "mainnet",
    networkId: "mainnet",
    endpoints: {
      indexer: "https://indexer.mainnet.midnight.network/api/v4/graphql",
      indexerWS: "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws",
      node: "https://rpc.mainnet.midnight.network",
      proofServer: "http://127.0.0.1:6300",
    },
  },
} as const satisfies Record<string, MidnightNetworkProfile>;

export type MidnightNetworkProfileName = keyof typeof MIDNIGHT_NETWORK_PROFILES;

export interface ResolvedMidnightNetworkConfig extends MidnightEndpointConfig {
  readonly logDir: string;
  readonly midnightDbName: string;
}

export const MIDNIGHT_NETWORK_PROFILE_NAMES = Object.keys(
  MIDNIGHT_NETWORK_PROFILES,
) as MidnightNetworkProfileName[];

export const isMidnightNetworkProfileName = (
  profileName: string,
): profileName is MidnightNetworkProfileName =>
  profileName in MIDNIGHT_NETWORK_PROFILES;

export const getMidnightNetworkProfile = (
  profileName: string,
): MidnightNetworkProfile => {
  if (!isMidnightNetworkProfileName(profileName)) {
    throw new Error(
      `Unknown Midnight network profile "${profileName}". Expected one of: ${MIDNIGHT_NETWORK_PROFILE_NAMES.join(
        ", ",
      )}.`,
    );
  }

  return MIDNIGHT_NETWORK_PROFILES[profileName];
};

export const applyMidnightNetworkProfile = (
  profileName: MidnightNetworkProfileName,
): void => {
  setNetworkId(getMidnightNetworkProfile(profileName).networkId);
};

export const resolveMidnightNetworkConfig = (
  currentDir: string,
  profileName: MidnightNetworkProfileName,
  endpointOverrides: MidnightEndpointOverrides = {},
  now: Date = new Date(),
): ResolvedMidnightNetworkConfig => {
  const profile = getMidnightNetworkProfile(profileName);

  return {
    ...profile.endpoints,
    ...endpointOverrides,
    logDir: path.resolve(
      currentDir,
      "logs",
      profile.name,
      `${now.toISOString()}.log`,
    ),
    midnightDbName: path.resolve(currentDir, ".midnight-db", profile.name),
  };
};
