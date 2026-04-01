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
  connection: {
    phase:
      | 'locked'
      | 'starting'
      | 'restoring'
      | 'syncing'
      | 'waitingForFunds'
      | 'configuringProviders'
      | 'joiningContract'
      | 'ready'
      | 'error';
    reusedPersistedState: boolean;
    walletStateKey: string | null;
    lastError: string | null;
  };
  did: {
    phase: 'none' | 'stored' | 'joined';
    lastError: string | null;
  };
};

export type ManagerOperationType =
  | 'prepareFunding'
  | 'unlock'
  | 'lock'
  | 'updatePreferences'
  | 'deployDid'
  | 'joinDid'
  | 'deactivateDid'
  | 'generateKey'
  | 'importKey'
  | 'deleteKey'
  | 'addVerificationMethod'
  | 'updateVerificationMethod'
  | 'removeVerificationMethod'
  | 'addRelation'
  | 'removeRelation'
  | 'addService'
  | 'updateService'
  | 'removeService'
  | 'addAlsoKnownAs'
  | 'removeAlsoKnownAs';

export type ManagerOperationStatus = {
  id: string;
  type: ManagerOperationType;
  status: 'running' | 'succeeded' | 'failed';
  submittedAt: string;
  completedAt: string | null;
  result: unknown | null;
  error: {
    message: string;
    errorCode: string;
    statusCode: number;
  } | null;
};

export type ProfileSelection = {
  profile: NetworkProfile;
  activeProfileName: string;
  availableProfileNames: string[];
};

export type StoredContractStatus = {
  address: string;
  selected: boolean;
  available: boolean | null;
  deactivated: boolean | null;
  version: number | null;
  operationCount: number | null;
  message: string | null;
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
