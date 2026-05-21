import "./polyfills.js";

import * as ledger from "@midnight-ntwrk/ledger-v8";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import {
  type FacadeState,
  WalletFacade,
} from "@midnight-ntwrk/wallet-sdk-facade";
import { Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  InMemoryTransactionHistoryStorage,
  PublicKey,
  type UnshieldedKeystore,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import * as Rx from "rxjs";

import { getLogger } from "./api-logger.js";
import { type Config } from "./config.js";
import { randomBytes } from "./lightweight.js";
import {
  type MidnightDIDWalletContext,
  type MidnightWalletBalances,
  type MidnightWalletFacadeState,
  type MidnightWalletStateSnapshot,
} from "./types.js";
import {
  createUnshieldedKeystoreFromKeys,
  deriveMidnightWalletKeys,
} from "./wallet-keys.js";
import {
  buildDustConfig,
  buildShieldedConfig,
  buildUnshieldedConfig,
} from "./wallet-sdk-config.js";

const createWalletContext = async (
  config: Config,
  seed: string,
  snapshot?: MidnightWalletStateSnapshot,
): Promise<MidnightDIDWalletContext> => {
  getLogger().info(
    snapshot
      ? "Restoring wallet from serialized state"
      : "Building wallet from seed",
  );

  const keys = deriveMidnightWalletKeys(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createUnshieldedKeystoreFromKeys(keys);

  const unshieldedHistoryStorage =
    snapshot?.unshieldedHistory !== undefined
      ? InMemoryTransactionHistoryStorage.fromSerialized(
          snapshot.unshieldedHistory,
        )
      : new InMemoryTransactionHistoryStorage();

  const shieldedWallet =
    snapshot?.shieldedState !== undefined
      ? ShieldedWallet(buildShieldedConfig(config)).restore(
          snapshot.shieldedState,
        )
      : ShieldedWallet(buildShieldedConfig(config)).startWithSecretKeys(
          shieldedSecretKeys as any,
        );
  const unshieldedWallet =
    snapshot?.unshieldedState !== undefined
      ? UnshieldedWallet(
          buildUnshieldedConfig(config, unshieldedHistoryStorage),
        ).restore(snapshot.unshieldedState)
      : UnshieldedWallet(
          buildUnshieldedConfig(config, unshieldedHistoryStorage),
        ).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
  const dustWallet =
    snapshot?.dustState !== undefined
      ? DustWallet(buildDustConfig(config)).restore(snapshot.dustState)
      : DustWallet(buildDustConfig(config)).startWithSecretKey(
          dustSecretKey as any,
          ledger.LedgerParameters.initialParameters().dust,
        );

  const wallet = await WalletFacade.init({
    configuration: {
      ...buildShieldedConfig(config),
      ...buildUnshieldedConfig(config, unshieldedHistoryStorage),
      ...buildDustConfig(config),
    },
    shielded: async () => shieldedWallet,
    unshielded: async () => unshieldedWallet,
    dust: async () => dustWallet,
  });
  await wallet.start(shieldedSecretKeys as any, dustSecretKey as any);

  return {
    wallet,
    shieldedWallet,
    unshieldedWallet,
    dustWallet,
    unshieldedHistoryStorage,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore,
  };
};

export const serializeWalletState = async (
  ctx: MidnightDIDWalletContext,
): Promise<MidnightWalletStateSnapshot> => ({
  shieldedState: await ctx.shieldedWallet.serializeState(),
  unshieldedState: await ctx.unshieldedWallet.serializeState(),
  dustState: await ctx.dustWallet.serializeState(),
  unshieldedHistory: ctx.unshieldedHistoryStorage.serialize(),
});

export const waitForWalletSync = async (
  ctx: MidnightDIDWalletContext,
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
  ctx: MidnightDIDWalletContext,
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

export const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  // Check if dust already available
  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    getLogger().info(`Dust already available: ${dustBal}`);
    return;
  }

  // Get unregistered NIGHT UTXOs
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );

  if (nightUtxos.length === 0) {
    getLogger().info("Waiting for existing dust generation...");
    await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    );
    return;
  }

  // Register UTXOs
  getLogger().info(
    `Registering ${nightUtxos.length} NIGHT UTXOs for dust generation`,
  );
  const recipe = await wallet.registerNightUtxosForDustGeneration(
    nightUtxos,
    unshieldedKeystore.getPublicKey(),
    (payload) => unshieldedKeystore.signData(payload),
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized as any);

  // Wait for dust to generate
  getLogger().info("Waiting for dust generation...");
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.dust.balance(new Date()) > 0n),
    ),
  );

  getLogger().info("Dust generation complete");
};

export const buildFreshWallet = async (
  config: Config,
): Promise<MidnightDIDWalletContext> =>
  await buildWalletAndWaitForFunds(config, toHex(randomBytes(32)));
