import { type MidnightEndpointOverrides, type MidnightNetworkProfileName } from "./config-profiles.js";
import { contractConfig, currentDir } from "./package-paths.js";
export { applyMidnightNetworkProfile, getMidnightNetworkProfile, isMidnightNetworkProfileName, MIDNIGHT_NETWORK_PROFILE_NAMES, MIDNIGHT_NETWORK_PROFILES, type MidnightEndpointConfig, type MidnightEndpointOverrides, type MidnightNetworkProfile, type MidnightNetworkProfileName, type ResolvedMidnightNetworkConfig, resolveMidnightNetworkConfig, } from "./config-profiles.js";
export { contractConfig, currentDir };
export interface Config {
    readonly logDir: string;
    readonly indexer: string;
    readonly indexerWS: string;
    readonly node: string;
    readonly proofServer: string;
    readonly midnightDbName?: string;
}
export declare class ProfileConfig implements Config {
    readonly profileName: MidnightNetworkProfileName;
    readonly logDir: string;
    readonly indexer: string;
    readonly indexerWS: string;
    readonly node: string;
    readonly proofServer: string;
    readonly midnightDbName: string;
    constructor(profileName: MidnightNetworkProfileName, endpointOverrides?: MidnightEndpointOverrides);
}
export declare class TestnetLocalConfig extends ProfileConfig {
    constructor();
}
export declare class StandaloneConfig extends ProfileConfig {
    constructor();
}
export declare class TestnetRemoteConfig extends ProfileConfig {
    constructor();
}
export declare class PreprodConfig extends ProfileConfig {
    constructor();
}
export declare class MainnetConfig extends ProfileConfig {
    constructor(input?: MidnightEndpointOverrides);
}
