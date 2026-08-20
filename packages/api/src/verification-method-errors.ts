import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";

import { MidnightDidApiError } from "./api-errors.js";

export type ReferencedVerificationMethodRelation =
  | VerificationMethodRelationType.Authentication
  | VerificationMethodRelationType.AssertionMethod
  | VerificationMethodRelationType.KeyAgreement
  | VerificationMethodRelationType.CapabilityInvocation
  | VerificationMethodRelationType.CapabilityDelegation;

export type VerificationMethodErrorCode = "verification_method_referenced";

/**
 * Raised when a verification method cannot be removed because one or more DID
 * Core verification relationships still reference its physical ledger id.
 */
export class VerificationMethodReferencedError extends MidnightDidApiError<VerificationMethodErrorCode> {
  readonly methodId: string;
  readonly relations: readonly ReferencedVerificationMethodRelation[];

  constructor(
    methodId: string,
    relations: readonly ReferencedVerificationMethodRelation[],
  ) {
    super(
      "verification_method_referenced",
      `verification method ${methodId} is still referenced by verification relationships: ${relations.join(", ")}`,
    );
    this.name = "VerificationMethodReferencedError";
    this.methodId = methodId;
    this.relations = Object.freeze([...relations]);
  }
}
