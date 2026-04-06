import { randomBytes } from 'node:crypto';
import path from 'node:path';

import { createMidnightDIDString, MidnightNetwork, parseContractAddress } from '@midnight-ntwrk/midnight-did';
import * as api from '@midnight-ntwrk/midnight-did-api';
import {
  createVerificationMethod,
  type CurveType,
  KeyType,
  VerificationMethodType,
} from '@midnight-ntwrk/midnight-did-domain';
import { FileSecretStore, type PublicJwk } from '@midnight-ntwrk/midnight-did-secret-storage';
import { getNetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import type { ManagerConfig, SetupProfile } from '../config.js';

export const nowIso = (): string => new Date().toISOString();
export const generateSeedHex = (): string => randomBytes(32).toString('hex');
export const profileNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

const runtimeNetworkMap: Record<ReturnType<typeof getNetworkId>, MidnightNetwork> = {
  undeployed: MidnightNetwork.Undeployed,
  devnet: MidnightNetwork.DevNet,
  testnet: MidnightNetwork.Testnet,
  mainnet: MidnightNetwork.Mainnet,
  preview: MidnightNetwork.Preview,
  preprod: MidnightNetwork.Preprod,
};

export const buildProfileConfig = (cfg: ManagerConfig, profile: SetupProfile): api.Config => {
  const baseLogDir = path.resolve(process.cwd(), 'logs', 'did-manager-service', profile);
  if (profile === 'standalone') {
    // Initialize network id inside the API package runtime as well.
    void new api.StandaloneConfig();
    setNetworkId('undeployed');
    return {
      logDir: `${baseLogDir}/${nowIso()}.log`,
      indexer: cfg.standalone.indexer,
      indexerWS: cfg.standalone.indexerWS,
      node: cfg.standalone.node,
      proofServer: cfg.standalone.proofServer,
    };
  }

  if (profile === 'preprod') {
    // Initialize network id inside the API package runtime as well.
    void new api.PreprodConfig();
    setNetworkId('preprod');
    return {
      logDir: `${baseLogDir}/${nowIso()}.log`,
      indexer: cfg.preprod.indexer,
      indexerWS: cfg.preprod.indexerWS,
      node: cfg.preprod.node,
      proofServer: cfg.preprod.proofServer,
    };
  }

  // Initialize network id inside the API package runtime as well.
  void new api.MainnetConfig({
    indexer: cfg.mainnet.indexer,
    indexerWS: cfg.mainnet.indexerWS,
    node: cfg.mainnet.node,
    proofServer: cfg.mainnet.proofServer,
  });
  setNetworkId('mainnet');
  return {
    logDir: `${baseLogDir}/${nowIso()}.log`,
    indexer: cfg.mainnet.indexer,
    indexerWS: cfg.mainnet.indexerWS,
    node: cfg.mainnet.node,
    proofServer: cfg.mainnet.proofServer,
  };
};

export const midnightDbPath = (profileRootDir: string, seedHash: string): string =>
  path.join(profileRootDir, 'midnight-level-db', seedHash);

export const faucetUrl = (profile: SetupProfile): string | null =>
  profile === 'preprod' ? 'https://faucet.preprod.midnight.network/' : null;

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = globalThis.setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle !== null) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
};

export const joinExistingContract = async (
  providers: api.MidnightDIDProviders,
  contractAddress: string,
  profile: SetupProfile,
): Promise<api.DeployedMidnightDIDContract> => {
  const normalizedAddress = parseContractAddress(contractAddress);
  const didState = await withTimeout(
    api.getMidnightDIDLedgerState(providers, normalizedAddress),
    15_000,
    `Contract lookup for ${contractAddress}`,
  );
  if (didState === null) {
    throw new Error(`Stored contract ${contractAddress} was not found on ${profile}.`);
  }
  return await withTimeout(
    api.joinContract(providers, contractAddress),
    30_000,
    `Contract join for ${contractAddress}`,
  );
};

export const createSecretStore = async (
  location: string,
  passphrase: string | undefined,
  defaultSecretPassphrase: string,
): Promise<FileSecretStore> => {
  const secretStore = new FileSecretStore();
  await secretStore.initialize({
    location,
    passphrase: passphrase ?? defaultSecretPassphrase,
  });
  return secretStore;
};

export const buildVerificationMethod = (
  didContract: api.DeployedMidnightDIDContract,
  methodId: string,
  publicJwk: PublicJwk,
) => {
  const contractAddress = parseContractAddress(didContract.deployTxData.public.contractAddress);
  const didSubject = createMidnightDIDString(contractAddress, runtimeNetworkMap[getNetworkId()]);
  return createVerificationMethod({
    id: methodId,
    type: VerificationMethodType.JsonWebKey,
    controller: didSubject,
    publicKeyJwk: {
      kty: publicJwk.kty === 'EC' ? KeyType.EC : KeyType.OKP,
      crv: publicJwk.crv as CurveType,
      x: publicJwk.x,
      y: publicJwk.y,
    },
  });
};
