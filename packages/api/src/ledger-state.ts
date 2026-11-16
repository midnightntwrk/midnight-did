import { ContractState } from "@midnight-ntwrk/compact-runtime";
import { LedgerToDomain } from "@midnight-ntwrk/midnight-did";
import {
  type ContractAddress,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did/midnight";
import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";

import { getLogger } from "./api-logger.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

export const getMidnightDIDLedgerState = async (
  providers: MidnightDIDProviders,
  contractAddress: ContractAddress,
): Promise<DIDContract.Ledger | null> => {
  assertIsContractAddress(contractAddress);
  getLogger().info("Checking MidnightDID contract ledger state...");
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((read) => {
      if (read == null) return null;
      const contractState = read.contractState.deserialize({
        v9: ContractState,
      });
      return DIDContract.ledger(contractState.data);
    });
  if (state != null) getLogger().info(LedgerToDomain.toJSON(state));
  return state;
};

export const requireMidnightDIDLedgerState = async (
  providers: MidnightDIDProviders,
  contractAddress: ContractAddress,
): Promise<DIDContract.Ledger> => {
  const didState = await getMidnightDIDLedgerState(providers, contractAddress);
  if (!didState) {
    throw new Error("Cannot query DID state");
  }
  return didState;
};

export const requireDeployedMidnightDIDLedgerState = async (
  providers: MidnightDIDProviders,
  didContract: DeployedMidnightDIDContract,
): Promise<DIDContract.Ledger> =>
  await requireMidnightDIDLedgerState(
    providers,
    parseContractAddress(didContract.deployTxData.public.contractAddress),
  );
