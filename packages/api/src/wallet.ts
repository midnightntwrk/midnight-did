import * as ledger from "@midnight-ntwrk/ledger-v8";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {
  type MidnightProvider,
  type WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import {
  type FacadeState,
  WalletFacade,
} from "@midnight-ntwrk/wallet-sdk-facade";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  type UnshieldedKeystore,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { Buffer } from "buffer";
import * as Rx from "rxjs";
import { WebSocket } from "ws";

import { getLogger } from "./api-logger.js";
import { type Config, contractConfig } from "./config.js";
import { randomBytes } from "./lightweight.js";
import { parseSeed } from "./seed.js";
import {
  type MidnightDIDCircuits,
  type MidnightDIDWalletContext,
  type MidnightWalletBalances,
  type MidnightWalletFacadeState,
  type MidnightWalletStateSnapshot,
} from "./types.js";

// @ts-expect-error assign for apollo/ws
globalThis.WebSocket = WebSocket;
const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(parseSeed(seed), "hex"));
  if (hdWallet.type !== "seedOk") {
    throw new Error("Failed to initialize HDWallet from seed");
  }
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derivationResult.type !== "keysDerived") {
    throw new Error("Failed to derive keys");
  }
  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

export const deriveUnshieldedAddressFromSeed = (seed: string): string => {
  const keys = deriveKeysFromSeed(seed);
  return createKeystore(keys[Roles.NightExternal], getNetworkId())
    .getBech32Address()
    .toString();
};

// Build wallet configurations
const buildShieldedConfig = ({
  indexer,
  indexerWS,
  node,
  proofServer,
}: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
});

const buildUnshieldedConfig = (
  { indexer, indexerWS }: Config,
  txHistoryStorage: InMemoryTransactionHistoryStorage,
) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  txHistoryStorage,
});

const buildDustConfig = ({
  indexer,
  indexerWS,
  node,
  proofServer,
}: Config) => ({
  networkId: getNetworkId(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
});

// Manual transaction intent signing (SDK bug workaround)
const signTransactionIntents = (
  tx: { intents?: Map<number, { serialize: () => Uint8Array }> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: "proof" | "pre-proof",
): void => {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize(
      "signature",
      proofMarker,
      "pre-binding",
      intent.serialize(),
    );

    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer =
        cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer =
        cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
};
export const createWalletAndMidnightProvider = async (
  ctx: MidnightDIDWalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx as any,
        {
          shieldedSecretKeys: ctx.shieldedSecretKeys as any,
          dustSecretKey: ctx.dustSecretKey as any,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      // Manual intent signing (SDK bug workaround)
      const signFn = (payload: Uint8Array) =>
        ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, "proof");
      if (recipe.balancingTransaction) {
        signTransactionIntents(
          recipe.balancingTransaction,
          signFn,
          "pre-proof",
        );
      }

      return ctx.wallet.finalizeRecipe(recipe) as any;
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx as any) as any;
    },
  };
};

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

  const keys = deriveKeysFromSeed(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(
    keys[Roles.NightExternal],
    getNetworkId(),
  );

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

export const configureProviders = async (
  ctx: MidnightDIDWalletContext,
  config: Config,
) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<MidnightDIDCircuits>(
    contractConfig.zkConfigPath,
  );
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${toHex(
    Buffer.from(ctx.unshieldedKeystore.getSecretKey()),
  )}!A`;

  return {
    privateStateProvider: levelPrivateStateProvider({
      midnightDbName: config.midnightDbName,
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      config.proofServer,
      zkConfigProvider,
    ),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};
