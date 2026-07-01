import { type NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
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
export declare const MIDNIGHT_NETWORK_PROFILES: {
    readonly "testnet-local": {
        readonly name: "testnet-local";
        readonly networkId: "testnet";
        readonly endpoints: {
            readonly indexer: "http://127.0.0.1:8088/api/v3/graphql";
            readonly indexerWS: "ws://127.0.0.1:8088/api/v3/graphql/ws";
            readonly node: "http://127.0.0.1:9944";
            readonly proofServer: "http://127.0.0.1:6300";
        };
    };
    readonly standalone: {
        readonly name: "standalone";
        readonly networkId: "undeployed";
        readonly endpoints: {
            readonly indexer: "http://127.0.0.1:8088/api/v3/graphql";
            readonly indexerWS: "ws://127.0.0.1:8088/api/v3/graphql/ws";
            readonly node: "http://127.0.0.1:9944";
            readonly proofServer: "http://127.0.0.1:6300";
        };
    };
    readonly "testnet-remote": {
        readonly name: "testnet-remote";
        readonly networkId: "testnet";
        readonly endpoints: {
            readonly indexer: "https://indexer.testnet-02.midnight.network/api/v3/graphql";
            readonly indexerWS: "wss://indexer.testnet-02.midnight.network/api/v3/graphql/ws";
            readonly node: "https://rpc.testnet-02.midnight.network";
            readonly proofServer: "http://127.0.0.1:6300";
        };
    };
    readonly preprod: {
        readonly name: "preprod";
        readonly networkId: "preprod";
        readonly endpoints: {
            readonly indexer: "https://indexer.preprod.midnight.network/api/v4/graphql";
            readonly indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";
            readonly node: "https://rpc.preprod.midnight.network";
            readonly proofServer: "http://127.0.0.1:6300";
        };
    };
    readonly mainnet: {
        readonly name: "mainnet";
        readonly networkId: "mainnet";
        readonly endpoints: {
            readonly indexer: "https://indexer.mainnet.midnight.network/api/v4/graphql";
            readonly indexerWS: "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws";
            readonly node: "https://rpc.mainnet.midnight.network";
            readonly proofServer: "http://127.0.0.1:6300";
        };
    };
};
export type MidnightNetworkProfileName = keyof typeof MIDNIGHT_NETWORK_PROFILES;
export interface ResolvedMidnightNetworkConfig extends MidnightEndpointConfig {
    readonly logDir: string;
    readonly midnightDbName: string;
}
export declare const MIDNIGHT_NETWORK_PROFILE_NAMES: MidnightNetworkProfileName[];
export declare const isMidnightNetworkProfileName: (profileName: string) => profileName is MidnightNetworkProfileName;
export declare const getMidnightNetworkProfile: (profileName: string) => MidnightNetworkProfile;
export declare const applyMidnightNetworkProfile: (profileName: MidnightNetworkProfileName) => void;
export declare const resolveMidnightNetworkConfig: (currentDir: string, profileName: MidnightNetworkProfileName, endpointOverrides?: MidnightEndpointOverrides, now?: Date) => ResolvedMidnightNetworkConfig;
