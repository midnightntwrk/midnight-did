import * as Rx from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ledgerTransactionMock = vi.hoisted(() => ({
  seal: vi.fn(
    (era: string, stage: string, tx: { serialize(): Uint8Array }) => ({
      era,
      stage,
      serialize: () => tx.serialize(),
    }),
  ),
}));

vi.mock("@midnight-ntwrk/midnight-js-types", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@midnight-ntwrk/midnight-js-types")>();
  return {
    ...actual,
    LedgerTransaction: { seal: ledgerTransactionMock.seal },
  };
});

import { type MidnightDIDWalletContext } from "../types.js";
import { createWalletAndMidnightProvider } from "../wallet-provider.js";

const makeWalletContext = () => {
  const recipe = { baseTransaction: { kind: "base-tx" } };
  const wallet = {
    state: vi.fn(() =>
      Rx.of(
        { isSynced: false },
        {
          isSynced: true,
          activeProtocolVersion: 2_000_000,
          shielded: {
            coinPublicKey: { toHexString: () => "coin-public-key" },
            encryptionPublicKey: {
              toHexString: () => "encryption-public-key",
            },
          },
        },
      ),
    ),
    adoptTransaction: vi.fn((bytes: Uint8Array, stage: string) => ({
      kind: "wallet-handle",
      bytes,
      stage,
      serialize: () => bytes,
    })),
    balanceUnboundTransaction: vi.fn(async () => recipe),
    signRecipe: vi.fn(async (input: unknown, _signSegment: unknown) => input),
    finalizeRecipe: vi.fn(async () => ({
      kind: "finalized-wallet-tx",
      serialize: () => new Uint8Array([9, 9]),
    })),
    submitTransaction: vi.fn(
      async (tx: unknown) => `submitted:${JSON.stringify(tx)}`,
    ),
  };
  const unshieldedKeystore = {
    signDataAsync: vi.fn(async () => ({ kind: "signature" })),
  };
  const ctx = {
    wallet,
    shieldedSecretKeys: { kind: "shielded-secret-keys" },
    dustSecretKey: { kind: "dust-secret-key" },
    unshieldedKeystore,
  } as unknown as MidnightDIDWalletContext;
  return { ctx, wallet, unshieldedKeystore };
};

describe("wallet and midnight provider wiring", () => {
  beforeEach(() => {
    ledgerTransactionMock.seal.mockClear();
  });

  it("waits for a synced wallet state and declares v9 only", async () => {
    const { ctx, wallet } = makeWalletContext();
    const provider = await createWalletAndMidnightProvider(ctx);

    expect(wallet.state).toHaveBeenCalledOnce();
    expect(provider.supportedEras).toEqual(["v9"]);
    expect(provider.getCoinPublicKey()).toBe("coin-public-key");
    expect(provider.getEncryptionPublicKey()).toBe("encryption-public-key");
  });

  it("balances through the facade, signs the recipe, and finalizes a v9 handle", async () => {
    const { ctx, wallet, unshieldedKeystore } = makeWalletContext();
    const provider = await createWalletAndMidnightProvider(ctx);
    const bytes = new Uint8Array([1, 2, 3]);
    const tx = { era: "v9", stage: "Unbound", serialize: () => bytes };
    const ttl = new Date("2026-05-22T00:00:00.000Z");

    const finalized = await provider.balanceTx(tx as never, ttl);

    expect(wallet.adoptTransaction).toHaveBeenCalledWith(bytes, "Unbound");
    expect(wallet.balanceUnboundTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "wallet-handle", stage: "Unbound" }),
      { ttl },
    );
    expect(wallet.signRecipe).toHaveBeenCalledWith(
      { baseTransaction: { kind: "base-tx" } },
      expect.any(Function),
    );
    const signSegment = wallet.signRecipe.mock.calls[0]?.[1] as unknown as (
      data: Uint8Array,
    ) => Promise<unknown>;
    await expect(signSegment(new Uint8Array([7]))).resolves.toEqual({
      kind: "signature",
    });
    expect(unshieldedKeystore.signDataAsync).toHaveBeenCalledWith(
      new Uint8Array([7]),
    );
    expect(wallet.finalizeRecipe).toHaveBeenCalledWith({
      baseTransaction: { kind: "base-tx" },
    });
    expect(ledgerTransactionMock.seal).toHaveBeenCalledWith(
      "v9",
      "Finalized",
      expect.objectContaining({ kind: "finalized-wallet-tx" }),
      "balanceTx",
    );
    expect(finalized).toMatchObject({ era: "v9", stage: "Finalized" });
  });

  it("rejects v8 handles before adopting or signing", async () => {
    const { ctx, wallet, unshieldedKeystore } = makeWalletContext();
    const provider = await createWalletAndMidnightProvider(ctx);
    const v8 = {
      era: "v8",
      stage: "Unbound",
      serialize: () => new Uint8Array([1]),
    };

    await expect(provider.balanceTx(v8 as never)).rejects.toMatchObject({
      code: "MIDNIGHT_JS_PR_PROVIDER_ERA_UNSUPPORTED",
    });
    expect(wallet.adoptTransaction).not.toHaveBeenCalled();
    expect(wallet.balanceUnboundTransaction).not.toHaveBeenCalled();
    expect(unshieldedKeystore.signDataAsync).not.toHaveBeenCalled();
    expect(wallet.finalizeRecipe).not.toHaveBeenCalled();
  });

  it("rejects pre-v9 wallet protocol before signing or submitting", async () => {
    const { ctx, wallet, unshieldedKeystore } = makeWalletContext();
    const provider = await createWalletAndMidnightProvider(ctx);
    Object.defineProperty(wallet.state, "mock", { value: wallet.state.mock });
    const v9 = {
      era: "v9",
      stage: "Finalized",
      serialize: () => new Uint8Array([1]),
    };
    // The provider captured the synced state at construction; use a separate
    // context whose synced state reports an old protocol version.
    const oldCtx = {
      ...ctx,
      wallet: {
        ...wallet,
        state: vi.fn(() =>
          Rx.of({
            isSynced: true,
            activeProtocolVersion: 1_000,
            shielded: {
              coinPublicKey: { toHexString: () => "coin-public-key" },
              encryptionPublicKey: {
                toHexString: () => "encryption-public-key",
              },
            },
          }),
        ),
      },
    } as unknown as MidnightDIDWalletContext;
    const oldProvider = await createWalletAndMidnightProvider(oldCtx);

    await expect(oldProvider.submitTx(v9 as never)).rejects.toMatchObject({
      code: "MIDNIGHT_JS_PR_PROVIDER_ERA_UNSUPPORTED",
    });
    expect(wallet.adoptTransaction).not.toHaveBeenCalled();
    expect(wallet.submitTransaction).not.toHaveBeenCalled();
    expect(unshieldedKeystore.signDataAsync).not.toHaveBeenCalled();
  });

  it("submits a finalized v9 handle through the wallet facade", async () => {
    const { ctx, wallet } = makeWalletContext();
    const provider = await createWalletAndMidnightProvider(ctx);
    const bytes = new Uint8Array([4, 5]);
    const tx = { era: "v9", stage: "Finalized", serialize: () => bytes };

    await expect(provider.submitTx(tx as never)).resolves.toContain(
      "wallet-handle",
    );
    expect(wallet.adoptTransaction).toHaveBeenCalledWith(bytes, "Finalized");
    expect(wallet.submitTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "wallet-handle", stage: "Finalized" }),
    );
  });
});
