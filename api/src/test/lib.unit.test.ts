import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import * as Rx from "rxjs";
import { describe, expect, it, vi } from "vitest";

import {
  hashProverKey,
  initPrivateState,
  randomBytes,
  setLogger,
  waitForFunds,
  waitForSync,
} from "../lib";

const logger = {
  info: () => undefined,
} as any;

describe("lib lightweight unit helpers", () => {
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
    setLogger(logger);
    const wallet = {
      state: () => Rx.of({ isSynced: true }),
    } as any;

    const state = await waitForSync(wallet);
    expect(state.isSynced).toBe(true);
  });

  it("waitForFunds resolves to positive unshielded balance", async () => {
    setLogger(logger);
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

  it("skips private state IO only for the provider missing-contract-address error", async () => {
    setLogger(logger);
    const providerError = new Error(
      "Contract address not set. Call setContractAddress() before accessing private state.",
    );
    const providers = {
      privateStateProvider: {
        get: vi.fn().mockRejectedValue(providerError),
        set: vi.fn().mockRejectedValue(providerError),
      },
      zkConfigProvider: {
        getProverKey: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      },
    } as any;

    const privateState = await initPrivateState(providers);

    expect(privateState.secretKey).toHaveLength(32);
    expect(providers.zkConfigProvider.getProverKey).toHaveBeenCalledWith(
      "addVerificationMethod",
    );
  });

  it("does not swallow unrelated errors that mention contract address text", async () => {
    setLogger(logger);
    const providers = {
      privateStateProvider: {
        get: vi
          .fn()
          .mockRejectedValue(
            new Error("audit cache failed: Contract address not set"),
          ),
        set: vi.fn(),
      },
      zkConfigProvider: {
        getProverKey: vi.fn(),
      },
    } as any;

    await expect(initPrivateState(providers)).rejects.toThrow("audit cache");
    expect(providers.zkConfigProvider.getProverKey).not.toHaveBeenCalled();
  });
});
