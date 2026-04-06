import { LedgerToDomain, parseContractAddress } from '@midnight-ntwrk/midnight-did';
import * as api from '@midnight-ntwrk/midnight-did-api';
import {
  createService,
  type ServiceEndpoint,
  type VerificationMethod,
  type VerificationMethodRelationType,
} from '@midnight-ntwrk/midnight-did-domain';
import {
  type FileSecretStore,
  normalizePublicForLedger,
  type PublicJwk,
} from '@midnight-ntwrk/midnight-did-secret-storage';
import type { Logger } from 'pino';

import type { SetupProfile } from '../config.js';
import type { DidDocumentResponse, DidStateResponse, StoredContractStatus } from '../types.js';
import { withTimeout } from './helpers.js';

export const listStoredContracts = async (input: {
  addresses: string[];
  selectedAddress: string | null;
  unlocked: boolean;
  providers: api.MidnightDIDProviders | null;
  profile: SetupProfile;
}): Promise<StoredContractStatus[]> => {
  const { addresses, selectedAddress, unlocked, providers, profile } = input;
  if (addresses.length === 0) return [];

  if (!unlocked || providers === null) {
    return addresses.map((address) => ({
      address,
      selected: selectedAddress === address,
      available: null,
      deactivated: null,
      version: null,
      operationCount: null,
      message: 'Start a wallet session to validate stored contracts on the current network.',
    }));
  }

  return await Promise.all(
    addresses.map(async (address) => {
      try {
        const ledger = await withTimeout(
          api.getMidnightDIDLedgerState(providers, parseContractAddress(address)),
          10_000,
          `Stored contract check for ${address}`,
        );
        if (ledger === null) {
          return {
            address,
            selected: selectedAddress === address,
            available: false,
            deactivated: null,
            version: null,
            operationCount: null,
            message: `Contract ${address} is not available on ${profile}.`,
          } satisfies StoredContractStatus;
        }
        return {
          address,
          selected: selectedAddress === address,
          available: true,
          deactivated: ledger.deactivated,
          version: Number(ledger.version),
          operationCount: Number(ledger.operationCount),
          message: ledger.deactivated ? 'Contract is deployed but DID is deactivated.' : null,
        } satisfies StoredContractStatus;
      } catch (error) {
        return {
          address,
          selected: selectedAddress === address,
          available: null,
          deactivated: null,
          version: null,
          operationCount: null,
          message: error instanceof Error ? error.message : 'Stored contract check failed.',
        } satisfies StoredContractStatus;
      }
    }),
  );
};

export const deployDidContract = async (input: {
  logger: Logger;
  walletCtx: api.MidnightDIDWalletContext;
  providers: api.MidnightDIDProviders;
  onDidContract: (contract: api.DeployedMidnightDIDContract) => void;
  onPersist: () => Promise<void>;
}): Promise<{ contractAddress: string | null }> => {
  const { logger, walletCtx, providers, onDidContract, onPersist } = input;
  logger.info('Ensuring dust is available before DID deployment');
  await api.registerForDustGeneration(
    walletCtx.wallet,
    walletCtx.unshieldedKeystore,
  );
  logger.info('Deploying Midnight DID contract');
  const privateState = await api.initPrivateState(providers);
  const didContract = await api.createDID(providers, privateState);
  onDidContract(didContract);
  logger.info(
    { contractAddress: didContract.deployTxData.public.contractAddress },
    'Midnight DID contract deployed',
  );
  await onPersist();
  return { contractAddress: didContract.deployTxData.public.contractAddress };
};

export const getDidState = async (
  providers: api.MidnightDIDProviders,
  didContract: api.DeployedMidnightDIDContract,
): Promise<DidStateResponse | null> => {
  const contractAddress = parseContractAddress(didContract.deployTxData.public.contractAddress);
  const didState = await api.getMidnightDIDLedgerState(providers, contractAddress);
  return {
    contractAddress: didContract.deployTxData.public.contractAddress,
    didState: didState === null ? null : LedgerToDomain.toJSON(didState),
  };
};

