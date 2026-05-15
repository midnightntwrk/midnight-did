import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import type {
  MidnightProvider,
  PrivateStateProvider,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
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

import { signTransactionIntents } from "./transaction-intent-signing";

export const PRIVATE_STATE_PASSWORD_ENV = "MIDNIGHT_DID_PRIVATE_STATE_PASSWORD";
const LOCAL_PRIVATE_STATE_PASSWORD =
  "Midnight-DID-local-private-state-password-2026!";
export const MISSING_PRIVATE_STATE_CONTRACT_ADDRESS_CODE =
  "MIDNIGHT_DID_PRIVATE_STATE_CONTRACT_ADDRESS_NOT_SET";

export class MissingPrivateStateContractAddressError extends Error {
  readonly code = MISSING_PRIVATE_STATE_CONTRACT_ADDRESS_CODE;

  constructor(operation: "get" | "set") {
    super(
      `Private state contract address must be set before ${operation} private state.`,
    );
    this.name = "MissingPrivateStateContractAddressError";
  }
}

export const isMissingPrivateStateContractAddressError = (
  error: unknown,
): error is MissingPrivateStateContractAddressError =>
  error instanceof MissingPrivateStateContractAddressError ||
  (typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === MISSING_PRIVATE_STATE_CONTRACT_ADDRESS_CODE);

export type PrivateStatePasswordOptions = {
  readonly networkId?: string;
  readonly env?: Record<string, string | undefined>;
  readonly onStandaloneFallback?: () => void;
};

export const resolvePrivateStatePassword = ({
  networkId,
  env = process.env,
  onStandaloneFallback,
}: PrivateStatePasswordOptions = {}): string => {
  const configuredPassword = env[PRIVATE_STATE_PASSWORD_ENV];
  if (configuredPassword != null && configuredPassword.length > 0) {
    return configuredPassword;
  }

  const normalizedNetworkId = String(networkId ?? getNetworkId()).toLowerCase();
  if (normalizedNetworkId === "undeployed") {
    onStandaloneFallback?.();
    return LOCAL_PRIVATE_STATE_PASSWORD;
  }

  throw new Error(
    `${PRIVATE_STATE_PASSWORD_ENV} must be set before configuring Midnight DID private state for network ${normalizedNetworkId}.`,
  );
};

export const createPrivateStatePasswordProvider = ({
  emitWarning = process.emitWarning.bind(process),
}: {
  readonly emitWarning?: typeof process.emitWarning;
} = {}): (() => string) => {
  let warnedAboutLocalPrivateStatePassword = false;

  return () =>
    resolvePrivateStatePassword({
      onStandaloneFallback: () => {
        if (warnedAboutLocalPrivateStatePassword) return;
        emitWarning(
          `${PRIVATE_STATE_PASSWORD_ENV} is not set; using the local standalone-only private state password fallback.`,
          {
            code: "MIDNIGHT_DID_PRIVATE_STATE_PASSWORD_MISSING",
          },
        );
        warnedAboutLocalPrivateStatePassword = true;
      },
    });
};

export type MidnightWalletNetworkConfig = {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
};

export interface MidnightWalletContext {
  readonly wallet: WalletFacade;
  readonly shieldedSecretKeys: ledger.ZswapSecretKeys;
  readonly dustSecretKey: ledger.DustSecretKey;
  readonly unshieldedKeystore: UnshieldedKeystore;
}

export const deriveMidnightWalletKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, "hex"));
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

const buildShieldedConfig = ({
  indexer,
  indexerWS,
  node,
  proofServer,
}: MidnightWalletNetworkConfig) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
});

