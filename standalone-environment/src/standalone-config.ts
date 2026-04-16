import path from "node:path";

/**
 * Default timeout constants for standalone environment operations.
 */
export const TIMEOUTS = {
  walletSync: 180_000,
  walletFunds: 180_000,
  dustGeneration: 300_000,
  dockerStartup: 180_000,
  didCreationRetryDelay: 8_000,
  didCreationRetries: 3,
} as const;

/**
 * The genesis mint wallet seed used in the dev network.
 */
export const GENESIS_MINT_WALLET_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

/**
 * Resolve a unique temporary path for integration test state.
 */
export const integrationPath = (
  repoRoot: string,
  category: string,
  suffix: string,
): string => path.resolve(repoRoot, ".midnight-test", category, suffix);
