import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

const contractProviders = new WeakMap<object, MidnightDIDProviders>();

/** Associate SDK-created contract handles with providers for legacy overloads. */
export const registerContractProviders = (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
): void => {
  contractProviders.set(didContract, providers);
};

export const registeredContractProviders = (
  didContract: DeployedMidnightDIDContract,
): MidnightDIDProviders | undefined => contractProviders.get(didContract);
