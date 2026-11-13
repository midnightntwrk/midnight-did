import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { Service } from "@midnight-ntwrk/midnight-did-domain";
import { type Ledger9FinalizedCallTxPublicData } from "@midnight-ntwrk/midnight-js-contracts";

import {
  asSchnorrJubjubDigest,
  createControllerAuthorization,
} from "./controller-authorization.js";
import {
  getProviderMidnightNetwork,
  normalizeBoundDIDURL,
} from "./did-subject.js";
import {
  findExistingServiceLedgerId,
  ledgerIdentifier,
  requireExistingServiceLedgerId,
} from "./ledger-identifier-keys.js";
import { serviceToLedger } from "./ledger-mappers.js";
import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

export const addService = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  service: Service,
): Promise<Ledger9FinalizedCallTxPublicData> => {
  const network = getProviderMidnightNetwork(providers);
  const ledgerService = serviceToLedger(didContract, service, network);
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  if (
    findExistingServiceLedgerId(
      didState,
      ledgerIdentifier(didContract, ledgerService.id, network),
    ) !== null
  ) {
    throw new Error(`service ${ledgerService.id} already exists`);
  }
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
    didState,
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
): Promise<Ledger9FinalizedCallTxPublicData> => {
  const network = getProviderMidnightNetwork(providers);
  const canonicalService = serviceToLedger(didContract, service, network);
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const existingServiceId = requireExistingServiceLedgerId(
    didState,
    ledgerIdentifier(didContract, canonicalService.id, network),
  );
  const ledgerService = { ...canonicalService, id: existingServiceId };
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
    didState,
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
): Promise<Ledger9FinalizedCallTxPublicData> => {
  const network = getProviderMidnightNetwork(providers);
  const canonicalServiceId = normalizeBoundDIDURL(
    didContract,
    serviceId,
    "serviceId",
    network,
  );
  const didState = await requireDeployedMidnightDIDLedgerState(
    providers,
    didContract,
  );
  const normalizedServiceId = requireExistingServiceLedgerId(
    didState,
    ledgerIdentifier(didContract, canonicalServiceId, network),
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
    didState,
  );
  const result = await didContract.callTx.removeService(
    normalizedServiceId,
    signature,
    expectedVersion,
  );
  return result.public;
};
