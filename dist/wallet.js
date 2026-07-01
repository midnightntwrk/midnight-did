import "./polyfills.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { randomBytes } from "./lightweight.js";
import { createWalletContext } from "./wallet-context.js";
import { waitForWalletFunds, waitForWalletSync } from "./wallet-state.js";
export { registerForDustGeneration } from "./wallet-dust.js";
export { getWalletBalances, serializeWalletState, waitForWalletFunds, waitForWalletSync, } from "./wallet-state.js";
export const buildWallet = async (config, seed, snapshot) => await createWalletContext(config, seed, snapshot);
export const restoreWalletFromState = async (config, seed, snapshot) => await createWalletContext(config, seed, snapshot);
export const buildWalletAndWaitForFunds = async (config, seed) => {
    const walletContext = await buildWallet(config, seed);
    await waitForWalletSync(walletContext);
    await waitForWalletFunds(walletContext);
    return walletContext;
};
export const buildFreshWallet = async (config) => await buildWalletAndWaitForFunds(config, toHex(randomBytes(32)));
//# sourceMappingURL=wallet.js.map