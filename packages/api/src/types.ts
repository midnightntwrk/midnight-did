import type { ProvableCircuitId } from "@midnight-ntwrk/compact-js";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import {
  DIDContract,
  type DIDPrivateState,
} from "@midnight-ntwrk/midnight-did-contract";
import type {
  DeployedContract,
  FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import type {
  FacadeState,
  WalletFacade,
} from "@midnight-ntwrk/wallet-sdk-facade";
import type { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import type {
  InMemoryTransactionHistoryStorage,
  UnshieldedKeystore,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";

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

export type MidnightDIDProviders = MidnightProviders<
  MidnightDIDCircuits,
  typeof MidnightDIDPrivateStateId,
  MidnightDIDPrivateState
>;

export type MidnightDIDContract = MidnightDIDProvableContract;

export type DeployedMidnightDIDContract =
  | DeployedContract<MidnightDIDContract>
  | FoundContract<MidnightDIDContract>;

export interface MidnightDIDWalletContext {
  wallet: WalletFacade;
  shieldedWallet: ShieldedWallet;
  unshieldedWallet: UnshieldedWallet;
  dustWallet: DustWallet;
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
 * @deprecated Use `RuntimeToDomain.NetworkMap` or
 * `RUNTIME_TO_DOMAIN_NETWORK_MAP` for runtime-to-domain mappings. This alias
 * remains for compatibility with older API consumers.
 */
export const NetworkMapping: RuntimeToDomainNetworkMap =
  RUNTIME_TO_DOMAIN_NETWORK_MAP;
