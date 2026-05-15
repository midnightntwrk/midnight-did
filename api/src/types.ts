import type { ProvableCircuitId } from "@midnight-ntwrk/compact-js";
import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import {
  DIDContract,
  type DIDPrivateState,
} from "@midnight-ntwrk/midnight-did-contract";
import type {
  DeployedContract,
  FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";

import type { MidnightWalletContext } from "./midnight-provider-utils";

export type MidnightDIDPrivateState = DIDPrivateState;

export type MidnightDIDContract = DIDContract.Contract<MidnightDIDPrivateState>;

export type MidnightDIDCircuits = ProvableCircuitId<MidnightDIDContract>;

export const MidnightDIDPrivateStateId = "midnightDIDPrivateState";

export type MidnightDIDProviders = MidnightProviders<
  MidnightDIDCircuits,
  typeof MidnightDIDPrivateStateId,
  MidnightDIDPrivateState
>;

export type DeployedMidnightDIDContract =
  | DeployedContract<MidnightDIDContract>
  | FoundContract<MidnightDIDContract>;

export type MidnightDIDWalletContext = MidnightWalletContext;

export const NetworkMapping: Record<NetworkId, MidnightNetwork> = {
  undeployed: MidnightNetwork.Undeployed,
  devnet: MidnightNetwork.DevNet,
  testnet: MidnightNetwork.Testnet,
  mainnet: MidnightNetwork.Mainnet,
  preview: MidnightNetwork.Preview,
  preprod: MidnightNetwork.Preprod,
};
