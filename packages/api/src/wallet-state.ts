import { type FacadeState } from "@midnight-ntwrk/wallet-sdk-facade";
import { unshieldedToken } from "@midnightntwrk/ledger-v9";
import * as Rx from "rxjs";

import { getLogger } from "./api-logger.js";
import {
  type MidnightDIDWalletContext,
  type MidnightWalletBalances,
  type MidnightWalletFacadeState,
  type MidnightWalletStateSnapshot,
} from "./types.js";

export const serializeWalletState = async (
  ctx: Pick<
    MidnightDIDWalletContext,
    | "wallet"
    | "shieldedWallet"
    | "unshieldedWallet"
    | "dustWallet"
    | "unshieldedHistoryStorage"
  >,
): Promise<MidnightWalletStateSnapshot> => ({
  transactionLifecycleState:
    await ctx.wallet.transactionLifecycleService.serializeState(),
  shieldedState: await ctx.shieldedWallet.serializeState(),
  unshieldedState: await ctx.unshieldedWallet.serializeState(),
  dustState: await ctx.dustWallet.serializeState(),
  unshieldedHistory: JSON.stringify(
    await ctx.unshieldedHistoryStorage.serialize(),
  ),
});

export const waitForWalletSync = async (
  ctx: Pick<MidnightDIDWalletContext, "wallet">,
): Promise<FacadeState> => {
  getLogger().info("Waiting for wallet sync...");
  return await ctx.wallet.waitForSyncedState();
};

export const getWalletBalances = (
  state: MidnightWalletFacadeState,
): MidnightWalletBalances => {
  if (!state.isSynced) {
    return {
      night: null,
      dust: null,
    };
  }

  return {
    night: state.unshielded.balances[unshieldedToken().raw] ?? 0n,
    dust: state.dust.balance(new Date()),
  };
};

export const waitForWalletFunds = async (
  ctx: Pick<MidnightDIDWalletContext, "wallet">,
): Promise<bigint> => {
  getLogger().info("Waiting for funds...");
  const balance = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.map(getWalletBalances),
      Rx.map((balances) => balances.night ?? 0n),
      Rx.filter((currentBalance) => currentBalance > 0n),
    ),
  );
  getLogger().info(`Wallet balance: ${balance}`);
  return balance;
};
