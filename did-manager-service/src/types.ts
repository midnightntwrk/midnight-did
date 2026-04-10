import type { PublicJwk } from '@midnight-ntwrk/midnight-did-secret-storage';

export type NetworkProfile = 'standalone' | 'preprod' | 'mainnet';
export type PayloadType = 'bytes' | 'string' | 'json';
export type SignatureFormat = 'ed25519-raw' | 'jubjub-raw-96' | 'ecdsa-der';
export type VerificationSource = 'localKey' | 'publicJwk' | 'didDocument';

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
  fundingPrepared: boolean;
  unshieldedAddress: string | null;
  faucetUrl: string | null;
  walletBalances: {
    night: string | null;
    dust: string | null;
  };
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

export type SignPayloadRequest = {
  keyRef: string;
  payloadType: PayloadType;
  payload: string;
};

export type SignPayloadResponse = {
  did: string;
  verificationMethodId: string;
  keyRef: string;
  algorithm: Pick<PublicJwk, 'kty' | 'crv'>;
  payloadType: PayloadType;
  canonicalText: string | null;
  canonicalHex: string;
  canonicalPayloadBase64Url: string;
  signatureBase64Url: string;
  signatureFormat: SignatureFormat;
  publicJwk: PublicJwk;
};

export type VerifyPayloadRequest = {
  payloadType: PayloadType;
  payload: string;
  signatureBase64Url: string;
  keyRef?: string;
  publicJwk?: PublicJwk;
  verificationMethodId?: string;
};

export type VerifyPayloadResponse = {
  verified: boolean;
  source: VerificationSource;
  did: string | null;
  verificationMethodId: string | null;
  algorithm: Pick<PublicJwk, 'kty' | 'crv'>;
  payloadType: PayloadType;
  canonicalText: string | null;
  canonicalHex: string;
  canonicalPayloadBase64Url: string;
  signatureBase64Url: string;
  signatureFormat: SignatureFormat;
  publicJwk: PublicJwk;
};
