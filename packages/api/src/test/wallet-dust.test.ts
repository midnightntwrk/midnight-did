import * as Rx from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLogger } from "../api-logger.js";
import {
  filterUnregisteredNightUtxos,
  registerForDustGeneration,
  waitForSpendableDust,
} from "../wallet-dust.js";

const syncedState = ({
  dustAvailable = [],
  dustBalance = 0n,
  nightCoins = [],
}: {
  dustAvailable?: unknown[];
  dustBalance?: bigint;
  nightCoins?: unknown[];
}) => ({
  isSynced: true,
  dust: {
    availableCoins: dustAvailable,
    balance: vi.fn(() => dustBalance),
    progress: { appliedIndex: 0n },
  },
  unshielded: {
    availableCoins: nightCoins,
  },
});

const makeKeystore = () => ({
  getPublicKey: vi.fn(() => "public-key"),
  signDataAsync: vi.fn(async () => "signature"),
});

describe("wallet dust registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLogger({ info: vi.fn() } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters NIGHT UTXOs already registered for dust generation", () => {
    const eligible = { meta: { registeredForDustGeneration: false } };
    const missingMetadata = {};
    const alreadyRegistered = {
      meta: { registeredForDustGeneration: true },
    };

    expect(
      filterUnregisteredNightUtxos([
        eligible,
        missingMetadata,
        alreadyRegistered,
      ]),
    ).toEqual([eligible, missingMetadata]);
  });

  it("waits for positive indexed-time balance after genesis coins", async () => {
    const genesis = new Date("2025-08-05T12:00:00.000Z");
    const advanced = new Date("2026-11-11T20:00:00.000Z");
    const indexedTimes = [genesis, advanced];
    const state = {
      isSynced: true,
      dust: {
        availableCoins: [{ initialValue: 0n }],
        balance: (time: Date) =>
          time.getTime() >= advanced.getTime() ? 42n : 0n,
        progress: { appliedIndex: 0n },
      },
      unshielded: { availableCoins: [] },
    };
    const wallet = {
      state: vi.fn(() => Rx.of(state)),
      registerNightUtxosForDustGeneration: vi.fn(),
      finalizeRecipe: vi.fn(),
      submitTransaction: vi.fn(),
    };
    const indexedBlockTime = vi.fn(
      async () => indexedTimes.shift() ?? advanced,
    );

    await registerForDustGeneration(wallet as any, makeKeystore() as any, {
      indexedBlockTime,
      pollIntervalMs: 0,
      timeoutMs: 1_000,
    });

    expect(indexedBlockTime).toHaveBeenCalledTimes(2);
    expect(wallet.registerNightUtxosForDustGeneration).not.toHaveBeenCalled();
    expect(wallet.submitTransaction).not.toHaveBeenCalled();
  });

  it("disposes a stalled wallet-state observable on timeout", async () => {
    const subject = new Rx.Subject();
    const wallet = { state: vi.fn(() => subject) };
    await expect(
      waitForSpendableDust(wallet as any, {
        indexedBlockTime: async () => new Date(1000),
        timeoutMs: 30,
        pollIntervalMs: 5,
      }),
    ).rejects.toThrow(/deadline|cancelled/u);
    expect(subject.observers).toHaveLength(0);
  });

  it("disposes a stalled wallet-state observable on abort", async () => {
    const controller = new AbortController();
    const subject = new Rx.Subject();
    const wallet = { state: vi.fn(() => subject) };
    const pending = waitForSpendableDust(wallet as any, {
      indexedBlockTime: async () => new Date(1000),
      timeoutMs: 5_000,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/u);
    expect(subject.observers).toHaveLength(0);
  });

  it("bounds the initial registration state read", async () => {
    const subject = new Rx.Subject();
    const wallet = {
      state: vi.fn(() => subject),
      registerNightUtxosForDustGeneration: vi.fn(),
      finalizeRecipe: vi.fn(),
      submitTransaction: vi.fn(),
    };
    await expect(
      registerForDustGeneration(wallet as any, makeKeystore() as any, {
        indexedBlockTime: async () => new Date(1000),
        timeoutMs: 30,
      }),
    ).rejects.toThrow(/deadline|cancelled/u);
    expect(subject.observers).toHaveLength(0);
    expect(wallet.registerNightUtxosForDustGeneration).not.toHaveBeenCalled();
  });

  it("rejects an already-aborted registration before reading state", async () => {
    const controller = new AbortController();
    controller.abort();
    const wallet = { state: vi.fn() };
    await expect(
      registerForDustGeneration(wallet as any, makeKeystore() as any, {
        indexedBlockTime: async () => new Date(1000),
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/u);
    expect(wallet.state).not.toHaveBeenCalled();
  });

  it.each([
    ["normal poll sleep", 1_000, 100],
    ["deadline-clipped poll sleep", 100, 1_000],
  ])(
    "rejects promptly when aborted during %s",
    async (_label, timeoutMs, pollIntervalMs) => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const wallet = {
        state: vi.fn(() => Rx.of(syncedState({ dustBalance: 0n }))),
      };
      const pending = waitForSpendableDust(wallet as any, {
        indexedBlockTime: async () => new Date(1000),
        timeoutMs,
        pollIntervalMs,
        signal: controller.signal,
      });
      await vi.advanceTimersByTimeAsync(1);
      controller.abort();
      await expect(pending).rejects.toThrow(/cancelled/u);
    },
  );

  it("bounds a stalled indexed-block read", async () => {
    const state = syncedState({ dustAvailable: [{}], dustBalance: 0n });
    const wallet = { state: vi.fn(() => Rx.of(state)) };
    await expect(
      waitForSpendableDust(wallet as any, {
        indexedBlockTime: () => new Promise<Date>(() => undefined),
        timeoutMs: 30,
        pollIntervalMs: 5,
      }),
    ).rejects.toThrow(/deadline|cancelled/u);
  });

  it("cancels an in-flight readiness wait", async () => {
    const controller = new AbortController();
    const wallet = { state: vi.fn(() => new Rx.Subject()) };
    const pending = waitForSpendableDust(wallet as any, {
      indexedBlockTime: async () => new Date(1000),
      timeoutMs: 5_000,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/u);
  });

  it("rejects non-finite readiness bounds", async () => {
    const wallet = { state: vi.fn(() => Rx.of(syncedState({}))) };
    await expect(
      waitForSpendableDust(wallet as any, {
        indexedBlockTime: async () => new Date(1000),
        timeoutMs: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toThrow(/timeoutMs/u);
  });

  it("returns immediately when dust is already available", async () => {
    const wallet = {
      state: vi.fn(() =>
        Rx.of(syncedState({ dustAvailable: [{}], dustBalance: 5n })),
      ),
      registerNightUtxosForDustGeneration: vi.fn(),
      finalizeRecipe: vi.fn(),
      submitTransaction: vi.fn(),
    };

    await registerForDustGeneration(wallet as any, makeKeystore() as any, {
      indexedBlockTime: async () => new Date(),
    });

    expect(wallet.registerNightUtxosForDustGeneration).not.toHaveBeenCalled();
    expect(wallet.submitTransaction).not.toHaveBeenCalled();
  });

  it("waits for existing dust generation when no eligible NIGHT UTXOs remain", async () => {
    const wallet = {
      state: vi
        .fn()
        .mockReturnValueOnce(
          Rx.of(
            syncedState({
              nightCoins: [{ meta: { registeredForDustGeneration: true } }],
            }),
          ),
        )
        .mockReturnValueOnce(Rx.of(syncedState({ dustBalance: 1n }))),
      registerNightUtxosForDustGeneration: vi.fn(),
      finalizeRecipe: vi.fn(),
      submitTransaction: vi.fn(),
    };

    await registerForDustGeneration(wallet as any, makeKeystore() as any, {
      indexedBlockTime: async () => new Date(),
    });

    expect(wallet.registerNightUtxosForDustGeneration).not.toHaveBeenCalled();
  });

  it("registers eligible NIGHT UTXOs and submits the finalized transaction", async () => {
    const eligible = { meta: { registeredForDustGeneration: false } };
    const recipe = { recipe: true };
    const finalized = { finalized: true };
    const keystore = makeKeystore();
    const registerNightUtxosForDustGeneration = vi.fn(
      (
        _nightUtxos: unknown[],
        _publicKey: string,
        _sign: (payload: Uint8Array) => unknown,
      ) => recipe,
    );
    const wallet = {
      state: vi
        .fn()
        .mockReturnValueOnce(
          Rx.of(
            syncedState({
              nightCoins: [
                eligible,
                { meta: { registeredForDustGeneration: true } },
              ],
            }),
          ),
        )
        .mockReturnValueOnce(Rx.of(syncedState({ dustBalance: 1n }))),
      registerNightUtxosForDustGeneration,
      finalizeRecipe: vi.fn(() => finalized),
      submitTransaction: vi.fn(),
    };

    await registerForDustGeneration(wallet as any, keystore as any, {
      indexedBlockTime: async () => new Date(1000),
    });

    expect(wallet.registerNightUtxosForDustGeneration).toHaveBeenCalledWith(
      [eligible],
      "public-key",
      expect.any(Function),
    );
    const sign = registerNightUtxosForDustGeneration.mock.calls[0][2];
    await expect(sign(new Uint8Array([1, 2, 3]))).resolves.toBe("signature");
    expect(keystore.signDataAsync).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
    );
    expect(wallet.finalizeRecipe).toHaveBeenCalledWith(recipe);
    expect(wallet.submitTransaction).toHaveBeenCalledWith(finalized);
  });
});
