import * as api from '@midnight-ntwrk/midnight-did-api';
import { parseSeed } from '@midnight-ntwrk/midnight-did-secret-storage';

import type { ManagerConfig, SetupProfile } from '../config.js';
import type { SessionProfileState, SessionStatus, SetupStatus } from '../types.js';
import { faucetUrl, generateSeedHex } from './helpers.js';

export const resolveSeedInput = (
  profile: SetupProfile,
  profileState: SessionProfileState | undefined,
  input: { seedMode: 'reuse' | 'provided' | 'generated'; seed?: string },
): { seed: string; generatedSeed?: string } => {
  if (input.seedMode === 'reuse') {
    if (!profileState?.seed) {
      throw new Error(`No stored seed found for profile '${profile}'.`);
    }
    return { seed: parseSeed(profileState.seed) };
  }

  if (input.seedMode === 'provided') {
    if (!input.seed || input.seed.trim() === '') {
      throw new Error('Seed is required when seedMode=provided.');
    }
    return { seed: parseSeed(input.seed) };
  }

  const generatedSeed = generateSeedHex();
  return { seed: generatedSeed, generatedSeed };
};

export const buildSetupStatus = (
  cfg: ManagerConfig,
  profile: SetupProfile,
): SetupStatus => {
  const endpoints = profile === 'standalone'
    ? {
        node: cfg.standalone.node,
        indexer: cfg.standalone.indexer,
        proofServer: cfg.standalone.proofServer,
      }
    : {
        node: cfg.preprod.node,
        indexer: cfg.preprod.indexer,
        proofServer: cfg.preprod.proofServer,
      };

  return {
    profile,
    faucetUrl: faucetUrl(profile),
    endpoints,
  };
};

export const buildSessionStatus = (
  profile: SetupProfile,
  profileName: string,
  rememberUnlockedSession: boolean,
  profileState: SessionProfileState | undefined,
  currentContractAddress: string | null,
  connection: SessionStatus['connection'],
  did: SessionStatus['did'],
  unlocked: boolean,
): SessionStatus => ({
  unlocked,
  profile,
  profileName,
  rememberUnlockedSession,
  contractAddress: currentContractAddress ?? profileState?.contractAddress ?? null,
  knownContractAddresses: profileState?.contractAddresses ?? [],
  seedAvailable: Boolean(profileState?.seed),
  unshieldedAddress: profileState?.unshieldedAddress ?? null,
  faucetUrl: faucetUrl(profile),
  connection,
  did,
});

export const deriveUnshieldedAddress = (seed: string): string =>
  api.deriveUnshieldedAddressFromSeed(seed);
