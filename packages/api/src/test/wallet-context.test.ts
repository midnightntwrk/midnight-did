import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const freshHistory = { source: "fresh-history" };
  const restoredHistory = { source: "restored-history" };
  const shieldedWallet = { kind: "shielded" };
  const unshieldedWallet = { kind: "unshielded" };
  const dustWallet = { kind: "dust" };
  const wallet = { start: vi.fn() };
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
    keys,
    shieldedSecretKeys: { kind: "shielded-secret-keys" },
    dustSecretKey: { kind: "dust-secret-key" },
    unshieldedKeystore: { kind: "unshielded-keystore" },
    publicKey: { kind: "public-key" },
    dustParameters: { kind: "dust-parameters" },
    shieldedConfig: { shieldedConfig: true },
    unshieldedConfig: { unshieldedConfig: true },
    dustConfig: { dustConfig: true },
    loggerInfo: vi.fn(),
    deriveMidnightWalletKeys: vi.fn(),
    createUnshieldedKeystoreFromKeys: vi.fn(),
    zswapFromSeed: vi.fn(),
    dustFromSeed: vi.fn(),
    initialParameters: vi.fn(),
    historyConstructor: vi.fn(),
    historyFromSerialized: vi.fn(),
    publicKeyFromKeyStore: vi.fn(),
    buildShieldedConfig: vi.fn(),
    buildUnshieldedConfig: vi.fn(),
    buildDustConfig: vi.fn(),
    shieldedRestore: vi.fn(),
    shieldedStart: vi.fn(),
    unshieldedRestore: vi.fn(),
    unshieldedStart: vi.fn(),
    dustRestore: vi.fn(),
    dustStart: vi.fn(),
    walletFacadeInit: vi.fn(),
  };
});

vi.mock("@midnight-ntwrk/ledger-v8", () => ({
  ZswapSecretKeys: { fromSeed: mocks.zswapFromSeed },
  DustSecretKey: { fromSeed: mocks.dustFromSeed },
  LedgerParameters: { initialParameters: mocks.initialParameters },
}));

vi.mock("@midnight-ntwrk/wallet-sdk-hd", () => ({
  Roles: {
    Zswap: "zswap",
    NightExternal: "nightExternal",
    Dust: "dust",
  },
}));

vi.mock("@midnight-ntwrk/wallet-sdk-shielded", () => ({
  ShieldedWallet: vi.fn(() => ({
    restore: mocks.shieldedRestore,
    startWithSecretKeys: mocks.shieldedStart,
  })),
}));

vi.mock("@midnight-ntwrk/wallet-sdk-unshielded-wallet", () => ({
  InMemoryTransactionHistoryStorage: Object.assign(
    vi.fn(function InMemoryTransactionHistoryStorage() {
      return mocks.historyConstructor();
    }),
    { fromSerialized: mocks.historyFromSerialized },
  ),
  PublicKey: { fromKeyStore: mocks.publicKeyFromKeyStore },
  UnshieldedWallet: vi.fn(() => ({
    restore: mocks.unshieldedRestore,
    startWithPublicKey: mocks.unshieldedStart,
  })),
}));

vi.mock("@midnight-ntwrk/wallet-sdk-dust-wallet", () => ({
  DustWallet: vi.fn(() => ({
    restore: mocks.dustRestore,
    startWithSecretKey: mocks.dustStart,
  })),
}));

vi.mock("@midnight-ntwrk/wallet-sdk-facade", () => ({
  WalletFacade: { init: mocks.walletFacadeInit },
}));

vi.mock("../api-logger.js", () => ({
  getLogger: () => ({ info: mocks.loggerInfo }),
}));

vi.mock("../wallet-keys.js", () => ({
  deriveMidnightWalletKeys: mocks.deriveMidnightWalletKeys,
  createUnshieldedKeystoreFromKeys: mocks.createUnshieldedKeystoreFromKeys,
}));

