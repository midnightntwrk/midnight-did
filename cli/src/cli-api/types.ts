import type {
  DeriveKeyFromSeedInput as SecretDeriveKeyFromSeedInput,
  GenerateKeyInput as SecretGenerateKeyInput,
  ImportKeyInput as SecretImportKeyInput,
  SecretStorage,
} from '@midnight-ntwrk/midnight-did-secret-storage';

import type { DeployedDIDContract, DIDProviders } from '../api';

export enum CliDidState {
  NoContract = 'NoContract',
  ContractJoinedNoDidState = 'ContractJoinedNoDidState',
  DidActiveEmpty = 'DidActiveEmpty',
  DidActiveWithMethods = 'DidActiveWithMethods',
  DidActiveWithRelations = 'DidActiveWithRelations',
  DidActiveWithServicesOrAliases = 'DidActiveWithServicesOrAliases',
  DidDeactivated = 'DidDeactivated',
}

export type LedgerSnapshot = {
  hasMethods: boolean;
  hasRelations: boolean;
  hasServicesOrAliases: boolean;
  active: boolean;
  deactivated: boolean;
};

export type ActionHint = {
  action: string;
  reason: string;
};

export type StateContext = {
  providers: DIDProviders;
  didContract: DeployedDIDContract | null;
  ledgerSnapshot: LedgerSnapshot | null;
  state: CliDidState;
  hints: ActionHint[];
};

export type CommandResult<T = unknown> = {
  status: 'ok' | 'rejected';
  message: string;
  data?: T;
  hints: ActionHint[];
  state: CliDidState;
};

export type GuardResult = { allowed: true } | { allowed: false; reason: string; fix?: string };

export type CliDidEvent =
  | 'DeployContract'
  | 'JoinContract'
  | 'AddVerificationMethodFromKey'
  | 'UpdateVerificationMethodFromKey'
  | 'RemoveVerificationMethod'
  | 'AddRelation'
  | 'RemoveRelation'
  | 'AddService'
  | 'UpdateService'
  | 'RemoveService'
  | 'AddAlsoKnownAs'
  | 'RemoveAlsoKnownAs'
  | 'DeactivateDID'
  | 'SignPayload'
  | 'VerifyPayload'
  | 'ShowState';

export type CliServiceOptions = {
  providers: DIDProviders;
  secretStorage: SecretStorage;
  didContract?: DeployedDIDContract;
};

export type AddMethodFromKeyInput = {
  methodId: string;
  keyRef: string;
};

export type UpdateMethodFromKeyInput = {
  methodId: string;
  keyRef: string;
};

export type AddRelationInput = {
  methodId: string;
  relation: 'Authentication' | 'AssertionMethod' | 'KeyAgreement' | 'CapabilityInvocation' | 'CapabilityDelegation';
};

export type RemoveRelationInput = AddRelationInput;

export type AddServiceInput = {
  id: string;
  type: string | string[];
  serviceEndpoint: string | Record<string, unknown> | Array<string | Record<string, unknown>>;
};

export type UpdateServiceInput = AddServiceInput;

export type RemoveServiceInput = {
  id: string;
};

export type AliasInput = {
  value: string;
};

export type GenerateKeyInput = SecretGenerateKeyInput;
export type DeriveKeyFromSeedInput = SecretDeriveKeyFromSeedInput;
export type ImportKeyInput = SecretImportKeyInput;
