import { webcrypto } from "node:crypto";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as ledger from "@midnight-ntwrk/ledger-v7";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v7";
import {
  type ContractAddress,
  LedgerToDomain,
  MidnightDIDDocument,
  MidnightNetwork,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did";
import {
  DIDContract,
  type DIDPrivateState as MidnightDIDPrivateState,
  witnesses,
} from "@midnight-ntwrk/midnight-did-contract";
import {
  CurveType,
  DIDDocumentMetadata,
  FieldCodec,
  KeyType,
  normalizeServiceEndpoint,
  PublicKeyJwk,
  Service,
  VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
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
  type WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import {
  assertIsContractAddress,
  toHex,
} from "@midnight-ntwrk/midnight-js-utils";
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
import { type Logger } from "pino";
import * as Rx from "rxjs";
import { WebSocket } from "ws";
import { z } from "zod/v4-mini";

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
  const providedPrivateState = await providers.privateStateProvider.get(
    MidnightDIDPrivateStateId,
  );
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
    "addVerificationMethod",
  );
  const secretKey = await hashProverKey(proverKey);
  const privateState: MidnightDIDPrivateState = { secretKey };
  try {
    await providers.privateStateProvider.set(
      MidnightDIDPrivateStateId,
      privateState,
    );
  } catch (error: any) {
    if (
      typeof error?.message === "string" &&
      error.message.includes("Contract address not set")
    ) {
      logger.info("Private state save skipped (contract address not set yet).");
    } else {
      throw error;
    }
  }
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

const normalizeFragmentId = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) return trimmed;
  const hashIndex = trimmed.indexOf("#");
  if (hashIndex >= 0) return `#${trimmed.slice(hashIndex + 1)}`;
  return `#${trimmed}`;
};

const LedgerKeyType = DIDContract.KeyType;
const LedgerCurveType = DIDContract.CurveType;
const LedgerVerificationMethodType = DIDContract.VerificationMethodType;
const LedgerVerificationMethodRelation = DIDContract.VerificationMethodRelation;

const LedgerKeyTypeMap: Record<
  KeyType,
  (typeof LedgerKeyType)[keyof typeof LedgerKeyType]
> = {
  [KeyType.EC]: LedgerKeyType.EC,
  [KeyType.RSA]: LedgerKeyType.RSA,
  [KeyType.oct]: LedgerKeyType.oct,
  [KeyType.OKP]: LedgerKeyType.OKP,
};

const LedgerCurveTypeMap: Record<
  CurveType,
  (typeof LedgerCurveType)[keyof typeof LedgerCurveType]
> = {
  [CurveType.Ed25519]: LedgerCurveType.Ed25519,
  [CurveType.Jubjub]: LedgerCurveType.Jubjub,
};

const LedgerVerificationMethodTypeMap: Record<
  VerificationMethodType,
  (typeof LedgerVerificationMethodType)[keyof typeof LedgerVerificationMethodType]
> = {
  [VerificationMethodType.Undefined]: LedgerVerificationMethodType.Undefined,
  [VerificationMethodType.JsonWebKey]: LedgerVerificationMethodType.JsonWebKey,
};

const LedgerVerificationMethodRelationMap: Record<
  VerificationMethodRelationType,
  (typeof LedgerVerificationMethodRelation)[keyof typeof LedgerVerificationMethodRelation]
> = {
  [VerificationMethodRelationType.Undefined]:
    LedgerVerificationMethodRelation.Undefined,
  [VerificationMethodRelationType.Authentication]:
    LedgerVerificationMethodRelation.Authentication,
  [VerificationMethodRelationType.AssertionMethod]:
    LedgerVerificationMethodRelation.AssertionMethod,
  [VerificationMethodRelationType.KeyAgreement]:
    LedgerVerificationMethodRelation.KeyAgreement,
  [VerificationMethodRelationType.CapabilityInvocation]:
    LedgerVerificationMethodRelation.CapabilityInvocation,
  [VerificationMethodRelationType.CapabilityDelegation]:
    LedgerVerificationMethodRelation.CapabilityDelegation,
};

