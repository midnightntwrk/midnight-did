import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";

import { getLogger } from "./api-logger.js";
import { midnightDIDCompiledContract } from "./contract-instance.js";
import {
  bindPrivateStateProvider,
  requireAttachablePrivateState,
  savePrivateState,
} from "./private-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDPrivateState,
  MidnightDIDPrivateStateId,
  type MidnightDIDProviders,
} from "./types.js";

export const joinContract = async (
  providers: MidnightDIDProviders,
  contractAddress: string,
): Promise<DeployedMidnightDIDContract> => {
  const canonicalContractAddress = parseContractAddress(contractAddress);
  // Private state is scoped by contract address; bind before reading so join
  // cannot create or load controller state from the wrong DID namespace.
  bindPrivateStateProvider(providers, canonicalContractAddress);
  const initialPrivateState = await requireAttachablePrivateState(providers);
  const didContract = await findDeployedContract(providers, {
    contractAddress: canonicalContractAddress,
    compiledContract: midnightDIDCompiledContract,
    privateStateId: MidnightDIDPrivateStateId,
    initialPrivateState: initialPrivateState,
  });
  getLogger().info(`Joined contract at address: ${canonicalContractAddress}`);
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
  const canonicalContractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  bindPrivateStateProvider(providers, canonicalContractAddress);
  // `deployContract` receives the initial state for proving; this explicit
  // post-bind save makes the controller key durable for subsequent sessions.
  await savePrivateState(providers, privateState);
  getLogger().info(`Deployed contract at address: ${canonicalContractAddress}`);
  return didContract;
};

export const createDID = async (
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<DeployedMidnightDIDContract> => {
  getLogger().info("Creating DID...");
  const didContract = await deploy(providers, privateState);
  const canonicalContractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  getLogger().info(
    `Created DID at contract address: ${canonicalContractAddress}`,
  );
  return didContract;
};