export const getDidDocument = async (
  providers: api.MidnightDIDProviders,
  didContract: api.DeployedMidnightDIDContract,
): Promise<DidDocumentResponse> => api.resolve(providers, didContract);

export const buildNormalizedVerificationMethod = async (
  didContract: api.DeployedMidnightDIDContract,
  secretStore: FileSecretStore,
  keyRef: string,
  methodId: string,
  buildVerificationMethod: (methodId: string, publicJwk: PublicJwk) => VerificationMethod,
) => {
  const publicJwk = await secretStore.getPublicKey(keyRef);
  normalizePublicForLedger(publicJwk);
  return {
    didContract,
    method: buildVerificationMethod(methodId, publicJwk),
  };
};

export const addVerificationMethod = async (
  didContract: api.DeployedMidnightDIDContract,
  method: VerificationMethod,
  persist: () => Promise<void>,
): Promise<{ updated: true }> => {
  await api.addVerificationMethod(didContract, method);
  await persist();
  return { updated: true };
};

export const updateVerificationMethod = async (
  didContract: api.DeployedMidnightDIDContract,
  method: VerificationMethod,
  persist: () => Promise<void>,
): Promise<{ updated: true }> => {
  await api.updateVerificationMethod(didContract, method);
  await persist();
  return { updated: true };
};

export const removeVerificationMethod = async (
  didContract: api.DeployedMidnightDIDContract,
  providers: api.MidnightDIDProviders,
  methodId: string,
  persist: () => Promise<void>,
): Promise<{ removed: true }> => {
  await api.removeVerificationMethod(didContract, providers, methodId);
  await persist();
  return { removed: true };
};

export const addRelation = async (
  didContract: api.DeployedMidnightDIDContract,
  providers: api.MidnightDIDProviders,
  relation: VerificationMethodRelationType,
  methodId: string,
  persist: () => Promise<void>,
): Promise<{ updated: true }> => {
  await api.addVerificationMethodRelation(didContract, providers, relation, methodId);
  await persist();
  return { updated: true };
};

export const removeRelation = async (
  didContract: api.DeployedMidnightDIDContract,
  providers: api.MidnightDIDProviders,
  relation: VerificationMethodRelationType,
  methodId: string,
  persist: () => Promise<void>,
): Promise<{ removed: true }> => {
  await api.removeVerificationMethodRelation(didContract, providers, relation, methodId);
  await persist();
  return { removed: true };
};

export const addService = async (
  didContract: api.DeployedMidnightDIDContract,
  input: { id: string; type: string; serviceEndpoint: ServiceEndpoint },
  persist: () => Promise<void>,
): Promise<{ updated: true }> => {
  await api.addService(didContract, createService(input));
  await persist();
  return { updated: true };
};

export const updateService = async (
  didContract: api.DeployedMidnightDIDContract,
  input: { id: string; type: string; serviceEndpoint: ServiceEndpoint },
  persist: () => Promise<void>,
): Promise<{ updated: true }> => {
  await api.updateService(didContract, createService(input));
  await persist();
  return { updated: true };
};

export const removeService = async (
  didContract: api.DeployedMidnightDIDContract,
  id: string,
  persist: () => Promise<void>,
): Promise<{ removed: true }> => {
  await api.removeService(didContract, id);
  await persist();
  return { removed: true };
};

export const addAlsoKnownAs = async (
  didContract: api.DeployedMidnightDIDContract,
  value: string,
  persist: () => Promise<void>,
): Promise<{ updated: true }> => {
  await api.addAlsoKnownAs(didContract, value);
  await persist();
  return { updated: true };
};

export const removeAlsoKnownAs = async (
  didContract: api.DeployedMidnightDIDContract,
  value: string,
  persist: () => Promise<void>,
): Promise<{ removed: true }> => {
  await api.removeAlsoKnownAs(didContract, value);
  await persist();
  return { removed: true };
};

export const deactivateDid = async (
  didContract: api.DeployedMidnightDIDContract,
  persist: () => Promise<void>,
): Promise<{ deactivated: true }> => {
  await api.deactivate(didContract);
  await persist();
  return { deactivated: true };
};
