import {
  createMidnightDIDString,
  MidnightNetwork,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did/midnight";
import {
  type BoundIdField,
  normalizeBoundDIDURL as normalizeBoundDIDURLWithSubject,
  normalizeBoundFragmentId as normalizeBoundFragmentIdWithSubject,
} from "@midnight-ntwrk/midnight-did-domain";

import { getCurrentNetworkId } from "./network-context.js";
import { RuntimeToDomain } from "./runtime-to-domain.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

export const getMidnightNetwork = (): MidnightNetwork =>
  RuntimeToDomain.NetworkMap[getCurrentNetworkId()];

/** Capture and validate initialized provider configuration; never use the default. */
export const getProviderMidnightNetwork = (
  providers: MidnightDIDProviders,
): MidnightNetwork => {
  const networkId = providers.config?.networkId;
  if (
    typeof networkId !== "string" ||
    !Object.hasOwn(RuntimeToDomain.NetworkMap, networkId)
  ) {
    throw new Error("Invalid initialized provider network");
  }
  return RuntimeToDomain.NetworkMap[networkId];
};

export const getDidSubject = (
  didContract: DeployedMidnightDIDContract,
  network: MidnightNetwork = getMidnightNetwork(),
): string => {
  const contractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  return createMidnightDIDString(contractAddress, network);
};

export const normalizeBoundFragmentId = (
  didContract: DeployedMidnightDIDContract,
  value: string,
  field: BoundIdField,
  network: MidnightNetwork = getMidnightNetwork(),
): string =>
  normalizeBoundFragmentIdWithSubject(
    value,
    field,
    getDidSubject(didContract, network),
  );

export const normalizeBoundDIDURL = (
  didContract: DeployedMidnightDIDContract,
  value: string,
  field: BoundIdField,
  network: MidnightNetwork = getMidnightNetwork(),
): string =>
  normalizeBoundDIDURLWithSubject(
    value,
    field,
    getDidSubject(didContract, network),
  );
