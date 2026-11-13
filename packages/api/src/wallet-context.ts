import {
  InMemoryTransactionHistoryStorage,
  ProtocolVersion,
} from "@midnight-ntwrk/wallet-sdk-abstractions";
import { TransactionLifecycleServiceImpl } from "@midnight-ntwrk/wallet-sdk-capabilities/transactionLifecycle";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import {
  lifecycleTransactionTraits,
  mergeWalletEntries,
  type WalletEntry,
  WalletEntrySchema,
  WalletFacade,
} from "@midnight-ntwrk/wallet-sdk-facade";
import { WalletSeeds } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  PublicKey,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import * as ledger from "@midnightntwrk/ledger-v9";
import type { Schema } from "effect";

import { getLogger } from "./api-logger.js";
import { type Config } from "./config.js";
import { getCurrentNetworkId } from "./network-context.js";
import { parseSeed } from "./seed.js";
import {
  type MidnightDIDWalletContext,
  type MidnightWalletStateSnapshot,
} from "./types.js";
import {
  createUnshieldedKeystoreFromKeys,
  deriveMidnightWalletKeys,
} from "./wallet-keys.js";

type WalletEntryEncoded = Schema.Schema.Encoded<typeof WalletEntrySchema>;

const makeSharedHistory = (
  snapshot?: MidnightWalletStateSnapshot,
): InMemoryTransactionHistoryStorage<WalletEntry, WalletEntryEncoded> =>
  snapshot?.unshieldedHistory !== undefined
    ? InMemoryTransactionHistoryStorage.restore<
        WalletEntry,
        WalletEntryEncoded
      >(
        JSON.parse(snapshot.unshieldedHistory),
        WalletEntrySchema,
        mergeWalletEntries,
      )
    : new InMemoryTransactionHistoryStorage<WalletEntry, WalletEntryEncoded>(
        WalletEntrySchema,
        mergeWalletEntries,
      );

export const createWalletContext = async (
  config: Config,
  seed: string,
  snapshot?: MidnightWalletStateSnapshot,
): Promise<MidnightDIDWalletContext> => {
  // Legacy component/history backups cannot reconstruct outstanding lifecycle records.
  // Reject before derivation or initialization, even if the backup appears settled.
  const lifecycleState = snapshot?.transactionLifecycleState;
  if (
    snapshot !== undefined &&
    (typeof lifecycleState !== "string" || lifecycleState.trim().length === 0)
  ) {
    throw new Error(
      "Incomplete/incompatible legacy wallet snapshot: nonempty transactionLifecycleState is required",
    );
  }
  getLogger().info(
    snapshot
      ? "Restoring wallet from serialized state"
      : "Building wallet from seed",
  );

  // Snapshot all process configuration before the first await. A profile change
  // while components initialize must not mix networks in one context.
  const networkId = getCurrentNetworkId();
  const seedBytes = Buffer.from(parseSeed(seed), "hex");
  const seeds = WalletSeeds.fromMasterSeed(seedBytes);
  const keys = deriveMidnightWalletKeys(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(seeds.dust);
  const unshieldedKeystore = createUnshieldedKeystoreFromKeys(keys, networkId);
  const sharedHistoryStorage = makeSharedHistory(snapshot);

  const facadeConfig = {
    networkId,
    forks: ProtocolVersion.V9NativeForkSchedule,
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node.replace(/^http/, "ws")),
    txHistoryStorage: sharedHistoryStorage,
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  };

  let shieldedWallet!: MidnightDIDWalletContext["shieldedWallet"];
  let unshieldedWallet!: MidnightDIDWalletContext["unshieldedWallet"];
  let dustWallet!: MidnightDIDWalletContext["dustWallet"];

  const wallet = await WalletFacade.init({
    configuration: facadeConfig,
    ...(lifecycleState !== undefined
      ? {
          transactionLifecycleService: (resolved, { clock }) =>
            TransactionLifecycleServiceImpl.restore(
              lifecycleState,
              lifecycleTransactionTraits(resolved.forks.v9),
              resolved,
              clock,
            ),
        }
      : {}),
    shielded: async (resolved) => {
      shieldedWallet =
        snapshot?.shieldedState !== undefined
          ? ShieldedWallet(resolved).restore(snapshot.shieldedState)
          : await ShieldedWallet(resolved).startWithSeed(seeds.shielded);
      return shieldedWallet;
    },
    unshielded: async (resolved) => {
      unshieldedWallet =
        snapshot?.unshieldedState !== undefined
          ? UnshieldedWallet(resolved).restore(snapshot.unshieldedState)
          : await UnshieldedWallet(resolved).startWithPublicKey(
              PublicKey.fromKeyStore(unshieldedKeystore),
            );
      return unshieldedWallet;
    },
    dust: async (resolved) => {
      dustWallet =
        snapshot?.dustState !== undefined
          ? DustWallet(resolved).restore(snapshot.dustState)
          : await DustWallet(resolved).startWithSeed(seeds.dust);
      return dustWallet;
    },
  });
  await wallet.start(seeds);

  return {
    networkId,
    wallet,
    shieldedWallet,
    unshieldedWallet,
    dustWallet,
    unshieldedHistoryStorage: sharedHistoryStorage,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore,
  };
};
