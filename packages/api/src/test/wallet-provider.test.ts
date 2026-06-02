import * as Rx from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionIntentMocks = vi.hoisted(() => ({
  signTransactionIntents: vi.fn(),
}));

vi.mock("../transaction-intents.js", () => ({
  signTransactionIntents: transactionIntentMocks.signTransactionIntents,
}));

import { type MidnightDIDWalletContext } from "../types.js";
import { createWalletAndMidnightProvider } from "../wallet-provider.js";

const makeWalletContext = (
  overrides: {
    readonly recipe?: {
      readonly baseTransaction: unknown;
      readonly balancingTransaction?: unknown;
    };
  } = {},
): {
  readonly ctx: MidnightDIDWalletContext;
  readonly wallet: {
    readonly state: ReturnType<typeof vi.fn>;
    readonly balanceUnboundTransaction: ReturnType<typeof vi.fn>;
    readonly finalizeRecipe: ReturnType<typeof vi.fn>;
    readonly submitTransaction: ReturnType<typeof vi.fn>;
  };
  readonly unshieldedKeystore: {
    readonly signData: ReturnType<typeof vi.fn>;
  };
} => {
  const recipe = overrides.recipe ?? {
    baseTransaction: { kind: "base-tx" },
    balancingTransaction: { kind: "balancing-tx" },
  };
  const wallet = {
    state: vi.fn(() =>
      Rx.of(
        { isSynced: false },
        {
          isSynced: true,
          shielded: {
            coinPublicKey: { toHexString: () => "coin-public-key" },
            encryptionPublicKey: {
              toHexString: () => "encryption-public-key",
            },
          },
        },
      ),
    ),
    balanceUnboundTransaction: vi.fn(async () => recipe),
    finalizeRecipe: vi.fn(async () => ({ kind: "finalized-tx", recipe })),
    submitTransaction: vi.fn(async (tx: unknown) => ({
      kind: "submitted-tx",
      tx,
    })),
  };
  const unshieldedKeystore = {
    signData: vi.fn(() => ({ kind: "signature" })),
  };

  return {
    wallet,
    unshieldedKeystore,
    ctx: {
      wallet,
      shieldedSecretKeys: { kind: "shielded-secret-keys" },
      dustSecretKey: { kind: "dust-secret-key" },
      unshieldedKeystore,
    } as unknown as MidnightDIDWalletContext,
  };
};

describe("wallet and midnight provider wiring", () => {
  beforeEach(() => {
    transactionIntentMocks.signTransactionIntents.mockClear();
  });

  it("waits for a synced wallet state before exposing public keys", async () => {
    const { ctx, wallet } = makeWalletContext();

    const provider = await createWalletAndMidnightProvider(ctx);

    expect(wallet.state).toHaveBeenCalledOnce();
    expect(provider.getCoinPublicKey()).toBe("coin-public-key");
    expect(provider.getEncryptionPublicKey()).toBe("encryption-public-key");
  });

  it("balances, manually signs, and finalizes a transaction recipe", async () => {
    const { ctx, wallet, unshieldedKeystore } = makeWalletContext();
    const provider = await createWalletAndMidnightProvider(ctx);
    const tx = { kind: "unbalanced-tx" };
    const ttl = new Date("2026-05-22T00:00:00.000Z");

    const finalized = await provider.balanceTx(tx as any, ttl);

    expect(wallet.balanceUnboundTransaction).toHaveBeenCalledWith(
      tx,
      {
        shieldedSecretKeys: ctx.shieldedSecretKeys,
        dustSecretKey: ctx.dustSecretKey,
      },
      { ttl },
    );
    expect(transactionIntentMocks.signTransactionIntents).toHaveBeenCalledTimes(
      2,
    );
    expect(
      transactionIntentMocks.signTransactionIntents,
    ).toHaveBeenNthCalledWith(
      1,
      { kind: "base-tx" },
      expect.any(Function),
      "proof",
    );
    expect(
      transactionIntentMocks.signTransactionIntents,
    ).toHaveBeenNthCalledWith(
      2,
      { kind: "balancing-tx" },
      expect.any(Function),
      "pre-proof",
    );
    const signFn =
      transactionIntentMocks.signTransactionIntents.mock.calls[0][1];
    expect(signFn(new Uint8Array([1, 2, 3]))).toEqual({ kind: "signature" });
    expect(unshieldedKeystore.signData).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
    );
    expect(wallet.finalizeRecipe).toHaveBeenCalledWith({
      baseTransaction: { kind: "base-tx" },
      balancingTransaction: { kind: "balancing-tx" },
    });
    expect(finalized).toEqual({
      kind: "finalized-tx",
      recipe: {
        baseTransaction: { kind: "base-tx" },
        balancingTransaction: { kind: "balancing-tx" },
      },
    });
  });

  it("skips pre-proof signing when no balancing transaction is returned", async () => {
    const { ctx } = makeWalletContext({
      recipe: { baseTransaction: { kind: "base-only" } },
    });
    const provider = await createWalletAndMidnightProvider(ctx);
    const startedAt = Date.now();

    await provider.balanceTx({ kind: "unbalanced-tx" } as any);

    expect(
      transactionIntentMocks.signTransactionIntents,
    ).toHaveBeenCalledOnce();
    expect(transactionIntentMocks.signTransactionIntents).toHaveBeenCalledWith(
      { kind: "base-only" },
      expect.any(Function),
      "proof",
    );
    const [, , balanceOptions] = (
      ctx.wallet.balanceUnboundTransaction as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(balanceOptions.ttl).toBeInstanceOf(Date);
    expect(balanceOptions.ttl.getTime()).toBeGreaterThanOrEqual(
      startedAt + 30 * 60 * 1000,
    );
    expect(balanceOptions.ttl.getTime()).toBeLessThanOrEqual(
      Date.now() + 30 * 60 * 1000,
    );
  });

  it("submits transactions through the wallet facade", async () => {
    const { ctx, wallet } = makeWalletContext();
    const provider = await createWalletAndMidnightProvider(ctx);
    const tx = { kind: "balanced-tx" };

    await expect(provider.submitTx(tx as any)).resolves.toEqual({
      kind: "submitted-tx",
      tx,
    });
    expect(wallet.submitTransaction).toHaveBeenCalledWith(tx);
  });
});
