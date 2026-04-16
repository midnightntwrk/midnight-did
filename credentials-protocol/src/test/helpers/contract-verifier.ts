import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";

import {
  type AccessDecision,
  type BirthCredential,
  type BirthCredentialPresentation,
  type BirthCredentialPresentationRequest,
  type Proof,
} from "../../../../credentials-demo-contract/src/managed/demo/contract/index.js";
import { CredentialsDemoSimulator } from "../../../../credentials-demo-contract/src/testing.js";

const ACCESS_DECISION_LABELS: Record<number, string> = {
  0: "noDecision",
  1: "approved",
  2: "unknownCapability",
  3: "alreadyConsumed",
};

export type ContractPresentationPackage = {
  readonly presentation: BirthCredentialPresentation;
  readonly presentationProof: Proof;
  readonly currentDay: bigint;
  readonly birthDateDays: bigint;
  readonly birthDateOpening: Uint8Array;
};

export class ContractVerifier {
  private readonly simulator: CredentialsDemoSimulator;

  constructor() {
    this.simulator = new CredentialsDemoSimulator();
  }

  /**
   * Register a credential with the contract so it knows about it.
   */
  issueBirthCredential(
    credential: BirthCredential,
    credentialProof: Proof,
    holderPublicKey: JubjubPoint,
  ): void {
    this.simulator.issueBirthCredential(
      credential,
      credentialProof,
      holderPublicKey,
    );
  }

  /**
   * Get the contract's typed age-gate request.
   * The contract builds a presentation request with its own policy
   * (e.g. require birth country disclosure, age >= 18).
   */
  getAgeGateRequest(
    issuerVerificationMethodRef: BirthCredential["issuerVerificationMethodRef"],
    verifierChallengeHash: Uint8Array,
  ): BirthCredentialPresentationRequest {
    return this.simulator.ageGateRequest(
      issuerVerificationMethodRef,
      verifierChallengeHash,
    );
  }

  /**
   * Verify a presentation and issue a capability token.
   * The contract verifies the credential, presentation, and age predicate,
   * then mints a capability hash that can be claimed later.
   */
  issueAgeGateCapability(
    credential: BirthCredential,
    credentialProof: Proof,
    verifierChallengeHash: Uint8Array,
    pkg: ContractPresentationPackage,
  ): { capabilityHash: Uint8Array } {
    // Set the private witness data so the contract can check the age predicate
    this.simulator.setAgeWitness(pkg.birthDateDays, pkg.birthDateOpening);

    const capabilityHash = this.simulator.issueAgeGateCapability(
      credential,
      credentialProof,
      pkg.presentation,
      pkg.presentationProof,
      verifierChallengeHash,
      pkg.currentDay,
    );

    return { capabilityHash };
  }

  /**
   * Claim a previously issued capability.
   * Returns a human-readable access decision string.
   */
  claimCapability(capabilityHash: Uint8Array): string {
    const decision: AccessDecision =
      this.simulator.claimAgeGateCapability(capabilityHash);
    return ACCESS_DECISION_LABELS[decision as number] ?? `unknown(${decision})`;
  }
}
