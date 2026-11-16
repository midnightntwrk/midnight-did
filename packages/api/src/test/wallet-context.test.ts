import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const freshHistory = { source: "fresh-history" };
  const restoredHistory = { source: "restored-history" };
  const shieldedWallet = { kind: "shielded" };
  const unshieldedWallet = { kind: "unshielded" };
  const dustWallet = { kind: "dust" };
  const wallet = { start: vi.fn() };
  const seeds = {
    shielded: new Uint8Array([11]),
    unshielded: new Uint8Array([22]),
    dust: new Uint8Array([33]),
  };
  const keys = {
    zswap: new Uint8Array([1]),
    nightExternal: new Uint8Array([2]),
    dust: new Uint8Array([3]),
  };
  return {
    freshHistory,
    restoredHistory,
    shieldedWallet,
    unshieldedWallet,
    dustWallet,
    wallet,
    seeds,
    keys,
    shieldedSecretKeys: { kind: "shielded-secret-keys" },
    dustSecretKey: { kind: "dust-secret-key" },
    unshieldedKeystore: { kind: "unshielded-keystore" },
    publicKey: { kind: "public-key" },
    loggerInfo: vi.fn(),
    networkId: vi.fn(),
    deriveMidnightWalletKeys: vi.fn(),
    createUnshieldedKeystoreFromKeys: vi.fn(),
    zswapFromSeed: vi.fn(),
    dustFromSeed: vi.fn(),
    historyConstructor: vi.fn(),
    historyRestore: vi.fn(),
    publicKeyFromKeyStore: vi.fn(),
    walletSeedsFromMasterSeed: vi.fn(),
    shieldedFactory: vi.fn(),
    shieldedRestore: vi.fn(),
    shieldedStartSeed: vi.fn(),
    unshieldedFactory: vi.fn(),
    unshieldedRestore: vi.fn(),
    unshieldedStart: vi.fn(),
    dustFactory: vi.fn(),
    dustRestore: vi.fn(),
    dustStartSeed: vi.fn(),
    walletFacadeInit: vi.fn(),
    lifecycleRestore: vi.fn(),
    lifecycleTraits: vi.fn(() => ({ traits: "resolved-v9" })),
    facadeClock: { now: () => new Date("2030-01-01") },
    facadeResolvedConfig: undefined as unknown,
    protocolVersion: { V9NativeForkSchedule: { v9: 2_000_000 } },
  };
});

vi.mock("@midnightntwrk/ledger-v9", () => ({
  ZswapSecretKeys: { fromSeed: mocks.zswapFromSeed },
  DustSecretKey: { fromSeed: mocks.dustFromSeed },
}));

vi.mock("@midnight-ntwrk/wallet-sdk-abstractions", () => ({
  InMemoryTransactionHistoryStorage: Object.assign(
    vi.fn(function InMemoryTransactionHistoryStorage() {
      return mocks.historyConstructor();
    }),
    { restore: mocks.historyRestore },
  ),
  ProtocolVersion: mocks.protocolVersion,
}));

vi.mock("@midnight-ntwrk/wallet-sdk-hd", () => ({
  Roles: { Zswap: "zswap", NightExternal: "nightExternal", Dust: "dust" },
  WalletSeeds: { fromMasterSeed: mocks.walletSeedsFromMasterSeed },
}));

vi.mock("@midnight-ntwrk/wallet-sdk-shielded", () => ({
  ShieldedWallet: mocks.shieldedFactory,
}));
vi.mock("@midnight-ntwrk/wallet-sdk-unshielded-wallet", () => ({
  PublicKey: { fromKeyStore: mocks.publicKeyFromKeyStore },
  UnshieldedWallet: mocks.unshieldedFactory,
}));
vi.mock("@midnight-ntwrk/wallet-sdk-dust-wallet", () => ({
  DustWallet: mocks.dustFactory,
}));

vi.mock("@midnight-ntwrk/wallet-sdk-capabilities/transactionLifecycle", () => ({
  TransactionLifecycleServiceImpl: { restore: mocks.lifecycleRestore },
}));

vi.mock("@midnight-ntwrk/wallet-sdk-facade", () => ({
  lifecycleTransactionTraits: mocks.lifecycleTraits,
  WalletFacade: { init: mocks.walletFacadeInit },
  WalletEntrySchema: { kind: "wallet-entry-schema" },
  mergeWalletEntries: vi.fn(),
}));

vi.mock("../api-logger.js", () => ({
  getLogger: () => ({ info: mocks.loggerInfo }),
}));
vi.mock("../network-context.js", () => ({
  getCurrentNetworkId: mocks.networkId,
}));
vi.mock("../wallet-keys.js", () => ({
  deriveMidnightWalletKeys: mocks.deriveMidnightWalletKeys,
  createUnshieldedKeystoreFromKeys: mocks.createUnshieldedKeystoreFromKeys,
}));

