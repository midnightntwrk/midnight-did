import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { Service } from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import {
  asSchnorrJubjubDigest,
  createControllerAuthorization,
} from "./controller-authorization.js";
import { normalizeBoundDIDURL } from "./did-subject.js";
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
  const ledgerService = serviceToLedger(didContract, service);
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.setServiceAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          ledgerService,
          DIDContract.MapMutation.Insert,
        ),
      ),
  );
  const result = await didContract.callTx.setService(
    ledgerService,
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
  const ledgerService = serviceToLedger(didContract, service);
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.setServiceAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          ledgerService,
          DIDContract.MapMutation.Update,
        ),
      ),
  );
  const result = await didContract.callTx.setService(
    ledgerService,
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
  const normalizedServiceId = normalizeBoundDIDURL(
    didContract,
    serviceId,
    "serviceId",
  );
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
    (ledgerState) =>
      asSchnorrJubjubDigest(
        DIDContract.pureCircuits.removeServiceAuthorizationDigest(
          ledgerState.id,
          ledgerState.version,
          normalizedServiceId,
        ),
      ),
  );
  const result = await didContract.callTx.removeService(
    normalizedServiceId,
    signature,
    expectedVersion,
  );
  return result.public;
};
