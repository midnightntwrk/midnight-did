import path from "node:path";

import {
  applyMidnightNetworkProfile,
  type MidnightEndpointOverrides,
  type MidnightNetworkProfileName,
  resolveMidnightNetworkConfig,
} from "./config-profiles.js";

export {
  applyMidnightNetworkProfile,
  getMidnightNetworkProfile,
  isMidnightNetworkProfileName,
  MIDNIGHT_NETWORK_PROFILE_NAMES,
  MIDNIGHT_NETWORK_PROFILES,
  type MidnightEndpointConfig,
  type MidnightEndpointOverrides,
  type MidnightNetworkProfile,
  type MidnightNetworkProfileName,
  type ResolvedMidnightNetworkConfig,
  resolveMidnightNetworkConfig,
} from "./config-profiles.js";
// Resolve to the package root whether running from src or dist/src
const fileDir = path.resolve(new URL(import.meta.url).pathname, "..");
const upOne = path.resolve(fileDir, "..");
export const currentDir =
  path.basename(upOne) === "dist" ? path.resolve(upOne, "..") : upOne;

export const contractConfig = {
  privateStateStoreName: "did-private-state",
  zkConfigPath: path.resolve(
    currentDir,
    "..",
    "contract",
    "src",
    "managed",
    "did",
  ),
};

export interface Config {
  readonly logDir: string;
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  readonly midnightDbName?: string;
}

export class ProfileConfig implements Config {
  readonly logDir: string;
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  readonly midnightDbName: string;

  constructor(
    readonly profileName: MidnightNetworkProfileName,
    endpointOverrides: MidnightEndpointOverrides = {},
  ) {
    const values = resolveMidnightNetworkConfig(
      currentDir,
      profileName,
      endpointOverrides,
    );

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
  constructor(input: MidnightEndpointOverrides = {}) {
    super("mainnet", input);
  }
}
