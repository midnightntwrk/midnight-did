import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";

import { getDidSubject } from "./did-subject.js";
import { type DeployedMidnightDIDContract } from "./types.js";

export type LedgerIdentifier = {
  readonly canonical: string;
  readonly legacy?: string;
};

export type VerificationMethodLedgerKind = "opaque" | "schnorrJubjub";

export type ExistingVerificationMethodLedgerIdentifier = {
  readonly id: string;
  readonly kind: VerificationMethodLedgerKind;
};

type LedgerMap = {
  member(value: string): boolean;
};

/**
 * Keep canonical DID URL identity separate from its physical ledger key.
 *
 * Before canonical URL storage, the SDK persisted current-subject fragment
 * references as `#fragment`. Only that exact identity has a safe legacy alias;
 * path, query, foreign-DID, and external URL identities must remain distinct.
 */
export const ledgerIdentifier = (
  didContract: DeployedMidnightDIDContract,
  canonical: string,
): LedgerIdentifier => {
  const didSubject = getDidSubject(didContract);
  const legacy = canonical.startsWith(`${didSubject}#`)
    ? canonical.slice(didSubject.length)
    : undefined;
  return legacy === undefined ? { canonical } : { canonical, legacy };
};

const candidateIds = (identifier: LedgerIdentifier): readonly string[] =>
  identifier.legacy === undefined
    ? [identifier.canonical]
    : [identifier.canonical, identifier.legacy];

const matchingIds = (
  identifier: LedgerIdentifier,
  ledgerMap: LedgerMap,
): readonly string[] =>
  candidateIds(identifier).filter((id) => ledgerMap.member(id));

export const findExistingServiceLedgerId = (
  didState: DIDContract.Ledger,
  identifier: LedgerIdentifier,
): string | null => {
  const matches = matchingIds(identifier, didState.services);
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous service identifier '${identifier.canonical}': canonical and legacy ledger keys both exist`,
    );
  }
  return matches[0] ?? null;
};

export const requireExistingServiceLedgerId = (
  didState: DIDContract.Ledger,
  identifier: LedgerIdentifier,
): string => {
  const id = findExistingServiceLedgerId(didState, identifier);
  if (id === null) {
    throw new Error(`service ${identifier.canonical} does not exist`);
  }
  return id;
};

export const findExistingVerificationMethodLedgerIdentifier = (
  didState: DIDContract.Ledger,
  identifier: LedgerIdentifier,
): ExistingVerificationMethodLedgerIdentifier | null => {
  const matches: ExistingVerificationMethodLedgerIdentifier[] = [];
  for (const id of candidateIds(identifier)) {
    if (didState.verificationMethods.member(id)) {
      matches.push({ id, kind: "opaque" });
    }
    if (didState.schnorrJubjubVerificationMethods.member(id)) {
      matches.push({ id, kind: "schnorrJubjub" });
    }
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous verification method identifier '${identifier.canonical}': multiple canonical or legacy ledger records exist`,
    );
  }
  return matches[0] ?? null;
};

export const requireExistingVerificationMethodLedgerId = (
  didState: DIDContract.Ledger,
  identifier: LedgerIdentifier,
  expectedKind?: VerificationMethodLedgerKind,
): string => {
  const existing = findExistingVerificationMethodLedgerIdentifier(
    didState,
    identifier,
  );
  if (existing === null) {
    throw new Error(
      `verification method ${identifier.canonical} does not exist`,
    );
  }
  if (expectedKind !== undefined && existing.kind !== expectedKind) {
    throw new Error(
      `verification method ${identifier.canonical} is stored as ${existing.kind}, not ${expectedKind}`,
    );
  }
  return existing.id;
};
