import "./polyfills.js";
import { type Config } from "./config.js";
import { type MidnightDIDWalletContext, type MidnightWalletStateSnapshot } from "./types.js";
export { registerForDustGeneration } from "./wallet-dust.js";
export { getWalletBalances, serializeWalletState, waitForWalletFunds, waitForWalletSync, } from "./wallet-state.js";
export declare const buildWallet: (config: Config, seed: string, snapshot?: MidnightWalletStateSnapshot) => Promise<MidnightDIDWalletContext>;
export declare const restoreWalletFromState: (config: Config, seed: string, snapshot: MidnightWalletStateSnapshot) => Promise<MidnightDIDWalletContext>;
export declare const buildWalletAndWaitForFunds: (config: Config, seed: string) => Promise<MidnightDIDWalletContext>;
export declare const buildFreshWallet: (config: Config) => Promise<MidnightDIDWalletContext>;