const buildDustConfig = ({
  indexer,
  indexerWS,
  node,
  proofServer,
}: MidnightWalletNetworkConfig) => ({
  networkId: getNetworkId(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
});

export const buildMidnightWalletConfig = (
  config: MidnightWalletNetworkConfig,
) => ({
  ...buildShieldedConfig(config),
  ...buildDustConfig(config),
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

export const createStartedMidnightWalletContext = async (
  config: MidnightWalletNetworkConfig,
  seed: string,
): Promise<MidnightWalletContext> => {
  const keys = deriveMidnightWalletKeysFromSeed(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(
    keys[Roles.NightExternal],
    getNetworkId(),
  );

  const walletConfig = buildMidnightWalletConfig(config);
  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (configuration) =>
      ShieldedWallet(configuration).startWithSecretKeys(
        shieldedSecretKeys as never,
      ),
    unshielded: (configuration) =>
      UnshieldedWallet(configuration).startWithPublicKey(
        PublicKey.fromKeyStore(unshieldedKeystore),
      ),
    dust: (configuration) =>
      DustWallet(configuration).startWithSecretKey(
        dustSecretKey as never,
        ledger.LedgerParameters.initialParameters().dust,
      ),
  });
  await wallet.start(shieldedSecretKeys as never, dustSecretKey as never);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const createWalletAndMidnightProvider = async (
  ctx: MidnightWalletContext,
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
        tx as never,
        {
          shieldedSecretKeys: ctx.shieldedSecretKeys as never,
          dustSecretKey: ctx.dustSecretKey as never,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

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

      return ctx.wallet.finalizeRecipe(recipe) as never;
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx as never) as never;
    },
  };
};

type ObservableValue<T> = T extends Rx.Observable<infer Value> ? Value : never;
type WalletState = ObservableValue<ReturnType<WalletFacade["state"]>>;

export type WaitForWalletSyncOptions = {
  readonly throttleMs?: number;
  readonly onState?: (state: WalletState) => void;
};

export const waitForWalletSync = (
  wallet: WalletFacade,
  { throttleMs = 5_000, onState }: WaitForWalletSyncOptions = {},
) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(throttleMs),
      Rx.tap((state) => onState?.(state)),
      Rx.filter((state) => state.isSynced),
    ),
  );

export type WaitForWalletFundsOptions = WaitForWalletSyncOptions;

export const waitForWalletFunds = (
  wallet: WalletFacade,
  { throttleMs = 10_000, onState }: WaitForWalletFundsOptions = {},
): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(throttleMs),
      Rx.tap((state) => onState?.(state)),
      Rx.filter((state) => state.isSynced),
      Rx.map((state) => state.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

export type CreateMidnightProvidersOptions = {
  readonly walletContext: MidnightWalletContext;
  readonly config: MidnightWalletNetworkConfig;
  readonly zkConfigPath: string;
  readonly privateStateStoreName: string;
  readonly privateStoragePasswordProvider: () => string;
};

export const createContractScopedPrivateStateProvider = <
  PrivateStateId extends string,
  PrivateState,
>(
  provider: PrivateStateProvider<PrivateStateId, PrivateState>,
): PrivateStateProvider<PrivateStateId, PrivateState> => {
  let contractAddressSet = false;

  const assertContractAddressSet = (operation: "get" | "set") => {
    if (contractAddressSet) return;
    throw new MissingPrivateStateContractAddressError(operation);
  };

  return {
    ...provider,
    setContractAddress(address: ContractAddress): void {
      contractAddressSet = true;
      provider.setContractAddress(address);
    },
    async get(privateStateId: PrivateStateId): Promise<PrivateState | null> {
      assertContractAddressSet("get");
      return provider.get(privateStateId);
    },
    async set(
      privateStateId: PrivateStateId,
      state: PrivateState,
    ): Promise<void> {
      assertContractAddressSet("set");
      await provider.set(privateStateId, state);
    },
  };
};

export const createMidnightProviders = async <
  Circuits extends string,
  PrivateStateId extends string,
>({
  walletContext,
  config,
  zkConfigPath,
  privateStateStoreName,
  privateStoragePasswordProvider,
}: CreateMidnightProvidersOptions) => {
  const walletAndMidnightProvider =
    await createWalletAndMidnightProvider(walletContext);
  const zkConfigProvider = new NodeZkConfigProvider<Circuits>(zkConfigPath);
  const privateStateProvider = createContractScopedPrivateStateProvider(
    levelPrivateStateProvider<PrivateStateId>({
      privateStateStoreName,
      privateStoragePasswordProvider,
      accountId: String(walletContext.unshieldedKeystore.getBech32Address()),
    }),
  );

  return {
    privateStateProvider,
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
