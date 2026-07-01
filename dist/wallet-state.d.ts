import { type FacadeState } from "@midnight-ntwrk/wallet-sdk-facade";
import { type MidnightDIDWalletContext, type MidnightWalletBalances, type MidnightWalletFacadeState, type MidnightWalletStateSnapshot } from "./types.js";
export declare const serializeWalletState: (ctx: Pick<MidnightDIDWalletContext, "shieldedWallet" | "unshieldedWallet" | "dustWallet" | "unshieldedHistoryStorage">) => Promise<MidnightWalletStateSnapshot>;
export declare const waitForWalletSync: (ctx: Pick<MidnightDIDWalletContext, "wallet">) => Promise<FacadeState>;
export declare const getWalletBalances: (state: MidnightWalletFacadeState) => MidnightWalletBalances;
export declare const waitForWalletFunds: (ctx: Pick<MidnightDIDWalletContext, "wallet">) => Promise<bigint>;
