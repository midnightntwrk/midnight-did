import { type ActionHint, CliDidState, type LedgerSnapshot } from './types';

export const buildHints = (state: CliDidState, snapshot: LedgerSnapshot | null): ActionHint[] => {
  switch (state) {
    case CliDidState.NoContract:
      return [
        { action: 'DeployContract', reason: 'Start a new DID lifecycle on-chain.' },
        { action: 'JoinContract', reason: 'Operate on an existing DID contract.' },
      ];
    case CliDidState.ContractJoinedNoDidState:
      return [
        { action: 'DeployContract', reason: 'Initialize DID state for this contract.' },
        { action: 'JoinContract', reason: 'Switch to a contract that already has DID state.' },
      ];
    case CliDidState.DidActiveEmpty:
      return [
        { action: 'AddVerificationMethodFromKey', reason: 'DID document has no keys yet.' },
        { action: 'AddService', reason: 'Add discovery endpoints early.' },
      ];
    case CliDidState.DidActiveWithMethods:
      return [
        { action: 'AddRelation', reason: 'Bind verification methods to DID core relationships.' },
        { action: 'AddService', reason: 'Add service endpoints for interoperability.' },
        { action: 'SignPayload', reason: 'Use stored keys for end-to-end signing checks.' },
      ];
    case CliDidState.DidActiveWithRelations:
      return [
        { action: 'AddService', reason: 'Complete DID document with service metadata.' },
        { action: 'AddAlsoKnownAs', reason: 'Publish aliases for linked identities.' },
        { action: 'VerifyPayload', reason: 'Verify signatures against published keys.' },
      ];
    case CliDidState.DidActiveWithServicesOrAliases:
      return [
        { action: 'UpdateVerificationMethodFromKey', reason: 'Rotate keys when needed.' },
        { action: 'RemoveService', reason: 'Clean up obsolete service endpoints.' },
        { action: 'DeactivateDID', reason: 'Deactivate when the DID should no longer be active.' },
      ];
    case CliDidState.DidDeactivated:
      return [
        { action: 'ShowState', reason: 'Inspect final DID document state.' },
        { action: 'VerifyPayload', reason: 'Verification is still useful for historic signatures.' },
      ];
    default:
      return snapshot ? [{ action: 'ShowState', reason: 'Refresh and inspect current DID state.' }] : [];
  }
};
