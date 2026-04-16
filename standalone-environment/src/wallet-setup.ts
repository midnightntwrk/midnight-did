import type {
  MidnightDIDProviders,
  MidnightDIDWalletContext,
} from "../../api/src/index.js";
import {
  buildWallet,
  configureProviders,
  registerForDustGeneration,
  setLogger,
  waitForWalletFunds,
  waitForWalletSync,
} from "../../api/src/index.js";
import { GENESIS_MINT_WALLET_SEED, TIMEOUTS } from "./standalone-config.js";
import { withTimeout } from "./docker-utils.js";

/** Suppress API library logs during integration tests. */
export const silenceLogs = (): void => {
  setLogger({
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  } as never);
};

/**
 * Build and fund a wallet from the genesis seed.
 * Returns both the wallet context and configured providers.
 */
export const setupWallet = async (
  config: Record<string, unknown>,
  logPrefix: string,
): Promise<{
  walletCtx: MidnightDIDWalletContext;
  providers: MidnightDIDProviders;
}> => {
  console.info(`[${logPrefix}] building wallet`);
  const walletCtx = await buildWallet(
    config as never,
    GENESIS_MINT_WALLET_SEED,
  );

  console.info(`[${logPrefix}] waiting for wallet sync`);
  await withTimeout(
    waitForWalletSync(walletCtx),
    TIMEOUTS.walletSync,
    "wallet sync",
  );

  console.info(`[${logPrefix}] waiting for wallet funds`);
  await withTimeout(
    waitForWalletFunds(walletCtx),
    TIMEOUTS.walletFunds,
    "wallet funds",
  );

  console.info(`[${logPrefix}] registering dust generation`);
  await withTimeout(
    registerForDustGeneration(
      walletCtx.wallet,
      walletCtx.unshieldedKeystore,
    ),
    TIMEOUTS.dustGeneration,
    "dust generation",
  );

  console.info(`[${logPrefix}] configuring providers`);
  const providers = await configureProviders(walletCtx, config as never);

  return { walletCtx, providers };
};
