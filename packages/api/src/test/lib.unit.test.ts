import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import * as Rx from "rxjs";
import { describe, expect, it } from "vitest";

import { getWalletBalances } from "../lib";
import {
  hashProverKey,
  randomBytes,
  setLightweightLogger,
  waitForFunds,
  waitForSync,
} from "../lightweight";

const logger = {
  info: () => undefined,
} as any;

describe("lib lightweight unit helpers", () => {
  it("loads runtime polyfills through the public barrel", () => {
    expect(typeof (globalThis as { WebSocket?: unknown }).WebSocket).toBe(
      "function",
    );
  });

  it("hashProverKey is deterministic and returns 32 bytes", async () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const first = await hashProverKey(input);
    const second = await hashProverKey(input);
    expect(first.length).toBe(32);
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it("randomBytes returns requested length", () => {
    const bytes = randomBytes(32);
    expect(bytes).toHaveLength(32);
  });

  it("waitForSync resolves when wallet state is synced", async () => {
    setLightweightLogger(logger);
    const wallet = {
      state: () => Rx.of({ isSynced: true }),
    } as any;

    const state = await waitForSync(wallet);
    expect(state.isSynced).toBe(true);
  });

  it("waitForFunds resolves to positive unshielded balance", async () => {
    setLightweightLogger(logger);
    const token = unshieldedToken().raw;
    const wallet = {
      state: () =>
        Rx.of({
          isSynced: true,
          unshielded: { balances: { [token]: 42n } },
        }),
    } as any;

    const balance = await waitForFunds(wallet);
    expect(balance).toBe(42n);
  });

  it("getWalletBalances distinguishes unavailable and zero balances", () => {
    const token = unshieldedToken().raw;

    expect(
      getWalletBalances({
        isSynced: false,
      } as any),
    ).toEqual({
      night: null,
      dust: null,
    });

    expect(
      getWalletBalances({
        isSynced: true,
        unshielded: { balances: { [token]: 0n } },
        dust: { balance: () => 5n },
      } as any),
    ).toEqual({
      night: 0n,
      dust: 5n,
    });
  });
});
