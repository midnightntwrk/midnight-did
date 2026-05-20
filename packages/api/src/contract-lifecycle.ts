import "./polyfills.js";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import {
  type ContractAddress,
  LedgerToDomain,
} from "@midnight-ntwrk/midnight-did";
import {
  DIDContract,
  type DIDPrivateState as MidnightDIDPrivateState,
  witnesses,
} from "@midnight-ntwrk/midnight-did-contract";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";

import { getLogger } from "./api-logger.js";
import { contractConfig } from "./config.js";
import { hashProverKey } from "./lightweight.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDContract,
  MidnightDIDPrivateStateId,
  type MidnightDIDProviders,
} from "./types.js";

const midnightDIDCompiledContract = CompiledContract.make(
  "did",
  DIDContract.Contract as unknown as new (
    ...args: any[]
  ) => MidnightDIDContract,
).pipe(
  CompiledContract.withWitnesses(witnesses as never),
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

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

export const midnightDIDContractInstance: MidnightDIDContract =
  new (DIDContract.Contract as unknown as new (
    ...args: any[]
  ) => MidnightDIDContract)(witnesses);

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
    if (
      !(error instanceof Error) ||
      !error.message.includes("Contract address not set")
    ) {
      throw error;
    }
    getLogger().info(
      "Private state restore skipped (contract address not set yet).",
    );
  }
  if (
    providedPrivateState != null &&
    providedPrivateState.secretKey != null &&
    providedPrivateState.secretKey.buffer instanceof ArrayBuffer &&
    providedPrivateState.secretKey.BYTES_PER_ELEMENT === 1 &&
    providedPrivateState.secretKey.length === 32
  ) {
    getLogger().info(
      "The private state is restored from the privateStateProvider",
    );
    return providedPrivateState;
  }

  getLogger().info("Creating the new private state..");
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
    if (
      error instanceof Error &&
      error.message.includes("Contract address not set")
    ) {
      getLogger().info(
        "Private state save skipped (contract address not set yet).",
      );
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
    privateStateId: MidnightDIDPrivateStateId,
    initialPrivateState: initialPrivateState,
  });
  getLogger().info(
    `Joined contract at address: ${didContract.deployTxData.public.contractAddress}`,
  );
  return didContract;
};

export const deploy = async (
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<DeployedMidnightDIDContract> => {
  getLogger().info("Deploying Midnight DID contract...");
  const didContract = await deployContract(providers, {
    compiledContract: midnightDIDCompiledContract,
    privateStateId: MidnightDIDPrivateStateId,
    initialPrivateState: privateState,
  });
  getLogger().info(
    `Deployed contract at address: ${didContract.deployTxData.public.contractAddress}`,
  );
  return didContract;
};

export const createDID = async (
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<DeployedMidnightDIDContract> => {
  getLogger().info("Creating DID...");
  const didContract = await deploy(providers, privateState);
  getLogger().info(
    `Created DID at contract address: ${didContract.deployTxData.public.contractAddress}`,
  );
  return didContract;
};
