import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import * as Rx from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setLogger } from "../api-logger";
import {
  getWalletBalances,
  serializeWalletState,
  waitForWalletFunds,
  waitForWalletSync,
} from "../wallet-state";

describe("wallet state helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLogger({ info: vi.fn() } as any);
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
    const token = unshieldedToken().raw;
    const wallet = {
      state: vi.fn(() =>
        Rx.of({
          isSynced: true,
          unshielded: { balances: { [token]: 5n } },
          dust: { balance: vi.fn(() => 0n) },
        }),
      ),
    };

    await expect(waitForWalletFunds({ wallet } as any)).resolves.toBe(5n);
  });
});