vi.mock("../wallet-sdk-config.js", () => ({
  buildShieldedConfig: mocks.buildShieldedConfig,
  buildUnshieldedConfig: mocks.buildUnshieldedConfig,
  buildDustConfig: mocks.buildDustConfig,
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

const snapshot = {
  shieldedState: "shielded-state",
  unshieldedState: "unshielded-state",
  dustState: "dust-state",
  unshieldedHistory: "history-state",
};

describe("wallet context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deriveMidnightWalletKeys.mockReturnValue(mocks.keys);
    mocks.createUnshieldedKeystoreFromKeys.mockReturnValue(
      mocks.unshieldedKeystore,
    );
    mocks.zswapFromSeed.mockReturnValue(mocks.shieldedSecretKeys);
    mocks.dustFromSeed.mockReturnValue(mocks.dustSecretKey);
    mocks.initialParameters.mockReturnValue({ dust: mocks.dustParameters });
    mocks.historyConstructor.mockReturnValue(mocks.freshHistory);
    mocks.historyFromSerialized.mockReturnValue(mocks.restoredHistory);
    mocks.publicKeyFromKeyStore.mockReturnValue(mocks.publicKey);
    mocks.buildShieldedConfig.mockReturnValue(mocks.shieldedConfig);
    mocks.buildUnshieldedConfig.mockReturnValue(mocks.unshieldedConfig);
    mocks.buildDustConfig.mockReturnValue(mocks.dustConfig);
    mocks.shieldedRestore.mockReturnValue(mocks.shieldedWallet);
    mocks.shieldedStart.mockReturnValue(mocks.shieldedWallet);
    mocks.unshieldedRestore.mockReturnValue(mocks.unshieldedWallet);
    mocks.unshieldedStart.mockReturnValue(mocks.unshieldedWallet);
    mocks.dustRestore.mockReturnValue(mocks.dustWallet);
    mocks.dustStart.mockReturnValue(mocks.dustWallet);
    mocks.walletFacadeInit.mockResolvedValue(mocks.wallet);
    mocks.wallet.start.mockResolvedValue(undefined);
  });

  it("constructs and starts a fresh wallet from derived keys", async () => {
    await expect(createWalletContext(config, "seed")).resolves.toEqual({
      wallet: mocks.wallet,
      shieldedWallet: mocks.shieldedWallet,
      unshieldedWallet: mocks.unshieldedWallet,
      dustWallet: mocks.dustWallet,
      unshieldedHistoryStorage: mocks.freshHistory,
      shieldedSecretKeys: mocks.shieldedSecretKeys,
      dustSecretKey: mocks.dustSecretKey,
      unshieldedKeystore: mocks.unshieldedKeystore,
    });

    expect(mocks.deriveMidnightWalletKeys).toHaveBeenCalledWith("seed");
    expect(mocks.zswapFromSeed).toHaveBeenCalledWith(mocks.keys.zswap);
    expect(mocks.dustFromSeed).toHaveBeenCalledWith(mocks.keys.dust);
    expect(mocks.createUnshieldedKeystoreFromKeys).toHaveBeenCalledWith(
      mocks.keys,
    );
    expect(mocks.publicKeyFromKeyStore).toHaveBeenCalledWith(
      mocks.unshieldedKeystore,
    );
    expect(mocks.shieldedStart).toHaveBeenCalledWith(mocks.shieldedSecretKeys);
    expect(mocks.unshieldedStart).toHaveBeenCalledWith(mocks.publicKey);
    expect(mocks.dustStart).toHaveBeenCalledWith(
      mocks.dustSecretKey,
      mocks.dustParameters,
    );
    expect(mocks.wallet.start).toHaveBeenCalledWith(
      mocks.shieldedSecretKeys,
      mocks.dustSecretKey,
    );
  });

  it("restores every wallet component and serialized history with exact facade wiring", async () => {
    await createWalletContext(config, "seed", snapshot);

    expect(mocks.historyFromSerialized).toHaveBeenCalledWith("history-state");
    expect(mocks.shieldedRestore).toHaveBeenCalledWith("shielded-state");
    expect(mocks.unshieldedRestore).toHaveBeenCalledWith("unshielded-state");
    expect(mocks.dustRestore).toHaveBeenCalledWith("dust-state");
    expect(mocks.shieldedStart).not.toHaveBeenCalled();
    expect(mocks.unshieldedStart).not.toHaveBeenCalled();
    expect(mocks.dustStart).not.toHaveBeenCalled();
    expect(mocks.buildUnshieldedConfig).toHaveBeenCalledWith(
      config,
      mocks.restoredHistory,
    );
    expect(mocks.walletFacadeInit).toHaveBeenCalledWith({
      configuration: {
        ...mocks.shieldedConfig,
        ...mocks.unshieldedConfig,
        ...mocks.dustConfig,
      },
      shielded: expect.any(Function),
      unshielded: expect.any(Function),
      dust: expect.any(Function),
    });

    const facadeInput = mocks.walletFacadeInit.mock.calls[0]?.[0];
    await expect(facadeInput.shielded()).resolves.toBe(mocks.shieldedWallet);
    await expect(facadeInput.unshielded()).resolves.toBe(
      mocks.unshieldedWallet,
    );
    await expect(facadeInput.dust()).resolves.toBe(mocks.dustWallet);
  });

  it("uses fresh history storage when an otherwise complete snapshot omits history", async () => {
    const { unshieldedHistory: _history, ...snapshotWithoutHistory } = snapshot;

    const context = await createWalletContext(
      config,
      "seed",
      snapshotWithoutHistory,
    );

    expect(context.unshieldedHistoryStorage).toBe(mocks.freshHistory);
    expect(mocks.historyFromSerialized).not.toHaveBeenCalled();
    expect(mocks.buildUnshieldedConfig).toHaveBeenCalledWith(
      config,
      mocks.freshHistory,
    );
  });

  it("propagates restore failure and short-circuits later factories and facade initialization", async () => {
    mocks.shieldedRestore.mockImplementationOnce(() => {
      throw new Error("shielded restore failed");
    });

    await expect(createWalletContext(config, "seed", snapshot)).rejects.toThrow(
      "shielded restore failed",
    );
    expect(mocks.unshieldedRestore).not.toHaveBeenCalled();
    expect(mocks.dustRestore).not.toHaveBeenCalled();
    expect(mocks.walletFacadeInit).not.toHaveBeenCalled();
  });

  it("propagates facade initialization failure without starting the facade", async () => {
    mocks.walletFacadeInit.mockRejectedValueOnce(new Error("init failed"));

    await expect(createWalletContext(config, "seed")).rejects.toThrow(
      "init failed",
    );
    expect(mocks.wallet.start).not.toHaveBeenCalled();
  });

  it("propagates facade start failure after initialization", async () => {
    mocks.wallet.start.mockRejectedValueOnce(new Error("start failed"));

    await expect(createWalletContext(config, "seed")).rejects.toThrow(
      "start failed",
    );
    expect(mocks.walletFacadeInit).toHaveBeenCalledOnce();
    expect(mocks.wallet.start).toHaveBeenCalledOnce();
  });
});
