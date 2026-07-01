import { applyMidnightNetworkProfile, resolveMidnightNetworkConfig, } from "./config-profiles.js";
import { contractConfig, currentDir } from "./package-paths.js";
export { applyMidnightNetworkProfile, getMidnightNetworkProfile, isMidnightNetworkProfileName, MIDNIGHT_NETWORK_PROFILE_NAMES, MIDNIGHT_NETWORK_PROFILES, resolveMidnightNetworkConfig, } from "./config-profiles.js";
export { contractConfig, currentDir };
export class ProfileConfig {
    profileName;
    logDir;
    indexer;
    indexerWS;
    node;
    proofServer;
    midnightDbName;
    constructor(profileName, endpointOverrides = {}) {
        this.profileName = profileName;
        const values = resolveMidnightNetworkConfig(currentDir, profileName, endpointOverrides);
        this.logDir = values.logDir;
        this.indexer = values.indexer;
        this.indexerWS = values.indexerWS;
        this.node = values.node;
        this.proofServer = values.proofServer;
        this.midnightDbName = values.midnightDbName;
        applyMidnightNetworkProfile(profileName);
    }
}
export class TestnetLocalConfig extends ProfileConfig {
    constructor() {
        super("testnet-local");
    }
}
export class StandaloneConfig extends ProfileConfig {
    constructor() {
        super("standalone");
    }
}
export class TestnetRemoteConfig extends ProfileConfig {
    constructor() {
        super("testnet-remote");
    }
}
export class PreprodConfig extends ProfileConfig {
    constructor() {
        super("preprod");
    }
}
export class MainnetConfig extends ProfileConfig {
    constructor(input = {}) {
        super("mainnet", input);
    }
}
//# sourceMappingURL=config.js.map