import {
  type FinalizedTx,
  LedgerTransaction,
  type MidnightProvider,
  ProviderEraUnsupportedError,
  type UnboundTx,
  type WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { ProtocolVersion } from "@midnight-ntwrk/wallet-sdk-abstractions";
import * as Rx from "rxjs";

import { type MidnightDIDWalletContext } from "./types.js";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export const createWalletAndMidnightProvider = async (
  ctx: MidnightDIDWalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  const assertV9 = (
    method: "balanceTx" | "submitTx",
    tx: { readonly era: string },
  ): void => {
    if (tx.era !== "v9") {
      throw new ProviderEraUnsupportedError(method, "v9", ["v9"]);
    }
    if (state.activeProtocolVersion < ProtocolVersion.V9NativeForkVersion) {
      throw new ProviderEraUnsupportedError(method, "v9", ["v9"]);
    }
  };

  return {
    supportedEras: ["v9"],
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx: UnboundTx, ttl?: Date): Promise<FinalizedTx> {
      assertV9("balanceTx", tx);
      const unbound = ctx.wallet.adoptTransaction(tx.serialize(), "Unbound");
      const recipe = await ctx.wallet.balanceUnboundTransaction(unbound, {
        ttl: ttl ?? new Date(Date.now() + DEFAULT_TTL_MS),
      });
      const signed = await ctx.wallet.signRecipe(recipe, (payload) =>
        ctx.unshieldedKeystore.signDataAsync(payload),
      );
      const finalized = await ctx.wallet.finalizeRecipe(signed);
      return LedgerTransaction.seal("v9", "Finalized", finalized, "balanceTx");
    },
    async submitTx(tx: FinalizedTx): Promise<string> {
      assertV9("submitTx", tx);
      const finalized = ctx.wallet.adoptTransaction(
        tx.serialize(),
        "Finalized",
      );
      return ctx.wallet.submitTransaction(finalized);
    },
  };
};
