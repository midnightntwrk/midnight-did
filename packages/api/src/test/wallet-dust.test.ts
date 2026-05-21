import * as Rx from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setLogger } from "../api-logger";
import {
  filterUnregisteredNightUtxos,
  registerForDustGeneration,
} from "../wallet-dust";

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
  },
  unshielded: {
    availableCoins: nightCoins,
  },
});

const makeKeystore = () => ({
  getPublicKey: vi.fn(() => "public-key"),
  signData: vi.fn(() => "signature"),
});

describe("wallet dust registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLogger({ info: vi.fn() } as any);
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

  it("returns immediately when dust is already available", async () => {
    const wallet = {
      state: vi.fn(() =>
        Rx.of(syncedState({ dustAvailable: [{}], dustBalance: 5n })),
      ),
      registerNightUtxosForDustGeneration: vi.fn(),
      finalizeRecipe: vi.fn(),
      submitTransaction: vi.fn(),
    };

    await registerForDustGeneration(wallet as any, makeKeystore() as any);

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

    await registerForDustGeneration(wallet as any, makeKeystore() as any);

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

    await registerForDustGeneration(wallet as any, keystore as any);

    expect(wallet.registerNightUtxosForDustGeneration).toHaveBeenCalledWith(
      [eligible],
      "public-key",
      expect.any(Function),
    );
    const sign = registerNightUtxosForDustGeneration.mock.calls[0][2];
    expect(sign(new Uint8Array([1, 2, 3]))).toBe("signature");
    expect(keystore.signData).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(wallet.finalizeRecipe).toHaveBeenCalledWith(recipe);
    expect(wallet.submitTransaction).toHaveBeenCalledWith(finalized);
  });
});
