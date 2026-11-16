import { beforeEach, describe, expect, it, vi } from "vitest";

const providerMocks = vi.hoisted(() => ({
  contractConfig: { zkConfigPath: "/tmp/midnight-did/zk" },
  createDIDPrivateStateProvider: vi.fn(
    (ctx: unknown, config: unknown, accountId: string) => ({
      accountId,
      config,
      ctx,
      kind: "private-state-provider",
    }),
  ),
  createWalletAndMidnightProvider: vi.fn(async () => ({
    getCoinPublicKey: () => "coin-public-key",
    kind: "wallet-and-midnight-provider",
  })),
  httpClientProofProvider: vi.fn(
    (options: { url: string; zkConfigProvider: unknown }) => ({
      kind: "proof-provider",
      proofServer: options.url,
      zkConfig: options.zkConfigProvider,
    }),
  ),
  indexerPublicDataProvider: vi.fn(
    (options: { queryURL: string; subscriptionURL: string }) => ({
      indexer: options.queryURL,
      indexerWS: options.subscriptionURL,
      kind: "public-data-provider",
    }),
  ),
  getCurrentNetworkId: vi.fn(() => "testnet"),
  NodeZkConfigProvider: vi.fn(function NodeZkConfigProvider(
    this: { kind?: string; zkConfigPath?: string },
    zkConfigPath: string,
  ) {
    this.kind = "zk-config-provider";
    this.zkConfigPath = zkConfigPath;
  }),
}));

vi.mock("../config.js", () => ({
  contractConfig: providerMocks.contractConfig,
}));

vi.mock("../network-context.js", () => ({
  getCurrentNetworkId: providerMocks.getCurrentNetworkId,
}));

vi.mock("../private-state-storage.js", () => ({
  createDIDPrivateStateProvider: providerMocks.createDIDPrivateStateProvider,
}));

vi.mock("../wallet-provider.js", () => ({
  createWalletAndMidnightProvider:
    providerMocks.createWalletAndMidnightProvider,
}));

vi.mock("@midnight-ntwrk/midnight-js-http-client-proof-provider", () => ({
  httpClientProofProvider: providerMocks.httpClientProofProvider,
}));

vi.mock("@midnight-ntwrk/midnight-js-indexer-public-data-provider", () => ({
  indexerPublicDataProvider: providerMocks.indexerPublicDataProvider,
}));

vi.mock("@midnight-ntwrk/midnight-js-node-zk-config-provider", () => ({
  NodeZkConfigProvider: providerMocks.NodeZkConfigProvider,
}));

import { configureProviders } from "../providers.js";

const makeConfig = () =>
  ({
    indexer: "https://indexer.example.test",
    indexerWS: "wss://indexer.example.test",
    proofServer: "https://proof.example.test",
  }) as any;

describe("provider composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerMocks.getCurrentNetworkId.mockReturnValue("testnet");
  });

  it("loads runtime provider adapters only when configuring providers", async () => {
    const ctx = { kind: "wallet-context", networkId: "testnet" } as any;
    const config = makeConfig();

    const providers = await configureProviders(ctx, config);

    expect(providerMocks.createWalletAndMidnightProvider).toHaveBeenCalledWith(
      ctx,
    );
    expect(providerMocks.NodeZkConfigProvider).toHaveBeenCalledWith(
      "/tmp/midnight-did/zk",
    );
    expect(providerMocks.createDIDPrivateStateProvider).toHaveBeenCalledWith(
      ctx,
      config,
      "coin-public-key",
    );
    expect(providerMocks.indexerPublicDataProvider).toHaveBeenCalledWith({
      queryURL: "https://indexer.example.test",
      subscriptionURL: "wss://indexer.example.test",
    });
    expect(providerMocks.httpClientProofProvider).toHaveBeenCalledWith({
      url: "https://proof.example.test",
      zkConfigProvider: providers.zkConfigProvider,
    });
    expect(providers).toMatchObject({
      midnightProvider: { kind: "wallet-and-midnight-provider" },
      privateStateProvider: {
        accountId: "coin-public-key",
        kind: "private-state-provider",
      },
      proofProvider: {
        kind: "proof-provider",
        proofServer: "https://proof.example.test",
      },
      publicDataProvider: {
        indexer: "https://indexer.example.test",
        indexerWS: "wss://indexer.example.test",
        kind: "public-data-provider",
      },
      walletProvider: { kind: "wallet-and-midnight-provider" },
      zkConfigProvider: {
        kind: "zk-config-provider",
        zkConfigPath: "/tmp/midnight-did/zk",
      },
    });
  });

  it("uses the context network when the global profile changed before composition", async () => {
    providerMocks.getCurrentNetworkId.mockReturnValue("mainnet");

    await expect(
      configureProviders(
        { kind: "wallet-context", networkId: "testnet" } as any,
        makeConfig(),
      ),
    ).resolves.toMatchObject({ config: { networkId: "testnet" } });
    expect(providerMocks.getCurrentNetworkId).not.toHaveBeenCalled();
  });

  it("keeps the context network when the profile switches during provider setup", async () => {
    let resolveWallet!: (value: unknown) => void;
    const walletGate = new Promise((resolve) => {
      resolveWallet = resolve;
    });
    providerMocks.createWalletAndMidnightProvider.mockImplementationOnce(
      async () => walletGate as never,
    );

    const pending = configureProviders(
      { kind: "wallet-context", networkId: "testnet" } as any,
      makeConfig(),
    );
    // A profile switch after composition starts must not leak into this set.
    providerMocks.getCurrentNetworkId.mockReturnValue("mainnet");
    resolveWallet({
      getCoinPublicKey: () => "coin-public-key",
      kind: "wallet-and-midnight-provider",
    });

    await expect(pending).resolves.toMatchObject({
      config: { networkId: "testnet" },
    });
  });

  it("bubbles wallet setup failures before constructing providers", async () => {
    providerMocks.createWalletAndMidnightProvider.mockRejectedValueOnce(
      new Error("wallet unavailable"),
    );

    await expect(
      configureProviders(
        { kind: "wallet-context", networkId: "testnet" } as any,
        makeConfig(),
      ),
    ).rejects.toThrow("wallet unavailable");

    expect(providerMocks.NodeZkConfigProvider).not.toHaveBeenCalled();
    expect(providerMocks.createDIDPrivateStateProvider).not.toHaveBeenCalled();
    expect(providerMocks.indexerPublicDataProvider).not.toHaveBeenCalled();
    expect(providerMocks.httpClientProofProvider).not.toHaveBeenCalled();
  });
});
