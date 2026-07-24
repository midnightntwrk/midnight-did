import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { Service } from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { createControllerAuthorization } from "./controller-authorization.js";
import { normalizeBoundFragmentId } from "./did-subject.js";
import { serviceToLedger } from "./ledger-mappers.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

export const addService = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  service: Service,
): Promise<FinalizedTxData> => {
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
  );
  const result = await didContract.callTx.setService(
    serviceToLedger(didContract, service),
    DIDContract.MapMutation.Insert,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const updateService = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  service: Service,
): Promise<FinalizedTxData> => {
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
  );
  const result = await didContract.callTx.setService(
    serviceToLedger(didContract, service),
    DIDContract.MapMutation.Update,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const removeService = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  serviceId: string,
): Promise<FinalizedTxData> => {
  const normalizedServiceId = normalizeBoundFragmentId(
    didContract,
    serviceId,
    "serviceId",
  );
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
  );
  const result = await didContract.callTx.removeService(
    normalizedServiceId,
    signature,
    expectedVersion,
  );
  return result.public;
};
