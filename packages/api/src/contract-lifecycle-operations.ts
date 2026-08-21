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

/** Local setup step that remained incomplete after deployment finalized. */
export type DIDContractDeploymentSetupStage =
  | "target_reservation"
  | "private_state_persistence"
  | "signing_key_persistence"
  | "contract_handle_construction";

/** Raised when deployment finalized but its local private state was not set up. */
export class DIDContractDeploymentFinalizedPrivateStateIncompleteError extends MidnightDidApiError<DIDContractDeploymentFinalizedPrivateStateIncompleteErrorCode> {
  readonly contractAddress: string;

  constructor(
    contractAddress: string,
    readonly setupStage: DIDContractDeploymentSetupStage,
  ) {
    if (
      setupStage !== "target_reservation" &&
      setupStage !== "private_state_persistence" &&
      setupStage !== "signing_key_persistence" &&
      setupStage !== "contract_handle_construction"
    ) {
      throw new TypeError("Invalid finalized deployment setup stage");
    }
    const canonicalContractAddress = parseContractAddress(contractAddress);
    super(
      "did_contract_deployment_finalized_private_state_incomplete",
      `DID contract deployment finalized at ${canonicalContractAddress}, but local setup is incomplete at stage ${setupStage}. Do not redeploy blindly; reconcile or join the finalized contract address.`,
    );
    this.name = "DIDContractDeploymentFinalizedPrivateStateIncompleteError";
    this.contractAddress = canonicalContractAddress;
  }
}

interface ObservedFinalizedDeploymentSetup {
  readonly contractAddress: string;
  readonly setupStage: DIDContractDeploymentSetupStage;
}

interface DeploymentPrivateStateInterceptor {
  readonly providers: MidnightDIDProviders;
  readonly observedFinalizedSetup: () =>
    ObservedFinalizedDeploymentSetup | undefined;
  readonly deactivate: () => void;
}

/**
 * midnight-js-contracts 4.0.2 binds the target and then awaits active-state and
 * signing-key writes after ledger success. deployContract subsequently builds
 * the returned call interface, which binds the same target a second time.
 * Intercepting those operations reserves the finalized target before mutation
 * and tracks each post-finality setup stage without regressing on that repeat
 * binding.
 */
const interceptDeploymentPrivateStateProvider = (
  providers: MidnightDIDProviders,
  lease: PrivateStateProviderLease,
): DeploymentPrivateStateInterceptor => {
  const provider = providers.privateStateProvider;
  const boundMethods = new Map<
    PropertyKey,
    { readonly original: Function; readonly bound: Function }
  >();
  let active = true;
  let observedContractAddress: string | undefined;
  let setupStage: DIDContractDeploymentSetupStage = "target_reservation";
  const setupStageOrder: ReadonlyArray<DIDContractDeploymentSetupStage> = [
    "target_reservation",
    "private_state_persistence",
    "signing_key_persistence",
    "contract_handle_construction",
  ];
  const advanceSetupStage = (next: DIDContractDeploymentSetupStage): void => {
    if (setupStageOrder.indexOf(next) > setupStageOrder.indexOf(setupStage)) {
      setupStage = next;
    }
  };

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
          if (observedContractAddress === undefined) {
            observedContractAddress = canonicalContractAddress;
          } else {
            // createCircuitCallTxInterface performs a second bind after both
            // persistence writes. It begins handle construction; it must never
            // make a later failure look like an earlier persistence failure.
            advanceSetupStage("contract_handle_construction");
          }
          bindPrivateStateProviderWithinLease(
            providers,
            canonicalContractAddress,
            lease,
          );
          advanceSetupStage("private_state_persistence");
        };
      }

      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") {
        return value;
      }
      const existing = boundMethods.get(property);
      if (existing !== undefined && existing.original === value) {
        return existing.bound;
      }
      const bound =
        property === "set"
          ? function (this: unknown, ...args: unknown[]): unknown {
              if (!active) {
                return Reflect.apply(value, target, args) as unknown;
              }
              advanceSetupStage("private_state_persistence");
              const result = Reflect.apply(value, target, args) as unknown;
              return Promise.resolve(result).then((resolved) => {
                if (active) {
                  advanceSetupStage("signing_key_persistence");
                }
                return resolved;
              });
            }
          : property === "setSigningKey"
            ? function (this: unknown, ...args: unknown[]): unknown {
                if (!active) {
                  return Reflect.apply(value, target, args) as unknown;
                }
                advanceSetupStage("signing_key_persistence");
                const result = Reflect.apply(value, target, args) as unknown;
                return Promise.resolve(result).then((resolved) => {
                  if (active) {
                    advanceSetupStage("contract_handle_construction");
                  }
                  return resolved;
                });
              }
            : (value.bind(target) as Function);
      boundMethods.set(property, { original: value, bound });
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
    observedFinalizedSetup: () =>
      observedContractAddress === undefined
        ? undefined
        : { contractAddress: observedContractAddress, setupStage },
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
      const finalizedSetup = interceptor.observedFinalizedSetup();
      if (finalizedSetup === undefined) {
        throw cause;
      }
      throw new DIDContractDeploymentFinalizedPrivateStateIncompleteError(
        finalizedSetup.contractAddress,
        finalizedSetup.setupStage,
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
