import {
  type ContractAddress,
  LedgerToDomain,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did";
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
    .then((contractState) =>
      contractState != null ? DIDContract.ledger(contractState.data) : null,
    );
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
