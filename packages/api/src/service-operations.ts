import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { Service } from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { normalizeBoundFragmentId } from "./did-subject.js";
import { serviceToLedger } from "./ledger-mappers.js";
import { type DeployedMidnightDIDContract } from "./types.js";

export const addService = async (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.setService(
    serviceToLedger(didContract, service),
    DIDContract.MapMutation.Insert,
  );
  return result.public;
};

export const updateService = async (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.setService(
    serviceToLedger(didContract, service),
    DIDContract.MapMutation.Update,
  );
  return result.public;
};

export const removeService = async (
  didContract: DeployedMidnightDIDContract,
  serviceId: string,
): Promise<FinalizedTxData> => {
  const normalizedServiceId = normalizeBoundFragmentId(
    didContract,
    serviceId,
    "serviceId",
  );
  const result = await didContract.callTx.removeService(normalizedServiceId);
  return result.public;
};
