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
  type PrivateStateProviderLease,
  requireAttachablePrivateState,
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

/** Public deployment evidence safe to attach to an error. */
export interface DIDContractDeploymentPublicEvidence {
  readonly deployTxData: {
    readonly public: unknown;
  };
}

interface DIDContractDeploymentFinalizedEvidence {
  readonly deployedContract?: DIDContractDeploymentPublicEvidence;
  readonly finalizedTxData?: unknown;
}

/** Raised when deployment finalized but its local private state was not set up. */
export class DIDContractDeploymentFinalizedPrivateStateIncompleteError extends MidnightDidApiError<DIDContractDeploymentFinalizedPrivateStateIncompleteErrorCode> {
  readonly deployedContract?: DIDContractDeploymentPublicEvidence;
  readonly finalizedTxData?: unknown;

  constructor(
    readonly contractAddress: string,
    cause: unknown,
    evidence: DIDContractDeploymentFinalizedEvidence = {},
  ) {
    super(
      "did_contract_deployment_finalized_private_state_incomplete",
      `DID contract deployment finalized at ${contractAddress}, but local private-state setup is incomplete. Do not redeploy blindly; after resolving the private-state provider binding or persistence conflict, reconcile or join the finalized contract address.`,
      { cause },
    );
    this.name = "DIDContractDeploymentFinalizedPrivateStateIncompleteError";
    this.deployedContract = evidence.deployedContract;
    this.finalizedTxData = evidence.finalizedTxData;
  }
}

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === "object" && value !== null;

const deploymentEvidenceFromError = (
  error: unknown,
): DIDContractDeploymentFinalizedEvidence => {
  if (!isRecord(error)) {
    return {};
  }

  const candidate = error.deployedContract;
  const deployTxData = isRecord(candidate) ? candidate.deployTxData : undefined;
  const publicDeployTxData = isRecord(deployTxData)
    ? deployTxData.public
    : undefined;
  return {
    deployedContract:
      publicDeployTxData === undefined
        ? undefined
        : { deployTxData: { public: publicDeployTxData } },
    finalizedTxData: error.finalizedTxData,
  };
};

interface DeploymentPrivateStateInterceptor {
  readonly providers: MidnightDIDProviders;
  readonly observedContractAddress: () => string | undefined;
  readonly deactivate: () => void;
}

/**
 * midnight-js-contracts 4.0.2 binds the target and then awaits active-state and
 * signing-key writes after ledger success, but before deployContract returns.
 * Intercepting that first synchronous bind is therefore the only point where we
 * can reserve the finalized target before the dependency mutates the provider
 * and still classify either following persistence rejection as post-finality.
 */
const interceptDeploymentPrivateStateProvider = (
  providers: MidnightDIDProviders,
  lease: PrivateStateProviderLease,
): DeploymentPrivateStateInterceptor => {
  const provider = providers.privateStateProvider;
  const boundMethods = new WeakMap<Function, Function>();
  let active = true;
  let observedContractAddress: string | undefined;

  const privateStateProvider = new Proxy(provider, {
    get(target, property) {
      if (property === "setContractAddress") {
        return (contractAddress: string): void => {
          if (!active) {
            // deployContract retains its providers in the returned call
            // interfaces. After deployment, behave like the original provider
            // without consulting this interceptor's settled lease.
            provider.setContractAddress(contractAddress);
            return;
          }
          const canonicalContractAddress =
            parseContractAddress(contractAddress);
          observedContractAddress = canonicalContractAddress;
          bindPrivateStateProviderWithinLease(
            providers,
            canonicalContractAddress,
            lease,
          );
        };
      }

      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") {
        return value;
      }
      const existing = boundMethods.get(value);
      if (existing !== undefined) {
        return existing;
      }
      const bound = value.bind(target) as Function;
      boundMethods.set(value, bound);
      return bound;
    },
  });

  const deploymentProviders = new Proxy(providers, {
    get(target, property, receiver) {
      return property === "privateStateProvider"
        ? privateStateProvider
        : Reflect.get(target, property, receiver);
    },
  });

  return {
    providers: deploymentProviders,
    observedContractAddress: () => observedContractAddress,
    deactivate: () => {
      active = false;
    },
  };
};

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
    const interceptor = interceptDeploymentPrivateStateProvider(
      providers,
      lease,
    );
    try {
      const didContract = await deployContract(interceptor.providers, {
        compiledContract: midnightDIDCompiledContract,
        privateStateId: MidnightDIDPrivateStateId,
        initialPrivateState: privateState,
      });
      const canonicalContractAddress = parseContractAddress(
        didContract.deployTxData.public.contractAddress,
      );
      getLogger().info(
        `Deployed contract at address: ${canonicalContractAddress}`,
      );
      return didContract;
    } catch (cause: unknown) {
      const canonicalContractAddress = interceptor.observedContractAddress();
      if (canonicalContractAddress === undefined) {
        throw cause;
      }
      throw new DIDContractDeploymentFinalizedPrivateStateIncompleteError(
        canonicalContractAddress,
        cause,
        deploymentEvidenceFromError(cause),
      );
    } finally {
      // deployContract's returned interfaces retain their providers. Never let
      // that captured proxy spend this operation's lease after it settles.
      interceptor.deactivate();
    }
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
