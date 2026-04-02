import path from "node:path";

import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import {
  contractConfig,
  currentDir,
  MainnetConfig,
  PreprodConfig,
  StandaloneConfig,
  TestnetLocalConfig,
  TestnetRemoteConfig,
} from "../config";

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
      "https://indexer.preprod.midnight.network/api/v3/graphql",
    );
    expect(config.indexerWS).toBe(
      "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
    );
    expect(config.node).toBe("https://rpc.preprod.midnight.network");
    expect(config.proofServer).toBe("http://127.0.0.1:6300");
    expect(config.logDir).toContain(path.join("logs", "preprod"));
    expect(getNetworkId()).toBe("preprod");
  });

  it("builds mainnet from explicit endpoints", () => {
    const config = new MainnetConfig({
      indexer: "https://indexer.mainnet.example/api/v3/graphql",
      indexerWS: "wss://indexer.mainnet.example/api/v3/graphql/ws",
      node: "https://rpc.mainnet.example",
      proofServer: "https://proof.mainnet.example",
    });
    expect(config.indexer).toBe(
      "https://indexer.mainnet.example/api/v3/graphql",
    );
    expect(config.indexerWS).toBe(
      "wss://indexer.mainnet.example/api/v3/graphql/ws",
    );
    expect(config.node).toBe("https://rpc.mainnet.example");
    expect(config.proofServer).toBe("https://proof.mainnet.example");
    expect(config.logDir).toContain(path.join("logs", "mainnet"));
    expect(getNetworkId()).toBe("mainnet");
  });
});
