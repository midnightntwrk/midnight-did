import type { ProvableCircuitId } from "@midnight-ntwrk/compact-js";
import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";
import {
  DIDContract,
  type DIDPrivateState,
} from "@midnight-ntwrk/midnight-did-contract";
import type {
  DeployedContract,
  FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type {
  MidnightProviders,
  NetworkId,
} from "@midnight-ntwrk/midnight-js-types";
import type { InMemoryTransactionHistoryStorage } from "@midnight-ntwrk/wallet-sdk-abstractions";
import type {
  DustKeysByEpoch,
  DustWalletAPI,
} from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import type {
  FacadeState,
  WalletFacade,
} from "@midnight-ntwrk/wallet-sdk-facade";
import type {
  ShieldedKeysByEpoch,
  ShieldedWalletAPI,
} from "@midnight-ntwrk/wallet-sdk-shielded";
import type {
  UnshieldedKeystore,
  UnshieldedWalletAPI,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import * as ledger from "@midnightntwrk/ledger-v9";

import {
  RUNTIME_TO_DOMAIN_NETWORK_MAP,
  type RuntimeToDomainNetworkMap,
} from "./network-mapping.js";

export type MidnightDIDPrivateState = DIDPrivateState;

type MidnightDIDProvableContract =
  DIDContract.Contract<MidnightDIDPrivateState> & {
    provableCircuits: DIDContract.ImpureCircuits<MidnightDIDPrivateState>;
  };

export type MidnightDIDCircuits =
  ProvableCircuitId<MidnightDIDProvableContract>;

export const MidnightDIDPrivateStateId = "midnightDIDPrivateState";
export const MidnightDIDPendingControllerPrivateStateId =
  "midnightDIDPendingControllerPrivateState";
export type MidnightDIDPrivateStateIds =
  | typeof MidnightDIDPrivateStateId
  | typeof MidnightDIDPendingControllerPrivateStateId;

/**
 * DID providers must expose a contract-address-aware private state provider.
 * Callers should bind it to the DID contract address before restoring,
 * requiring, saving, or recovering private state.
 */
export type MidnightDIDProviders = MidnightProviders<
  MidnightDIDCircuits,
  MidnightDIDPrivateStateIds,
  MidnightDIDPrivateState
>;

export type MidnightDIDContract = MidnightDIDProvableContract;

export type DeployedMidnightDIDContract =
  DeployedContract<MidnightDIDContract> | FoundContract<MidnightDIDContract>;

export interface SchnorrJubjubVerificationMethod {
  readonly id: string;
  readonly publicKey: JubjubPoint;
}

export type SchnorrJubjubDigest = [bigint, bigint, bigint, bigint];
export type SchnorrJubjubSignature = DIDContract.Schnorr_SchnorrSignature;

export interface MidnightDIDWalletContext {
  /** Network captured when the wallet context was created. */
  readonly networkId: NetworkId;
  wallet: WalletFacade;
  shieldedWallet: ShieldedWalletAPI<ShieldedKeysByEpoch>;
  unshieldedWallet: UnshieldedWalletAPI;
  dustWallet: DustWalletAPI<DustKeysByEpoch>;
  unshieldedHistoryStorage: InMemoryTransactionHistoryStorage;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

export interface MidnightWalletStateSnapshot {
  shieldedState: string;
  unshieldedState: string;
  dustState: string;
  unshieldedHistory?: string;
}

export interface MidnightWalletBalances {
  night: bigint | null;
  dust: bigint | null;
}

export type MidnightWalletFacadeState = FacadeState;

/**
 * @deprecated Use `RuntimeToDomain.NetworkMap` for runtime-to-domain mappings.
 * This alias remains for compatibility with older API consumers.
 */
export const NetworkMapping: RuntimeToDomainNetworkMap =
  RUNTIME_TO_DOMAIN_NETWORK_MAP;
