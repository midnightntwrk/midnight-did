import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";

export type ReferencedVerificationMethodRelation =
  | VerificationMethodRelationType.Authentication
  | VerificationMethodRelationType.AssertionMethod
  | VerificationMethodRelationType.KeyAgreement
  | VerificationMethodRelationType.CapabilityInvocation
  | VerificationMethodRelationType.CapabilityDelegation;

/**
 * Raised when a verification method cannot be removed because one or more DID
 * Core verification relationships still reference its physical ledger id.
 */
export class VerificationMethodReferencedError extends Error {
  readonly code = "verification_method_referenced" as const;
  readonly methodId: string;
  readonly relations: readonly ReferencedVerificationMethodRelation[];

  constructor(
    methodId: string,
    relations: readonly ReferencedVerificationMethodRelation[],
  ) {
    super(
      `verification method ${methodId} is still referenced by verification relationships: ${relations.join(", ")}`,
    );
    this.name = "VerificationMethodReferencedError";
    this.methodId = methodId;
    this.relations = Object.freeze([...relations]);
  }
}