import { type Config } from "../config.js";
import { createWalletContext } from "../wallet-context.js";

const config: Config = {
  logDir: "logs",
  indexer: "http://indexer",
  indexerWS: "wss://indexer",
  node: "http://node",
  proofServer: "http://proof",
};
const seed = "11".repeat(32);
const snapshot = {
  transactionLifecycleState: " exact opaque SDK payload\n",
  shieldedState: "shielded-state",
  unshieldedState: "unshielded-state",
  dustState: "dust-state",
  unshieldedHistory: JSON.stringify({ history: true }),
};
const resolvedConfig = {
  ...config,
  networkId: "testnet",
  forks: mocks.protocolVersion.V9NativeForkSchedule,
  txHistoryStorage: { source: "shared-feeding-history" },
};

describe("wallet context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.networkId.mockReturnValue("testnet");
    mocks.deriveMidnightWalletKeys.mockReturnValue(mocks.keys);
    mocks.createUnshieldedKeystoreFromKeys.mockReturnValue(
      mocks.unshieldedKeystore,
    );
    mocks.zswapFromSeed.mockReturnValue(mocks.shieldedSecretKeys);
    mocks.dustFromSeed.mockReturnValue(mocks.dustSecretKey);
    mocks.walletSeedsFromMasterSeed.mockReturnValue(mocks.seeds);
    mocks.historyConstructor.mockReturnValue(mocks.freshHistory);
    mocks.historyRestore.mockReturnValue(mocks.restoredHistory);
    mocks.publicKeyFromKeyStore.mockReturnValue(mocks.publicKey);
    mocks.shieldedFactory.mockImplementation((resolved: unknown) => ({
      config: resolved,
      restore: mocks.shieldedRestore,
      startWithSeed: mocks.shieldedStartSeed,
    }));
    mocks.unshieldedFactory.mockImplementation((resolved: unknown) => ({
      config: resolved,
      restore: mocks.unshieldedRestore,
      startWithPublicKey: mocks.unshieldedStart,
    }));
    mocks.dustFactory.mockImplementation((resolved: unknown) => ({
      config: resolved,
      restore: mocks.dustRestore,
      startWithSeed: mocks.dustStartSeed,
    }));
    mocks.shieldedRestore.mockReturnValue(mocks.shieldedWallet);
    mocks.shieldedStartSeed.mockResolvedValue(mocks.shieldedWallet);
    mocks.unshieldedRestore.mockReturnValue(mocks.unshieldedWallet);
    mocks.unshieldedStart.mockResolvedValue(mocks.unshieldedWallet);
    mocks.dustRestore.mockReturnValue(mocks.dustWallet);
    mocks.dustStartSeed.mockResolvedValue(mocks.dustWallet);
    mocks.walletFacadeInit.mockImplementation(async (init: any) => {
      const resolved = {
        ...init.configuration,
        txHistoryStorage: resolvedConfig.txHistoryStorage,
      };
      mocks.facadeResolvedConfig = resolved;
      await init.shielded(resolved);
      await init.unshielded(resolved);
      await init.dust(resolved);
      if (init.transactionLifecycleService)
        await init.transactionLifecycleService(resolved, {
          clock: mocks.facadeClock,
        });
      return mocks.wallet;
    });
    mocks.wallet.start.mockResolvedValue(undefined);
  });

  it("starts every component from its role seed and snapshots the network", async () => {
    const context = await createWalletContext(config, seed);

    expect(mocks.walletSeedsFromMasterSeed).toHaveBeenCalledWith(
      Buffer.from(seed, "hex"),
    );
    expect(mocks.shieldedStartSeed).toHaveBeenCalledWith(mocks.seeds.shielded);
    expect(mocks.dustStartSeed).toHaveBeenCalledWith(mocks.seeds.dust);
    expect(mocks.unshieldedStart).toHaveBeenCalledWith(mocks.publicKey);
    expect(mocks.createUnshieldedKeystoreFromKeys).toHaveBeenCalledWith(
      mocks.keys,
      "testnet",
    );
    expect(mocks.walletFacadeInit).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({
          networkId: "testnet",
          txHistoryStorage: mocks.freshHistory,
        }),
      }),
    );
    expect(mocks.wallet.start).toHaveBeenCalledWith(mocks.seeds);
    expect(context).toMatchObject({
      networkId: "testnet",
      wallet: mocks.wallet,
      shieldedWallet: mocks.shieldedWallet,
      unshieldedWallet: mocks.unshieldedWallet,
      dustWallet: mocks.dustWallet,
      unshieldedHistoryStorage: mocks.freshHistory,
    });
  });

  it("retains the SDK default lifecycle service for fresh creation", async () => {
    await createWalletContext(config, seed);
    expect(
      mocks.walletFacadeInit.mock.calls[0][0].transactionLifecycleService,
    ).toBeUndefined();
    expect(mocks.lifecycleRestore).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "", "  ", 7])(
    "rejects incomplete legacy lifecycle payload %s before derivation or init",
    async (payload) => {
      await expect(
        createWalletContext(config, "invalid-seed", {
          ...snapshot,
          transactionLifecycleState: payload,
        } as any),
      ).rejects.toThrow(/incomplete|incompatible.*snapshot/i);
      expect(mocks.walletSeedsFromMasterSeed).not.toHaveBeenCalled();
      expect(mocks.walletFacadeInit).not.toHaveBeenCalled();
      expect(mocks.wallet.start).not.toHaveBeenCalled();
    },
  );

  it.each(["corrupt lifecycle", "unknown lifecycle version"])(
    "propagates SDK %s rejection before start",
    async (message) => {
      const failure = new Error(message);
      mocks.lifecycleRestore.mockRejectedValueOnce(failure);
      await expect(createWalletContext(config, seed, snapshot)).rejects.toBe(
        failure,
      );
      expect(mocks.wallet.start).not.toHaveBeenCalled();
    },
  );

  it("uses the facade-supplied shared history and components built inside callbacks", async () => {
    await createWalletContext(config, seed);

    expect(mocks.shieldedFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        txHistoryStorage: resolvedConfig.txHistoryStorage,
      }),
    );
    expect(mocks.unshieldedFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        txHistoryStorage: resolvedConfig.txHistoryStorage,
      }),
    );
    expect(mocks.dustFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        txHistoryStorage: resolvedConfig.txHistoryStorage,
      }),
    );
  });

  it("restores every component and the shared history from a snapshot", async () => {
    await createWalletContext(config, seed, snapshot);

    expect(mocks.lifecycleTraits).toHaveBeenCalledWith(
      mocks.protocolVersion.V9NativeForkSchedule.v9,
    );
    expect(mocks.lifecycleRestore).toHaveBeenCalledWith(
      snapshot.transactionLifecycleState,
      { traits: "resolved-v9" },
      expect.objectContaining({
        forks: mocks.protocolVersion.V9NativeForkSchedule,
        txHistoryStorage: resolvedConfig.txHistoryStorage,
      }),
      mocks.facadeClock,
    );
    expect(mocks.lifecycleRestore.mock.calls[0][2]).toBe(
      mocks.facadeResolvedConfig,
    );
    expect(mocks.lifecycleRestore.mock.calls[0][3]).toBe(mocks.facadeClock);
    expect(mocks.historyRestore).toHaveBeenCalledWith(
      { history: true },
      expect.anything(),
      expect.anything(),
    );
    expect(mocks.shieldedRestore).toHaveBeenCalledWith("shielded-state");
    expect(mocks.unshieldedRestore).toHaveBeenCalledWith("unshielded-state");
    expect(mocks.dustRestore).toHaveBeenCalledWith("dust-state");
    expect(mocks.shieldedStartSeed).not.toHaveBeenCalled();
    expect(mocks.unshieldedStart).not.toHaveBeenCalled();
    expect(mocks.dustStartSeed).not.toHaveBeenCalled();
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "Restoring wallet from serialized state",
    );
    expect(mocks.loggerInfo.mock.calls.flat()).not.toContain(
      snapshot.transactionLifecycleState,
    );
  });

  it("keeps the network captured before deferred initialization", async () => {
    mocks.networkId
      .mockReturnValueOnce("testnet")
      .mockReturnValueOnce("mainnet");

    await createWalletContext(config, seed, snapshot);

    expect(mocks.createUnshieldedKeystoreFromKeys).toHaveBeenCalledWith(
      mocks.keys,
      "testnet",
    );
    expect(mocks.walletFacadeInit).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({ networkId: "testnet" }),
      }),
    );
  });

  it("propagates restore failure without initializing the facade", async () => {
    mocks.shieldedRestore.mockImplementationOnce(() => {
      throw new Error("shielded restore failed");
    });

    await expect(createWalletContext(config, seed, snapshot)).rejects.toThrow(
      "shielded restore failed",
    );
    expect(mocks.walletFacadeInit).toHaveBeenCalledOnce();
    expect(mocks.wallet.start).not.toHaveBeenCalled();
  });

  it("propagates facade start failure after initialization", async () => {
    mocks.wallet.start.mockRejectedValueOnce(new Error("start failed"));

    await expect(createWalletContext(config, seed)).rejects.toThrow(
      "start failed",
    );
    expect(mocks.walletFacadeInit).toHaveBeenCalledOnce();
  });
});
