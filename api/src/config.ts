import path from "node:path";

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
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

const midnightDbPath = (profile: string): string =>
  path.resolve(currentDir, ".midnight-db", profile);

export interface Config {
  readonly logDir: string;
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  readonly midnightDbName?: string;
}

export class TestnetLocalConfig implements Config {
  logDir = path.resolve(
    currentDir,
    "logs",
    "testnet-local",
    `${new Date().toISOString()}.log`,
  );
  indexer = "http://127.0.0.1:8088/api/v3/graphql";
  indexerWS = "ws://127.0.0.1:8088/api/v3/graphql/ws";
  node = "http://127.0.0.1:9944";
  proofServer = "http://127.0.0.1:6300";
  midnightDbName = midnightDbPath("testnet-local");
  constructor() {
    setNetworkId("testnet");
  }
}

export class StandaloneConfig implements Config {
  logDir = path.resolve(
    currentDir,
    "logs",
    "standalone",
    `${new Date().toISOString()}.log`,
  );
  indexer = "http://127.0.0.1:8088/api/v3/graphql";
  indexerWS = "ws://127.0.0.1:8088/api/v3/graphql/ws";
  node = "http://127.0.0.1:9944";
  proofServer = "http://127.0.0.1:6300";
  midnightDbName = midnightDbPath("standalone");
  constructor() {
    setNetworkId("undeployed");
  }
}

export class TestnetRemoteConfig implements Config {
  logDir = path.resolve(
    currentDir,
    "logs",
    "testnet-remote",
    `${new Date().toISOString()}.log`,
  );
  indexer = "https://indexer.testnet-02.midnight.network/api/v3/graphql";
  indexerWS = "wss://indexer.testnet-02.midnight.network/api/v3/graphql/ws";
  node = "https://rpc.testnet-02.midnight.network";
  proofServer = "http://127.0.0.1:6300";
  midnightDbName = midnightDbPath("testnet-remote");
  constructor() {
    setNetworkId("testnet");
  }
}

export class PreprodConfig implements Config {
  logDir = path.resolve(
    currentDir,
    "logs",
    "preprod",
    `${new Date().toISOString()}.log`,
  );
  indexer = "https://indexer.preprod.midnight.network/api/v3/graphql";
  indexerWS = "wss://indexer.preprod.midnight.network/api/v3/graphql/ws";
  node = "https://rpc.preprod.midnight.network";
  proofServer = "http://127.0.0.1:6300";
  midnightDbName = midnightDbPath("preprod");
  constructor() {
    setNetworkId("preprod");
  }
}

export class MainnetConfig implements Config {
  readonly logDir = path.resolve(
    currentDir,
    "logs",
    "mainnet",
    `${new Date().toISOString()}.log`,
  );
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  readonly midnightDbName: string;

  constructor(input: {
    indexer: string;
    indexerWS: string;
    node: string;
    proofServer: string;
  }) {
    this.indexer = input.indexer;
    this.indexerWS = input.indexerWS;
    this.node = input.node;
    this.proofServer = input.proofServer;
    this.midnightDbName = midnightDbPath("mainnet");
    setNetworkId("mainnet");
  }
}
