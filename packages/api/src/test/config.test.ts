import path from "node:path";

import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import {
  applyMidnightNetworkProfile,
  contractConfig,
  currentDir,
  getMidnightNetworkProfile,
  MainnetConfig,
  MIDNIGHT_NETWORK_PROFILE_NAMES,
  MIDNIGHT_NETWORK_PROFILES,
  PreprodConfig,
  ProfileConfig,
  resolveMidnightNetworkConfig,
  StandaloneConfig,
  TestnetLocalConfig,
  TestnetRemoteConfig,
} from "../config.js";

describe("config", () => {
  it("resolves workspace directories", () => {
    expect(path.basename(currentDir)).toBe("api");
    expect(contractConfig.privateStateStoreName).toBe("did-private-state");
    expect(contractConfig.zkConfigPath).toContain(
      path.join("contract", "src", "managed", "did"),
    );
  });

  it("builds testnet-local defaults and network id", () => {
    const config = new TestnetLocalConfig();
    expect(config.indexer).toBe("http://127.0.0.1:8088/api/v3/graphql");
    expect(config.indexerWS).toBe("ws://127.0.0.1:8088/api/v3/graphql/ws");
    expect(config.node).toBe("http://127.0.0.1:9944");
    expect(config.proofServer).toBe("http://127.0.0.1:6300");
    expect(config.logDir).toContain(path.join("logs", "testnet-local"));
    expect(config.logDir.endsWith(".log")).toBe(true);
    expect(getNetworkId()).toBe("testnet");
  });

  it("builds standalone defaults and network id", () => {
    const config = new StandaloneConfig();
    expect(config.indexer).toBe("http://127.0.0.1:8088/api/v3/graphql");
    expect(config.indexerWS).toBe("ws://127.0.0.1:8088/api/v3/graphql/ws");
    expect(config.node).toBe("http://127.0.0.1:9944");
    expect(config.proofServer).toBe("http://127.0.0.1:6300");
    expect(config.logDir).toContain(path.join("logs", "standalone"));
    expect(config.logDir.endsWith(".log")).toBe(true);
    expect(getNetworkId()).toBe("undeployed");
  });

  it("builds testnet-remote defaults and network id", () => {
    const config = new TestnetRemoteConfig();
    expect(config.indexer).toBe(
      "https://indexer.testnet-02.midnight.network/api/v3/graphql",
    );
    expect(config.indexerWS).toBe(
      "wss://indexer.testnet-02.midnight.network/api/v3/graphql/ws",
    );
    expect(config.node).toBe("https://rpc.testnet-02.midnight.network");
    expect(config.proofServer).toBe("http://127.0.0.1:6300");
    expect(config.logDir).toContain(path.join("logs", "testnet-remote"));
    expect(config.logDir.endsWith(".log")).toBe(true);
    expect(getNetworkId()).toBe("testnet");
  });

  it("builds preprod defaults and network id", () => {
    const config = new PreprodConfig();
    expect(config.indexer).toBe(
      "https://indexer.preprod.midnight.network/api/v4/graphql",
    );
    expect(config.indexerWS).toBe(
      "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
    );
    expect(config.node).toBe("https://rpc.preprod.midnight.network");
    expect(config.proofServer).toBe("http://127.0.0.1:6300");
    expect(config.logDir).toContain(path.join("logs", "preprod"));
    expect(getNetworkId()).toBe("preprod");
  });

  it("builds mainnet defaults and supports explicit overrides", () => {
    const defaults = new MainnetConfig();
    expect(defaults.indexer).toBe(
      "https://indexer.mainnet.midnight.network/api/v4/graphql",
    );
    expect(defaults.indexerWS).toBe(
      "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws",
    );
    expect(defaults.node).toBe("https://rpc.mainnet.midnight.network");
    expect(defaults.proofServer).toBe("http://127.0.0.1:6300");
    expect(getNetworkId()).toBe("mainnet");

    const config = new MainnetConfig({
      indexer: "https://indexer.mainnet.example/api/v4/graphql",
      indexerWS: "wss://indexer.mainnet.example/api/v4/graphql/ws",
      node: "https://rpc.mainnet.example",
      proofServer: "https://proof.mainnet.example",
    });
    expect(config.indexer).toBe(
      "https://indexer.mainnet.example/api/v4/graphql",
    );
    expect(config.indexerWS).toBe(
      "wss://indexer.mainnet.example/api/v4/graphql/ws",
    );
    expect(config.node).toBe("https://rpc.mainnet.example");
    expect(config.proofServer).toBe("https://proof.mainnet.example");
    expect(config.logDir).toContain(path.join("logs", "mainnet"));
    expect(getNetworkId()).toBe("mainnet");
  });

  it("keeps network profiles in a single explicit catalog", () => {
    expect(MIDNIGHT_NETWORK_PROFILE_NAMES).toEqual([
      "testnet-local",
      "standalone",
      "testnet-remote",
      "preprod",
      "mainnet",
    ]);
    expect(getMidnightNetworkProfile("preprod")).toEqual(
      MIDNIGHT_NETWORK_PROFILES.preprod,
    );
    expect(MIDNIGHT_NETWORK_PROFILES.preprod.networkId).toBe("preprod");
    expect(MIDNIGHT_NETWORK_PROFILES.standalone.networkId).toBe("undeployed");
  });

  it("resolves profile paths and endpoint overrides without side effects", () => {
    const config = resolveMidnightNetworkConfig(
      "/tmp/midnight-did-api",
      "mainnet",
      { proofServer: "https://proof.mainnet.example" },
      new Date("2026-05-22T00:00:00.000Z"),
    );

    expect(config).toMatchObject({
      indexer: "https://indexer.mainnet.midnight.network/api/v4/graphql",
      indexerWS: "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws",
      node: "https://rpc.mainnet.midnight.network",
      proofServer: "https://proof.mainnet.example",
      logDir: path.join(
        "/tmp/midnight-did-api",
        "logs",
        "mainnet",
        "2026-05-22T00:00:00.000Z.log",
      ),
      midnightDbName: path.join(
        "/tmp/midnight-did-api",
        ".midnight-db",
        "mainnet",
      ),
    });
  });

  it("applies profile network ids through one helper", () => {
    applyMidnightNetworkProfile("standalone");
    expect(getNetworkId()).toBe("undeployed");
    applyMidnightNetworkProfile("preprod");
    expect(getNetworkId()).toBe("preprod");
  });

  it("builds a generic profile config for tooling and examples", () => {
    const config = new ProfileConfig("preprod", {
      proofServer: "http://127.0.0.1:6400",
    });

    expect(config.profileName).toBe("preprod");
    expect(config.proofServer).toBe("http://127.0.0.1:6400");
    expect(config.indexer).toBe(
      "https://indexer.preprod.midnight.network/api/v4/graphql",
    );
    expect(getNetworkId()).toBe("preprod");
  });
});
