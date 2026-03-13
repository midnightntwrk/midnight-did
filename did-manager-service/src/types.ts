export type NetworkProfile = 'standalone' | 'preprod';

export type SessionProfileState = {
  seed: string;
  unshieldedAddress?: string;
  contractAddress?: string;
  contractAddresses?: string[];
  updatedAt: string;
};

export type SessionStore = {
  version: 1;
  rememberUnlockedSession: boolean;
  lastProfile: NetworkProfile | null;
  profiles: Partial<Record<NetworkProfile, SessionProfileState>>;
};

export type UnlockRequest = {
  seedMode: 'reuse' | 'provided' | 'generated';
  seed?: string;
  passphrase?: string;
  rememberUnlockedSession?: boolean;
};

export type PrepareFundingRequest = {
  seedMode: 'reuse' | 'provided' | 'generated';
  seed?: string;
};

export type SessionStatus = {
  unlocked: boolean;
  profile: NetworkProfile;
  profileName: string;
  rememberUnlockedSession: boolean;
  contractAddress: string | null;
  knownContractAddresses: string[];
  seedAvailable: boolean;
  unshieldedAddress: string | null;
  faucetUrl: string | null;
};

export type ProfileSelection = {
  profile: NetworkProfile;
  activeProfileName: string;
  availableProfileNames: string[];
};

export type SetupStatus = {
  profile: NetworkProfile;
  faucetUrl: string | null;
  endpoints: {
    node: string;
    indexer: string;
    proofServer: string;
  };
};

export type FundingPreparation = {
  profile: NetworkProfile;
  unshieldedAddress: string;
  faucetUrl: string | null;
  generatedSeed?: string;
};

export type DidStateResponse = {
  contractAddress: string;
  didState: unknown;
};

export type DidDocumentResponse = unknown;
