import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import * as Rx from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLogger } from "../api-logger.js";
import {
  getWalletBalances,
  serializeWalletState,
  waitForWalletFunds,
  waitForWalletSync,
} from "../wallet-state.js";

describe("wallet state helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLogger({ info: vi.fn() } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serializes each wallet component into a restorable snapshot", async () => {
    await expect(
      serializeWalletState({
        shieldedWallet: {
          serializeState: vi.fn(async () => "shielded-state"),
        },
        unshieldedWallet: {
          serializeState: vi.fn(async () => "unshielded-state"),
        },
        dustWallet: {
          serializeState: vi.fn(async () => "dust-state"),
        },
        unshieldedHistoryStorage: {
          serialize: vi.fn(() => "history-state"),
        },
      } as any),
    ).resolves.toEqual({
      shieldedState: "shielded-state",
      unshieldedState: "unshielded-state",
      dustState: "dust-state",
      unshieldedHistory: "history-state",
    });
  });

  it("waits for the wallet facade synced state", async () => {
    const syncedState = { isSynced: true };
    const wallet = {
      waitForSyncedState: vi.fn(async () => syncedState),
    };

    await expect(waitForWalletSync({ wallet } as any)).resolves.toBe(
      syncedState,
    );
    expect(wallet.waitForSyncedState).toHaveBeenCalledTimes(1);
  });

  it("maps unsynced, missing, and populated balances", () => {
    const token = unshieldedToken().raw;

    expect(getWalletBalances({ isSynced: false } as any)).toEqual({
      night: null,
      dust: null,
    });
    expect(
      getWalletBalances({
        isSynced: true,
        unshielded: { balances: {} },
        dust: { balance: vi.fn(() => 0n) },
      } as any),
    ).toEqual({
      night: 0n,
      dust: 0n,
    });
    expect(
      getWalletBalances({
        isSynced: true,
        unshielded: { balances: { [token]: 42n } },
        dust: { balance: vi.fn(() => 7n) },
      } as any),
    ).toEqual({
      night: 42n,
      dust: 7n,
    });
  });

  it("waits until a synced wallet state exposes NIGHT funds", async () => {
    vi.useFakeTimers();
    const token = unshieldedToken().raw;
    const states = new Rx.Subject<unknown>();
    const wallet = {
      state: vi.fn(() => states.asObservable()),
    };
    const result = waitForWalletFunds({ wallet } as any);
    let resolved = false;
    result.then(() => {
      resolved = true;
    });

    states.next({
      isSynced: true,
      unshielded: { balances: { [token]: 0n } },
      dust: { balance: vi.fn(() => 0n) },
    });
    states.next({
      isSynced: true,
      unshielded: { balances: { [token]: 5n } },
      dust: { balance: vi.fn(() => 0n) },
    });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    states.next({
      isSynced: true,
      unshielded: { balances: { [token]: 5n } },
      dust: { balance: vi.fn(() => 0n) },
    });

    await expect(result).resolves.toBe(5n);
  });
});
