import { webcrypto } from "node:crypto";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import {
  type ContractAddress,
  createMidnightDIDString,
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
  assertAbsoluteUri,
  type BoundIdField,
  CurveType,
  decodeFieldElement,
  DIDDocumentMetadata,
  KeyType,
  normalizeBoundFragmentId as normalizeBoundFragmentIdWithSubject,
  PublicKeyJwk,
  Service,
  serviceEndpointToLedger as serviceEndpointToLedgerValue,
  serviceTypeToLedger as serviceTypeToLedgerValue,
  VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";
import {
  assertIsContractAddress,
  toHex,
} from "@midnight-ntwrk/midnight-js-utils";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { type UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { type Logger } from "pino";
import * as Rx from "rxjs";
import { WebSocket } from "ws";

import { type Config, contractConfig } from "./config";
import { BigIntReplacer } from "./logger-utils";
import {
  createMidnightProviders,
  createPrivateStatePasswordProvider,
  createStartedMidnightWalletContext,
  isMissingPrivateStateContractAddressError,
  waitForWalletFunds,
  waitForWalletSync,
} from "./midnight-provider-utils";
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

export {
  PRIVATE_STATE_PASSWORD_ENV,
  resolvePrivateStatePassword,
} from "./midnight-provider-utils";

const getPrivateStatePassword = createPrivateStatePasswordProvider();

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
  if (state != null) logger.info(LedgerToDomain.toJSON(state));
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

type ContractScopedPrivateStateProvider =
  MidnightDIDProviders["privateStateProvider"] & {
    setContractAddress?: (address: ContractAddress) => void;
  };

const setPrivateStateContractAddress = (
  providers: MidnightDIDProviders,
  contractAddress: ContractAddress,
): void => {
  const provider =
    providers.privateStateProvider as ContractScopedPrivateStateProvider;
  provider.setContractAddress?.(contractAddress);
};

export async function initPrivateState(
  providers: MidnightDIDProviders,
): Promise<MidnightDIDPrivateState> {
  type ProvidersWithProverKey = MidnightDIDProviders & {
    zkConfigProvider: {
      getProverKey: (circuitName: string) => Promise<Uint8Array>;
    };
  };
  let providedPrivateState: MidnightDIDPrivateState | null = null;
  try {
    providedPrivateState = await providers.privateStateProvider.get(
      MidnightDIDPrivateStateId,
    );
  } catch (error: unknown) {
    if (isMissingPrivateStateContractAddressError(error)) {
      logger.info(
        "Private state restore skipped (contract address not set yet).",
      );
    } else {
      throw error;
    }
  }
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
  const proverKey = await (
    providers as ProvidersWithProverKey
  ).zkConfigProvider.getProverKey("addVerificationMethod");
  const secretKey = await hashProverKey(proverKey);
  const privateState: MidnightDIDPrivateState = { secretKey };
  try {
    await providers.privateStateProvider.set(
      MidnightDIDPrivateStateId,
      privateState,
    );
  } catch (error: unknown) {
    if (isMissingPrivateStateContractAddressError(error)) {
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
  assertIsContractAddress(contractAddress);
  setPrivateStateContractAddress(providers, contractAddress);
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

const getDidSubject = (didContract: DeployedMidnightDIDContract): string => {
  const network = RuntimeToDomain.NetworkMap[getNetworkId()];
  const contractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  return createMidnightDIDString(contractAddress, network);
};

const normalizeBoundFragmentId = (
  didContract: DeployedMidnightDIDContract,
  value: string,
  field: BoundIdField,
): string =>
  normalizeBoundFragmentIdWithSubject(value, field, getDidSubject(didContract));

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
  [CurveType.P256]: LedgerCurveType.P256,
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
  const x = decodeFieldElement(publicKeyJwk.x);
  const y =
    publicKeyJwk.y !== undefined ? decodeFieldElement(publicKeyJwk.y) : 0n;

  return { kty, crv, x, y };
};

const assertMidnightKeyProfile = (publicKeyJwk: PublicKeyJwk): void => {
  if (publicKeyJwk.kty === KeyType.OKP) {
    if (publicKeyJwk.crv !== CurveType.Ed25519) {
      throw new Error("OKP keys must use Ed25519");
    }
    return;
  }
  if (publicKeyJwk.kty === KeyType.EC) {
    if (
      publicKeyJwk.crv !== CurveType.Jubjub &&
      publicKeyJwk.crv !== CurveType.P256
    ) {
      throw new Error("EC keys must use Jubjub or P-256");
    }
    return;
  }
  throw new Error(
    "Only OKP (Ed25519) and EC (Jubjub/P-256) keys are supported",
  );
};

const verificationMethodToLedger = (
  didContract: DeployedMidnightDIDContract,
  method: VerificationMethod,
): DIDContract.VerificationMethod => {
  if (method.type !== VerificationMethodType.JsonWebKey) {
    throw new Error("verificationMethod.type must be JsonWebKey");
  }
  assertMidnightKeyProfile(method.publicKeyJwk);
  const didSubject = getDidSubject(didContract);
  if (method.controller !== didSubject) {
    throw new Error(
      `verificationMethod.controller must equal DID subject (${didSubject})`,
    );
  }
  return {
    id: normalizeBoundFragmentId(
      didContract,
      method.id,
      "verificationMethod.id",
    ),
    typ: LedgerVerificationMethodTypeMap[method.type],
    publicKeyJwk: publicKeyJwkToLedger(method.publicKeyJwk),
  };
};

const serviceToLedger = (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): DIDContract.Service => {
  let endpoint: string;
  try {
    endpoint = serviceEndpointToLedgerValue(service.serviceEndpoint);
  } catch {
    throw new Error("Invalid serviceEndpoint: could not serialize to JSON");
  }

  return {
    id: normalizeBoundFragmentId(didContract, service.id, "service.id"),
    typ: serviceTypeToLedgerValue(service.type),
    serviceEndpoint: endpoint,
  };
};

const relationSetFromState = (
  didState: DIDContract.Ledger,
  relation: VerificationMethodRelationType,
) => {
  switch (relation) {
    case VerificationMethodRelationType.Authentication:
      return didState.authenticationRelation;
    case VerificationMethodRelationType.AssertionMethod:
      return didState.assertionMethodRelation;
    case VerificationMethodRelationType.KeyAgreement:
      return didState.keyAgreementRelation;
    case VerificationMethodRelationType.CapabilityInvocation:
      return didState.capabilityInvocationRelation;
    case VerificationMethodRelationType.CapabilityDelegation:
      return didState.capabilityDelegationRelation;
    case VerificationMethodRelationType.Undefined:
      throw new Error("relation must be defined");
  }
};

export const addVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.addVerificationMethod(
    verificationMethodToLedger(didContract, verificationMethod),
  );
  return result.public;
};

export const updateVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  verificationMethod: VerificationMethod,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.updateVerificationMethod(
    verificationMethodToLedger(didContract, verificationMethod),
  );
  return result.public;
};

export const removeVerificationMethod = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  methodId: string,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
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
  providers: MidnightDIDProviders,
  relation: VerificationMethodRelationType,
  methodId: string,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const didState = await getMidnightDIDLedgerState(providers, contractAddress);
  if (!didState) {
    throw new Error("Cannot query DID state");
  }
  const relationSet = relationSetFromState(didState, relation);
  if (relationSet.member(normalizedMethodId)) {
    throw new Error(
      `relation ${relation} already contains verification method ${normalizedMethodId}`,
    );
  }
  const result = await didContract.callTx.addVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizedMethodId,
  );
  return result.public;
};

