import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as ledger from "@midnight-ntwrk/ledger-v7";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v7";
import {
  type ContractAddress,
  type DIDOperation,
  DomainToLedger,
  LedgerToDomain,
  MidnightDIDDocument,
  MidnightNetwork,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did";
import {
  DIDContract,
  MidnightDIDPrivateState,
  OperationBuilder,
  witnesses,
} from "@midnight-ntwrk/midnight-did-contract";
import { DIDDocumentMetadata } from "@midnight-ntwrk/midnight-did-domain";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {
  type FinalizedTxData,
  type MidnightProvider,
  type UnboundTransaction,
  type WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import {
  assertIsContractAddress,
  toHex,
} from "@midnight-ntwrk/midnight-js-utils";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import {
  generateRandomSeed,
  HDWallet,
  Roles,
} from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  type UnshieldedKeystore,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { Buffer } from "buffer";
import { webcrypto } from "crypto";
import { type Logger } from "pino";
import * as Rx from "rxjs";
import { WebSocket } from "ws";

import { type Config, contractConfig } from "./config";
import { BigIntReplacer } from "./logger-utils";
import { RuntimeToDomain } from "./runtime-to-domain";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDCircuits,
  type MidnightDIDContract,
  MidnightDIDPrivateStateId,
  type MidnightDIDProviders,
  type MidnightDIDWalletContext,
} from "./types";

let logger: Logger;
// @ts-expect-error assign for apollo/ws
globalThis.WebSocket = WebSocket;

// HD key derivation from seed
const deriveKeysFromSeed = (seed: string) => {
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

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
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
  tx: { intents?: Map<number, any> },
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

// Pre-compile contract with assets
const midnightDIDCompiledContract = CompiledContract.make(
  "did",
  DIDContract.Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

export const getMidnightDIDLedgerState = async (
  providers: MidnightDIDProviders,
  contractAddress: ContractAddress,
): Promise<DIDContract.Ledger | null> => {
  assertIsContractAddress(contractAddress);
  logger.info("Checking MidnightDID contract ledger state...");
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((contractState) =>
      contractState != null ? DIDContract.ledger(contractState.data) : null,
    );
  if (state != null || state != undefined)
    logger.info(LedgerToDomain.toJSON(state));
  return state;
};

export const midnightDIDContractInstance: MidnightDIDContract =
  new DIDContract.Contract(witnesses);

export async function hashProverKey(
  proverKey: Uint8Array,
): Promise<Uint8Array> {
  const hash = await webcrypto.subtle.digest("SHA-256", proverKey);
  return new Uint8Array(hash);
}

export async function initPrivateState(
  providers: MidnightDIDProviders,
): Promise<MidnightDIDPrivateState> {
  providers.walletProvider.getCoinPublicKey();
  const providedPrivateState = await providers.privateStateProvider.get(
    "midnightDIDPrivateState",
  );
  logger.info(`Stored private state: ${JSON.stringify(providedPrivateState)}`);
  if (
    providedPrivateState != null &&
    providedPrivateState.secretKey != null &&
    providedPrivateState.secretKey.buffer instanceof ArrayBuffer &&
    providedPrivateState.secretKey.BYTES_PER_ELEMENT === 1 &&
    providedPrivateState.secretKey.length === 32
  ) {
    logger.info("The private state is restored from the privateStateProvider");
    return providedPrivateState;
  }
  logger.info("Creating the new private state..");
  const proverKey = await (providers as any).zkConfigProvider.getProverKey(
    "applyOperations",
  );
  const secretKey = await hashProverKey(proverKey);
  const privateState: MidnightDIDPrivateState = {
    secretKey,
  } as unknown as MidnightDIDPrivateState;
  await providers.privateStateProvider.set(
    MidnightDIDPrivateStateId,
    privateState,
  );
  return privateState;
}

export const joinContract = async (
  providers: MidnightDIDProviders,
  contractAddress: string,
): Promise<DeployedMidnightDIDContract> => {
  const initialPrivateState = await initPrivateState(providers);
  const didContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: midnightDIDCompiledContract,
    privateStateId: "midnightDIDPrivateState",
    initialPrivateState: initialPrivateState,
  });
  logger.info(
    `Joined contract at address: ${didContract.deployTxData.public.contractAddress}`,
  );
  return didContract;
};

export const deploy = async (
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<DeployedMidnightDIDContract> => {
  logger.info("Deploying Midnight DID contract...");
  const didContract = await deployContract(providers, {
    compiledContract: midnightDIDCompiledContract,
    privateStateId: "midnightDIDPrivateState",
    initialPrivateState: privateState,
  });
  logger.info(
    `Deployed contract at address: ${didContract.deployTxData.public.contractAddress}`,
  );
  return didContract;
};

export const createDID = async (
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<DeployedMidnightDIDContract> => {
  logger.info("Creating DID...");
  const didContract = await deploy(providers, privateState);
  logger.info(
    `Created DID at contract address: ${didContract.deployTxData.public.contractAddress}`,
  );
  return didContract;
};

export const update = async (
  didContract: DeployedMidnightDIDContract,
  patches: Array<DIDOperation>,
): Promise<FinalizedTxData> => {
  if (patches.length === 0) throw new Error("No DID operations were provided.");
  logger.info(
    `Updating DID at contract address: ${didContract.deployTxData.public.contractAddress}`,
  );
  let ledgerOperations = DomainToLedger.updateOperations(patches);
  logger.info("Ledger operations:");
  for (const lo of ledgerOperations)
    logger.info(JSON.stringify(lo as unknown, BigIntReplacer, 2));
  let ledgerOperationsWithPadding = OperationBuilder.padding(ledgerOperations);
  const finalizedTxData = await didContract.callTx.applyOperations(
    ledgerOperationsWithPadding,
  );
  logger.info(
    `Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`,
  );
  return finalizedTxData.public;
};

export const midnightNetwork: MidnightNetwork =
  RuntimeToDomain.NetworkMap[getNetworkId()];

export const resolve = async (
  providers: MidnightDIDProviders,
  didContract: DeployedMidnightDIDContract,
): Promise<{
  didDocument: MidnightDIDDocument;
  didDocumentMetadata: DIDDocumentMetadata;
} | null> => {
  const network = RuntimeToDomain.NetworkMap[getNetworkId()];
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const midnightContractAddress = parseContractAddress(contractAddress);
  const didContractState = await getMidnightDIDLedgerState(
    providers,
    midnightContractAddress,
  );
  if (didContractState === null) {
    logger.info(
      `There is no Midnight DID contract deployed at ${contractAddress}.`,
    );
    return null;
  }
  const didDocument = LedgerToDomain.ledgerStateToDIDDocument(
    didContractState,
    network,
    midnightContractAddress,
  );
  const didDocumentMetadata =
    LedgerToDomain.ledgerStateToMetadata(didContractState);
  logger.info(
    `MidnightDID Resolution Result:\n      ${JSON.stringify(
      { didDocument, didDocumentMetadata },
      BigIntReplacer,
      2,
    )}`,
  );
  return { didDocument, didDocumentMetadata };
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

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.tap((state) => {
        logger.info(`Waiting for sync... isSynced=${state.isSynced}`);
      }),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.tap((state) => {
        const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
        logger.info(`Waiting for funds... balance=${balance}`);
      }),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

export const buildWalletAndWaitForFunds = async (
  config: Config,
  seed: string,
): Promise<MidnightDIDWalletContext> => {
  logger.info("Building wallet from seed");

  // Derive HD keys
  const keys = deriveKeysFromSeed(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(
    keys[Roles.NightExternal],
    getNetworkId(),
  );

  // Create three sub-wallets
  const shieldedWallet = ShieldedWallet(
    buildShieldedConfig(config),
  ).startWithSecretKeys(shieldedSecretKeys as any);
  const unshieldedWallet = UnshieldedWallet(
    buildUnshieldedConfig(config),
  ).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
  const dustWallet = DustWallet(buildDustConfig(config)).startWithSecretKey(
    dustSecretKey as any,
    ledger.LedgerParameters.initialParameters().dust,
  );

  // Compose into facade
  const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  await wallet.start(shieldedSecretKeys as any, dustSecretKey as any);

  // Wait for sync
  logger.info("Waiting for wallet sync...");
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

  // Wait for funds
  logger.info("Waiting for funds...");
  const balance = await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );
  logger.info(`Wallet balance: ${balance}`);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
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
    const dustBal = state.dust.walletBalance(new Date());
    logger.info(`Dust already available: ${dustBal}`);
    return;
  }

  // Get unregistered NIGHT UTXOs
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );

  if (nightUtxos.length === 0) {
    logger.info("Waiting for existing dust generation...");
    await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
      ),
    );
    return;
  }

  // Register UTXOs
  logger.info(
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
  logger.info("Waiting for dust generation...");
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
    ),
  );

  logger.info("Dust generation complete");
};

export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  webcrypto.getRandomValues(bytes);
  return bytes;
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

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: contractConfig.privateStateStoreName,
      walletProvider: walletAndMidnightProvider,
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

export function setLogger(_logger: Logger) {
  logger = _logger;
}
