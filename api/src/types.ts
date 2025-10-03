import { NetworkId } from "@midnight-ntwrk/ledger";
import {
  DIDContract,
  type MidnightDIDPrivateState,
} from "@midnight-ntwrk/midnight-did-contract";
import { MidnightNetwork } from "@midnight-ntwrk/midnight-did-domain";
import type {
  DeployedContract,
  FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type {
  ImpureCircuitId,
  MidnightProviders,
} from "@midnight-ntwrk/midnight-js-types";

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

export const NetworkMapping: Record<NetworkId, MidnightNetwork> = {
  [NetworkId.Undeployed]: MidnightNetwork.Undeployed,
  [NetworkId.DevNet]: MidnightNetwork.DevNet,
  [NetworkId.TestNet]: MidnightNetwork.Testnet,
  [NetworkId.MainNet]: MidnightNetwork.Mainnet,
};
