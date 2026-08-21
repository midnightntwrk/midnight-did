import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";

import { MidnightDidApiError } from "./api-errors.js";
import { getLogger } from "./api-logger.js";
import { midnightDIDCompiledContract } from "./contract-instance.js";
import {
  bindPrivateStateProviderWithinLease,
  requireAttachablePrivateState,
  savePrivateState,
  withPrivateStateProviderLease,
} from "./private-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDPrivateState,
  MidnightDIDPrivateStateId,
  type MidnightDIDProviders,
} from "./types.js";

export type DIDContractDeploymentFinalizedPrivateStateIncompleteErrorCode =
  "did_contract_deployment_finalized_private_state_incomplete";

/** Raised when deployment finalized but its local private state was not set up. */
export class DIDContractDeploymentFinalizedPrivateStateIncompleteError extends MidnightDidApiError<DIDContractDeploymentFinalizedPrivateStateIncompleteErrorCode> {
  constructor(
    readonly contractAddress: string,
    readonly deployedContract: DeployedMidnightDIDContract,
    cause: unknown,
  ) {
    super(
      "did_contract_deployment_finalized_private_state_incomplete",
      `DID contract deployment finalized at ${contractAddress}, but local private-state setup is incomplete. Do not redeploy blindly; after resolving the private-state provider binding or persistence conflict, reconcile or join the finalized contract address.`,
      { cause },
    );
    this.name = "DIDContractDeploymentFinalizedPrivateStateIncompleteError";
  }
}

export const joinContract = async (
  providers: MidnightDIDProviders,
  contractAddress: string,
): Promise<DeployedMidnightDIDContract> => {
  const canonicalContractAddress = parseContractAddress(contractAddress);
  return withPrivateStateProviderLease(providers, async (lease) => {
    // Private state is scoped by contract address. Reserve the provider's
    // current source binding and target DID before rebinding, then retain both
    // reservations through the private-state read and contract lookup.
    bindPrivateStateProviderWithinLease(
      providers,
      canonicalContractAddress,
      lease,
    );
    const initialPrivateState = await requireAttachablePrivateState(providers);
    const didContract = await findDeployedContract(providers, {
      contractAddress: canonicalContractAddress,
      compiledContract: midnightDIDCompiledContract,
      privateStateId: MidnightDIDPrivateStateId,
      initialPrivateState: initialPrivateState,
    });
    getLogger().info(`Joined contract at address: ${canonicalContractAddress}`);
    return didContract;
  });
};

export const deploy = async (
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<DeployedMidnightDIDContract> => {
  return withPrivateStateProviderLease(providers, async (lease) => {
    getLogger().info("Deploying Midnight DID contract...");
    const didContract = await deployContract(providers, {
      compiledContract: midnightDIDCompiledContract,
      privateStateId: MidnightDIDPrivateStateId,
      initialPrivateState: privateState,
    });
    const canonicalContractAddress = parseContractAddress(
      didContract.deployTxData.public.contractAddress,
    );
    try {
      bindPrivateStateProviderWithinLease(
        providers,
        canonicalContractAddress,
        lease,
      );
      // `deployContract` receives the initial state for proving; this explicit
      // post-bind save makes the controller key durable for subsequent sessions.
      await savePrivateState(providers, privateState);
    } catch (cause: unknown) {
      throw new DIDContractDeploymentFinalizedPrivateStateIncompleteError(
        canonicalContractAddress,
        didContract,
        cause,
      );
    }
    getLogger().info(
      `Deployed contract at address: ${canonicalContractAddress}`,
    );
    return didContract;
  });
};

export const createDID = async (
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<DeployedMidnightDIDContract> => {
  getLogger().info("Creating DID...");
  const didContract = await deploy(providers, privateState);
  getLogger().info("Created DID successfully");
  return didContract;
};
