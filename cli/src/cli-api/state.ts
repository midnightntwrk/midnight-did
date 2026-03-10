import type { Ledger } from '../api';
import { CliDidState, type LedgerSnapshot } from './types';

const hasRelationEntries = (ledger: Ledger): boolean =>
  !ledger.authenticationRelation.isEmpty() ||
  !ledger.assertionMethodRelation.isEmpty() ||
  !ledger.keyAgreementRelation.isEmpty() ||
  !ledger.capabilityInvocationRelation.isEmpty() ||
  !ledger.capabilityDelegationRelation.isEmpty();

export const deriveLedgerSnapshot = (ledger: Ledger): LedgerSnapshot => ({
  hasMethods: !ledger.verificationMethods.isEmpty(),
  hasRelations: hasRelationEntries(ledger),
  hasServicesOrAliases: !ledger.services.isEmpty() || !ledger.alsoKnownAs.isEmpty(),
  active: ledger.active,
  deactivated: ledger.deactivated,
});

export const deriveState = (hasContract: boolean, snapshot: LedgerSnapshot | null): CliDidState => {
  if (!hasContract) return CliDidState.NoContract;
  if (!snapshot) return CliDidState.ContractJoinedNoDidState;
  if (snapshot.deactivated || !snapshot.active) return CliDidState.DidDeactivated;
  if (snapshot.hasRelations) return CliDidState.DidActiveWithRelations;
  if (snapshot.hasServicesOrAliases) return CliDidState.DidActiveWithServicesOrAliases;
  if (snapshot.hasMethods) return CliDidState.DidActiveWithMethods;
  return CliDidState.DidActiveEmpty;
};
