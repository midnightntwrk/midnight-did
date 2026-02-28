import type { ImpureCircuitId } from "@midnight-ntwrk/compact-js";
import * as ledger from "@midnight-ntwrk/ledger-v7";
import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import {
  DIDContract,
  type DIDPrivateState,
} from "@midnight-ntwrk/midnight-did-contract";
import type {
  DeployedContract,
  FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import type { UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
export type MidnightDIDPrivateState = DIDPrivateState;

export type MidnightDIDCircuits = ImpureCircuitId<
  DIDContract.Contract<MidnightDIDPrivateState>
>;

export const MidnightDIDPrivateStateId = "midnightDIDPrivateState";

export type MidnightDIDProviders = MidnightProviders<
  MidnightDIDCircuits,
  typeof MidnightDIDPrivateStateId,
  MidnightDIDPrivateState
>;

export type MidnightDIDContract = DIDContract.Contract<MidnightDIDPrivateState>;

export type DeployedMidnightDIDContract =
  | DeployedContract<MidnightDIDContract>
  | FoundContract<MidnightDIDContract>;

export interface MidnightDIDWalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

export const NetworkMapping: Record<string, MidnightNetwork> = {
  undeployed: MidnightNetwork.Undeployed,
  devnet: MidnightNetwork.DevNet,
  testnet: MidnightNetwork.Testnet,
  mainnet: MidnightNetwork.Mainnet,
  preview: MidnightNetwork.Preview,
  preprod: MidnightNetwork.Preprod,
};
