import { type CliDidEvent, CliDidState, type GuardResult } from './types';

const blocked = (reason: string, fix?: string): GuardResult => ({ allowed: false, reason, fix });

export const guardTransition = (state: CliDidState, event: CliDidEvent): GuardResult => {
  if (event === 'ShowState') return { allowed: true };

  if (state === CliDidState.NoContract) {
    if (event === 'DeployContract' || event === 'JoinContract') return { allowed: true };
    return blocked('No DID contract is selected', 'Deploy a new DID contract or join an existing one first.');
  }

  if (state === CliDidState.ContractJoinedNoDidState) {
    if (event === 'DeployContract' || event === 'JoinContract') return { allowed: true };
    return blocked(
      'No DID ledger state was found for the selected contract',
      'Deploy a DID state or join a different contract.',
    );
  }

  if (state === CliDidState.DidDeactivated) {
    if (event === 'VerifyPayload') return { allowed: true };
    return blocked('DID is deactivated and cannot be modified', 'Create or join an active DID contract.');
  }

  if (event === 'DeployContract' || event === 'JoinContract') {
    return blocked(
      'A DID contract is already selected',
      'Use current DID operations or restart flow to select another contract.',
    );
  }

  return { allowed: true };
};
