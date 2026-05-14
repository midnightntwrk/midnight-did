import path from "node:path";

import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import {
  contractConfig,
  currentDir,
  StandaloneConfig,
  TestnetLocalConfig,
  TestnetRemoteConfig,
} from "../config";
import {
  PRIVATE_STATE_PASSWORD_ENV,
  resolvePrivateStatePassword,
} from "../lib";

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

  it("uses the standalone private-state password fallback only for undeployed networks", () => {
    let warningCount = 0;

    expect(
      resolvePrivateStatePassword({
        networkId: "undeployed",
        env: {},
        onStandaloneFallback: () => {
          warningCount += 1;
        },
      }),
    ).toBe("Midnight-DID-local-private-state-password-2026!");
    expect(warningCount).toBe(1);
  });

  it("requires an explicit private-state password outside standalone", () => {
    expect(() =>
      resolvePrivateStatePassword({
        networkId: "testnet",
        env: {},
      }),
    ).toThrow(PRIVATE_STATE_PASSWORD_ENV);
  });

  it("honors the configured private-state password", () => {
    expect(
      resolvePrivateStatePassword({
        networkId: "testnet",
        env: {
          [PRIVATE_STATE_PASSWORD_ENV]: "test-password-from-env",
        },
      }),
    ).toBe("test-password-from-env");
  });
});
