import * as ledger from "@midnight-ntwrk/ledger-v8";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";

import { getLogger } from "./api-logger.js";
import { type Config } from "./config.js";
import {
  type MidnightDIDWalletContext,
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

export const createWalletContext = async (
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
  const shieldedConfig = buildShieldedConfig(config);
  const unshieldedConfig = buildUnshieldedConfig(
    config,
    unshieldedHistoryStorage,
  );
  const dustConfig = buildDustConfig(config);

  const shieldedWallet =
    snapshot?.shieldedState !== undefined
      ? ShieldedWallet(shieldedConfig).restore(snapshot.shieldedState)
      : ShieldedWallet(shieldedConfig).startWithSecretKeys(shieldedSecretKeys);
  const unshieldedWallet =
    snapshot?.unshieldedState !== undefined
      ? UnshieldedWallet(unshieldedConfig).restore(snapshot.unshieldedState)
      : UnshieldedWallet(unshieldedConfig).startWithPublicKey(
          PublicKey.fromKeyStore(unshieldedKeystore),
        );
  const dustWallet =
    snapshot?.dustState !== undefined
      ? DustWallet(dustConfig).restore(snapshot.dustState)
      : DustWallet(dustConfig).startWithSecretKey(
          dustSecretKey,
          ledger.LedgerParameters.initialParameters().dust,
        );

  const wallet = await WalletFacade.init({
    configuration: {
      ...shieldedConfig,
      ...unshieldedConfig,
      ...dustConfig,
    },
    shielded: async () => shieldedWallet,
    unshielded: async () => unshieldedWallet,
    dust: async () => dustWallet,
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);

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
