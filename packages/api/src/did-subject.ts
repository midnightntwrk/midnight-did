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
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import { RuntimeToDomain } from "./runtime-to-domain.js";
import { type DeployedMidnightDIDContract } from "./types.js";

export const getMidnightNetwork = (): MidnightNetwork =>
  RuntimeToDomain.NetworkMap[getNetworkId()];

export const getDidSubject = (
  didContract: DeployedMidnightDIDContract,
): string => {
  const contractAddress = parseContractAddress(
    didContract.deployTxData.public.contractAddress,
  );
  return createMidnightDIDString(contractAddress, getMidnightNetwork());
};

export const normalizeBoundFragmentId = (
  didContract: DeployedMidnightDIDContract,
  value: string,
  field: BoundIdField,
): string =>
  normalizeBoundFragmentIdWithSubject(value, field, getDidSubject(didContract));

export const normalizeBoundDIDURL = (
  didContract: DeployedMidnightDIDContract,
  value: string,
  field: BoundIdField,
): string =>
  normalizeBoundDIDURLWithSubject(value, field, getDidSubject(didContract));