const publicKeyJwkToLedger = (
  publicKeyJwk: PublicKeyJwk,
): DIDContract.PublicKeyJwk => {
  const kty = LedgerKeyTypeMap[publicKeyJwk.kty];
  const crv = LedgerCurveTypeMap[publicKeyJwk.crv];
  const x = z.decode(FieldCodec as any, publicKeyJwk.x) as bigint;
  const y =
    publicKeyJwk.y !== undefined
      ? (z.decode(FieldCodec as any, publicKeyJwk.y) as bigint)
      : 0n;

  return { kty, crv, x, y };
};

const verificationMethodToLedger = (
  method: VerificationMethod,
): DIDContract.VerificationMethod => ({
  id: normalizeFragmentId(method.id),
  typ: LedgerVerificationMethodTypeMap[method.type],
  publicKeyJwk: publicKeyJwkToLedger(method.publicKeyJwk),
});

const serviceTypeToLedger = (serviceType: string | string[]): string => {
  if (typeof serviceType === "string") return serviceType;
  if (Array.isArray(serviceType) && serviceType.length === 1)
    return serviceType[0];
  throw new Error(
    "service type property must be a string or an array with exactly one element",
  );
};

const serviceEndpointToLedger = (
  serviceEndpoint: Service["serviceEndpoint"],
): string => {
  try {
    const normalized = normalizeServiceEndpoint(serviceEndpoint);
    return JSON.stringify(normalized);
  } catch {
    throw new Error("Invalid serviceEndpoint: could not serialize to JSON");
  }
};

const serviceToLedger = (service: Service): DIDContract.Service => ({
  id: normalizeFragmentId(service.id),
  typ: serviceTypeToLedger(service.type),
  serviceEndpoint: serviceEndpointToLedger(service.serviceEndpoint),
});

export const addVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.addVerificationMethod(
    verificationMethodToLedger(verificationMethod),
  );
  return result.public;
};

export const updateVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.updateVerificationMethod(
    verificationMethodToLedger(verificationMethod),
  );
  return result.public;
};

export const removeVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  methodId: string,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeFragmentId(methodId);
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const didState = await getMidnightDIDLedgerState(providers, contractAddress);

  if (!didState) {
    throw new Error("Cannot query DID state");
  }

  const relationsToCheck: Array<{
    relation: VerificationMethodRelationType;
    member: boolean;
  }> = [
    {
      relation: VerificationMethodRelationType.Authentication,
      member: didState.authenticationRelation.member(normalizedMethodId),
    },
    {
      relation: VerificationMethodRelationType.AssertionMethod,
      member: didState.assertionMethodRelation.member(normalizedMethodId),
    },
    {
      relation: VerificationMethodRelationType.KeyAgreement,
      member: didState.keyAgreementRelation.member(normalizedMethodId),
    },
    {
      relation: VerificationMethodRelationType.CapabilityInvocation,
      member: didState.capabilityInvocationRelation.member(normalizedMethodId),
    },
    {
      relation: VerificationMethodRelationType.CapabilityDelegation,
      member: didState.capabilityDelegationRelation.member(normalizedMethodId),
    },
  ];

  for (const { relation, member } of relationsToCheck) {
    if (!member) continue;
    await didContract.callTx.removeVerificationMethodRelation(
      LedgerVerificationMethodRelationMap[relation],
      normalizedMethodId,
    );
  }

  const result =
    await didContract.callTx.removeVerificationMethod(normalizedMethodId);
  return result.public;
};

export const addVerificationMethodRelation = async (
  didContract: DeployedMidnightDIDContract,
  relation: VerificationMethodRelationType,
  methodId: string,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.addVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizeFragmentId(methodId),
  );
  return result.public;
};

export const removeVerificationMethodRelation = async (
  didContract: DeployedMidnightDIDContract,
  relation: VerificationMethodRelationType,
  methodId: string,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.removeVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizeFragmentId(methodId),
  );
  return result.public;
};

export const addService = async (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.addService(serviceToLedger(service));
  return result.public;
};

export const updateService = async (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.updateService(
    serviceToLedger(service),
  );
  return result.public;
};

export const removeService = async (
  didContract: DeployedMidnightDIDContract,
  serviceId: string,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.removeService(
    normalizeFragmentId(serviceId),
  );
  return result.public;
};

export const addAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.addAlsoKnownAs(aliasUri);
  return result.public;
};

export const removeAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.removeAlsoKnownAs(aliasUri);
  return result.public;
};

export const deactivate = async (
  didContract: DeployedMidnightDIDContract,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.deactivate();
  return result.public;
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