export const removeVerificationMethodRelation = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  relation: VerificationMethodRelationType,
  methodId: string,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeBoundFragmentId(
    didContract,
    methodId,
    "methodId",
  );
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const didState = await getMidnightDIDLedgerState(providers, contractAddress);
  if (!didState) {
    throw new Error("Cannot query DID state");
  }
  const relationSet = relationSetFromState(didState, relation);
  if (!relationSet.member(normalizedMethodId)) {
    throw new Error(
      `relation ${relation} does not contain verification method ${normalizedMethodId}`,
    );
  }
  const result = await didContract.callTx.removeVerificationMethodRelation(
    LedgerVerificationMethodRelationMap[relation],
    normalizedMethodId,
  );
  return result.public;
};

export const addService = async (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.addService(
    serviceToLedger(didContract, service),
  );
  return result.public;
};

export const updateService = async (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.updateService(
    serviceToLedger(didContract, service),
  );
  return result.public;
};

export const removeService = async (
  didContract: DeployedMidnightDIDContract,
  serviceId: string,
): Promise<FinalizedTxData> => {
  const normalizedServiceId = normalizeBoundFragmentId(
    didContract,
    serviceId,
    "serviceId",
  );
  const result = await didContract.callTx.removeService(normalizedServiceId);
  return result.public;
};

export const addAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const alias = assertAbsoluteUri(aliasUri, "aliasUri");
  const result = await didContract.callTx.addAlsoKnownAs(alias);
  return result.public;
};

export const removeAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const alias = assertAbsoluteUri(aliasUri, "aliasUri");
  const result = await didContract.callTx.removeAlsoKnownAs(alias);
  return result.public;
};

export const deactivate = async (
  didContract: DeployedMidnightDIDContract,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.deactivate();
  return result.public;
};

const currentMidnightNetwork = (): MidnightNetwork =>
  RuntimeToDomain.NetworkMap[getNetworkId()];

export const getMidnightNetwork = currentMidnightNetwork;

export const midnightNetwork = {
  toLowerCase: () => currentMidnightNetwork().toLowerCase(),
  toString: () => currentMidnightNetwork().toString(),
  valueOf: () => currentMidnightNetwork(),
  [Symbol.toPrimitive]: () => currentMidnightNetwork(),
} as unknown as MidnightNetwork;

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

export const waitForSync = (wallet: WalletFacade) =>
  waitForWalletSync(wallet, {
    onState: (state) => {
      logger.info(`Waiting for sync... isSynced=${state.isSynced}`);
    },
  });

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  waitForWalletFunds(wallet, {
    onState: (state) => {
      const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
      logger.info(`Waiting for funds... balance=${balance}`);
    },
  });

export const buildWalletAndWaitForFunds = async (
  config: Config,
  seed: string,
): Promise<MidnightDIDWalletContext> => {
  logger.info("Building wallet from seed");
  const walletContext = await createStartedMidnightWalletContext(config, seed);

  // Wait for sync
  logger.info("Waiting for wallet sync...");
  await waitForSync(walletContext.wallet);

  // Wait for funds
  logger.info("Waiting for funds...");
  const balance = await waitForFunds(walletContext.wallet);
  logger.info(`Wallet balance: ${balance}`);

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
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
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
      Rx.filter((s) => s.dust.balance(new Date()) > 0n),
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
  return createMidnightProviders<
    MidnightDIDCircuits,
    typeof MidnightDIDPrivateStateId
  >({
    walletContext: ctx,
    config,
    zkConfigPath: contractConfig.zkConfigPath,
    privateStateStoreName: contractConfig.privateStateStoreName,
    privateStoragePasswordProvider: getPrivateStatePassword,
  });
};

export function setLogger(_logger: Logger) {
  logger = _logger;
}
