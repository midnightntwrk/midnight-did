import "./polyfills.js";

import { toHex } from "@midnight-ntwrk/midnight-js-utils";

import { type Config } from "./config.js";
import { randomBytes } from "./lightweight.js";
import {
  type MidnightDIDWalletContext,
  type MidnightWalletStateSnapshot,
} from "./types.js";
import { createWalletContext } from "./wallet-context.js";
import { waitForWalletFunds, waitForWalletSync } from "./wallet-state.js";

export { registerForDustGeneration } from "./wallet-dust.js";
export {
  getWalletBalances,
  serializeWalletState,
  waitForWalletFunds,
  waitForWalletSync,
} from "./wallet-state.js";

export const buildWallet = async (
  config: Config,
  seed: string,
  snapshot?: MidnightWalletStateSnapshot,
): Promise<MidnightDIDWalletContext> =>
  await createWalletContext(config, seed, snapshot);

export const restoreWalletFromState = async (
  config: Config,
  seed: string,
  snapshot: MidnightWalletStateSnapshot,
): Promise<MidnightDIDWalletContext> =>
  await createWalletContext(config, seed, snapshot);

export const buildWalletAndWaitForFunds = async (
  config: Config,
  seed: string,
): Promise<MidnightDIDWalletContext> => {
  const walletContext = await buildWallet(config, seed);
  await waitForWalletSync(walletContext);
  await waitForWalletFunds(walletContext);
  return walletContext;
};

export const buildFreshWallet = async (
  config: Config,
): Promise<MidnightDIDWalletContext> =>
  await buildWalletAndWaitForFunds(config, toHex(randomBytes(32)));
