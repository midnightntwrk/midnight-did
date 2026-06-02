import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { describe, expect, it } from "vitest";

import { getWalletBalances } from "../lib.js";
import { randomBytes } from "../lightweight.js";

describe("lib lightweight unit helpers", () => {
  it("loads runtime polyfills through the public barrel", () => {
    expect(typeof (globalThis as { WebSocket?: unknown }).WebSocket).toBe(
      "function",
    );
  });

  it("randomBytes returns requested length", () => {
    const bytes = randomBytes(32);
    expect(bytes).toHaveLength(32);
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
