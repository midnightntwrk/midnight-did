import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWalletContext: vi.fn(),
  waitForWalletSync: vi.fn(),
  waitForWalletFunds: vi.fn(),
  randomBytes: vi.fn(),
  toHex: vi.fn(),
}));

vi.mock("@midnight-ntwrk/midnight-js-utils", () => ({
  toHex: mocks.toHex,
}));

vi.mock("../lightweight.js", () => ({
  randomBytes: mocks.randomBytes,
}));

vi.mock("../wallet-context.js", () => ({
  createWalletContext: mocks.createWalletContext,
}));

vi.mock("../wallet-state.js", () => ({
  getWalletBalances: vi.fn(),
  serializeWalletState: vi.fn(),
  waitForWalletFunds: mocks.waitForWalletFunds,
  waitForWalletSync: mocks.waitForWalletSync,
}));

import { type Config } from "../config.js";
import { type MidnightDIDWalletContext } from "../types.js";
import {
  buildFreshWallet,
  buildWallet,
  buildWalletAndWaitForFunds,
  restoreWalletFromState,
} from "../wallet.js";

const config: Config = {
  logDir: "logs",
  indexer: "http://indexer",
  indexerWS: "wss://indexer",
  node: "http://node",
  proofServer: "http://proof",
};
const walletContext = {
  wallet: { kind: "facade" },
} as unknown as MidnightDIDWalletContext;
const snapshot = {
  shieldedState: "shielded",
  unshieldedState: "unshielded",
  dustState: "dust",
};

describe("wallet facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createWalletContext.mockResolvedValue(walletContext);
    mocks.waitForWalletSync.mockResolvedValue(undefined);
    mocks.waitForWalletFunds.mockResolvedValue(undefined);
    mocks.randomBytes.mockReturnValue(new Uint8Array(32).fill(7));
    mocks.toHex.mockReturnValue("07".repeat(32));
  });

  it("forwards build and restore arguments to wallet-context construction", async () => {
    await expect(buildWallet(config, "build-seed")).resolves.toBe(
      walletContext,
    );
    expect(mocks.createWalletContext).toHaveBeenNthCalledWith(
      1,
      config,
      "build-seed",
      undefined,
    );

    await expect(
      restoreWalletFromState(config, "restore-seed", snapshot),
    ).resolves.toBe(walletContext);
    expect(mocks.createWalletContext).toHaveBeenNthCalledWith(
      2,
      config,
      "restore-seed",
      snapshot,
    );
  });

  it("waits for sync strictly before checking funds", async () => {
    const order: string[] = [];
    mocks.waitForWalletSync.mockImplementationOnce(async () => {
      order.push("sync");
    });
    mocks.waitForWalletFunds.mockImplementationOnce(async () => {
      order.push("funds");
    });

    await expect(buildWalletAndWaitForFunds(config, "seed")).resolves.toBe(
      walletContext,
    );

    expect(order).toEqual(["sync", "funds"]);
    expect(mocks.waitForWalletSync).toHaveBeenCalledWith(walletContext);
    expect(mocks.waitForWalletFunds).toHaveBeenCalledWith(walletContext);
  });

  it("short-circuits funds waiting when sync fails", async () => {
    mocks.waitForWalletSync.mockRejectedValueOnce(new Error("sync failed"));

    await expect(buildWalletAndWaitForFunds(config, "seed")).rejects.toThrow(
      "sync failed",
    );
    expect(mocks.waitForWalletFunds).not.toHaveBeenCalled();
  });

  it("builds a fresh wallet from exactly 32 random bytes encoded as hex", async () => {
    const randomSeed = new Uint8Array(32).fill(7);
    mocks.randomBytes.mockReturnValueOnce(randomSeed);

    await expect(buildFreshWallet(config)).resolves.toBe(walletContext);

    expect(mocks.randomBytes).toHaveBeenCalledWith(32);
    expect(mocks.toHex).toHaveBeenCalledWith(randomSeed);
    expect(mocks.createWalletContext).toHaveBeenCalledWith(
      config,
      "07".repeat(32),
      undefined,
    );
    expect(mocks.waitForWalletSync).toHaveBeenCalledWith(walletContext);
    expect(mocks.waitForWalletFunds).toHaveBeenCalledWith(walletContext);
  });
});
