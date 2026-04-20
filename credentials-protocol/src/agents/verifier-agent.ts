import {
  type Proof,
  type VerificationMethodRef,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type BirthCredential,
  type BirthCredentialPresentation,
  type BirthCredentialPresentationRequest,
  type BirthCredentialVerificationRequest,
  type BirthCredentialVerificationResult,
  type BirthCredentialVerificationSubmission,
  HolderBindingProfile,
  pureCircuits,
} from "../../../credentials-birth/src/managed/birth-credential/contract/index.js";
import {
  pureCircuits as secretPureCircuits,
  type SecretBirthCredentialVerificationRequest,
  type SecretBirthCredentialVerificationResult,
  type SecretBirthCredentialVerificationSubmission,
} from "../../../credentials-birth-secret/src/managed/secret-birth-credential/contract/index.js";
import { padText,sha256 } from "../shared/crypto.js";
import { createEnvelope } from "../shared/envelope.js";
import { assertBodyHasFields,assertMessageType } from "../shared/validation.js";
import type { MessageBus } from "../transport/message-bus.js";
import type { PartyId,ProtocolMessage } from "../transport/types.js";
import type {
  SameHolderPresentation,
  SameHolderTriplePresentation,
} from "./secret-holder-agent.js";
import type { DIDProfile } from "./types.js";

export type PresentationRequirements = {
  readonly issuerVerificationMethodRef: VerificationMethodRef;
  readonly requireSubjectIdCommitmentDisclosure: boolean;
  readonly requireBirthCountryDisclosure: boolean;
  readonly requireAgeOverThreshold: boolean;
  readonly requestedAgeThresholdYears: number;
};

const BIRTH_SCHEMA = {
  packageId: padText("midnight-did:vc:birth"),
  schemaId: padText("birth-credential:v1"),
  majorVersion: 1n,
  minorVersion: 0n,
};

const EXPLICIT_HOLDER_FEATURES = {
  supportsSelectiveDisclosure: true,
  supportsPredicateProofs: true,
  supportsVerifierScopedPseudonym: false,
  supportsSameHolderProof: false,
};

const SECRET_HOLDER_FEATURES = {
  supportsSelectiveDisclosure: true,
  supportsPredicateProofs: true,
  supportsVerifierScopedPseudonym: true,
  supportsSameHolderProof: true,
};

export type PresentationSubmissionBody = {
  readonly credential: BirthCredential;
  readonly credentialProof: Proof;
  readonly presentation: BirthCredentialPresentation;
  readonly presentationProof: Proof;
};

/**
 * Private witness data needed only by the Compact simulator to evaluate
 * age predicates. In a real ZK deployment the verifier never sees this --
 * the circuit proves the predicate without revealing the inputs.
 * This type is intended for test use only.
 */
export type SimulatorWitness = {
  readonly request: BirthCredentialVerificationRequest;
  readonly currentDay: bigint;
  readonly birthDateDays: bigint;
  readonly birthDateOpening: Uint8Array;
};

export type SecretPresentationRequirements = {
  readonly issuerVerificationMethodRef: VerificationMethodRef;
  readonly requireSubjectIdCommitmentDisclosure: boolean;
  readonly requireBirthCountryDisclosure: boolean;
  readonly requireVerifierScopedPseudonym: boolean;
  readonly verifierDomainHash?: Uint8Array;
  readonly requireAgeOverThreshold: boolean;
  readonly requestedAgeThresholdYears: number;
};

/**
 * Private witness data needed only by the Compact simulator to evaluate
 * secret-holder presentations. In a real ZK deployment the verifier never
 * sees the holder secret or its opening -- the circuit proves holder
 * binding and age predicates without revealing these inputs.
 * This type is intended for test use only.
 */
export type SecretSimulatorWitness = {
  readonly request: SecretBirthCredentialVerificationRequest;
  readonly currentDay: bigint;
  readonly birthDateDays: bigint;
  readonly birthDateOpening: Uint8Array;
  readonly holderSecret: Uint8Array;
  readonly holderSecretOpening: Uint8Array;
  readonly holderBindingBlindingFactor: Uint8Array;
};

/**
 * Private witness data needed only by the Compact simulator to verify
 * same-holder composition proofs. In a real ZK deployment the verifier
 * never sees the holder secret or blinding factors.
 * This type is intended for test use only.
 */
export type SameHolderSimulatorWitness = {
  readonly holderSecret: Uint8Array;
  readonly firstHolderSecretOpening: Uint8Array;
  readonly firstHolderBindingBlindingFactor: Uint8Array;
  readonly secondHolderSecretOpening: Uint8Array;
  readonly secondHolderBindingBlindingFactor: Uint8Array;
};

export type SameHolderTripleSimulatorWitness = SameHolderSimulatorWitness & {
  readonly thirdHolderSecretOpening: Uint8Array;
  readonly thirdHolderBindingBlindingFactor: Uint8Array;
};

export class VerifierAgent {
  private readonly profile: DIDProfile;
  private readonly bus: MessageBus;
  private challengeCounter = 0;

  constructor(profile: DIDProfile, bus: MessageBus) {
    this.profile = profile;
    this.bus = bus;
  }

  /** Generate a unique challenge hash per interaction. */
  generateChallengeHash(): Uint8Array {
    return sha256(
      `midnight:vc:verifier:${this.profile.label}:challenge:${this.challengeCounter++}`,
    );
  }

  /** @deprecated Use generateChallengeHash() for unique per-interaction challenges. */
  get verifierChallengeHash(): Uint8Array {
    return this.generateChallengeHash();
  }

  createAndSendPresentationRequest(
    holderLabel: PartyId,
    requirements: PresentationRequirements,
  ): void {
    const request: BirthCredentialVerificationRequest = {
      envelope: createEnvelope(
        "presentation-request",
        "birth-presentation",
        true,
      ),
      schema: BIRTH_SCHEMA,
      issuerVerificationMethodRef: requirements.issuerVerificationMethodRef,
      holderBindingProfile: HolderBindingProfile.explicitDid,
      features: EXPLICIT_HOLDER_FEATURES,
      verifierChallengeHash: this.generateChallengeHash(),
      body: {
        requireSubjectIdCommitmentDisclosure:
          requirements.requireSubjectIdCommitmentDisclosure,
        requireBirthCountryDisclosure:
          requirements.requireBirthCountryDisclosure,
        requireAgeOverThreshold: requirements.requireAgeOverThreshold,
        requestedAgeThresholdYears: BigInt(
          requirements.requestedAgeThresholdYears,
        ),
      },
    };

    this.bus.send({
      type: "presentation:request",
      from: this.profile.label,
      to: holderLabel,
      envelope: request.envelope,
      body: request,
    });
  }

  receiveSubmissionAndEvaluate(
    submission: ProtocolMessage,
    simulatorWitness: SimulatorWitness,
  ): { approved: boolean; result: BirthCredentialVerificationResult } {
    assertMessageType(submission, "presentation:submission");
    assertBodyHasFields(submission, ["envelope", "schema", "body"]);
    const submissionMessage =
      submission.body as BirthCredentialVerificationSubmission;
    const body = submissionMessage.body;
    const presentationRequest =
      pureCircuits.birthCredentialPresentationRequestFromProtocol(
        simulatorWitness.request,
      );

    pureCircuits.assertValidBirthCredentialVerificationRequestMessage(
      simulatorWitness.request,
    );
    pureCircuits.assertBirthCredentialVerificationSubmissionMatchesRequest(
      simulatorWitness.request,
      submissionMessage,
    );

    // Validate the credential and presentation signatures
    pureCircuits.assertValidBirthCredentialPresentation(
      body.credential,
      body.credentialProof,
      body.presentation,
      body.presentationProof,
    );

    // Verify the presentation satisfies the request
    pureCircuits.assertBirthPresentationSatisfiesRequest(
      body.credential,
      presentationRequest,
      body.presentation,
      body.presentationProof,
    );

    // If an age predicate was requested, validate it
    if (presentationRequest.requireAgeOverThreshold) {
      pureCircuits.assertValidBirthCredentialAgePredicate(
        body.credential,
        body.presentation,
        simulatorWitness.currentDay,
        simulatorWitness.birthDateDays,
        simulatorWitness.birthDateOpening,
      );
    }

    const result: BirthCredentialVerificationResult = {
      envelope: createEnvelope(
        "presentation-result",
        "birth-presentation",
        false,
        submissionMessage.envelope.messageId,
        submissionMessage.envelope.threadId,
      ),
      approved: true,
      body: {
        credentialRoot: pureCircuits.birthCredentialBodyRoot(body.credential),
        verifiedThresholdYears:
          presentationRequest.requestedAgeThresholdYears,
      },
    };

    pureCircuits.assertBirthCredentialVerificationResultMatchesSubmission(
      submissionMessage,
      result,
    );

    return { approved: true, result };
  }

  // --- Secret-holder presentation methods ---

  createAndSendSecretPresentationRequest(
    holderLabel: PartyId,
    requirements: SecretPresentationRequirements,
  ): void {
    const SECRET_BIRTH_SCHEMA = {
      packageId: padText("midnight-did:vc:birth-secret"),
      schemaId: padText("birth-credential:v1"),
      majorVersion: 1n,
      minorVersion: 0n,
    };

    const request: SecretBirthCredentialVerificationRequest = {
      envelope: createEnvelope(
        "secret-presentation-request",
        "secret-birth-presentation",
        true,
      ),
      schema: SECRET_BIRTH_SCHEMA,
      issuerVerificationMethodRef: requirements.issuerVerificationMethodRef,
      holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
      features: SECRET_HOLDER_FEATURES,
      verifierChallengeHash: this.generateChallengeHash(),
      body: {
        requireSubjectIdCommitmentDisclosure:
          requirements.requireSubjectIdCommitmentDisclosure,
        requireBirthCountryDisclosure:
          requirements.requireBirthCountryDisclosure,
        requireVerifierScopedPseudonym:
          requirements.requireVerifierScopedPseudonym,
        verifierDomainHash:
          requirements.verifierDomainHash ?? new Uint8Array(32),
        requireAgeOverThreshold: requirements.requireAgeOverThreshold,
        requestedAgeThresholdYears: BigInt(
          requirements.requestedAgeThresholdYears,
        ),
      },
    };

    this.bus.send({
      type: "presentation:request",
      from: this.profile.label,
      to: holderLabel,
      envelope: request.envelope,
      body: request,
    });
  }

  receiveSecretSubmissionAndEvaluate(
    submission: ProtocolMessage,
    simulatorWitness: SecretSimulatorWitness,
  ): {
    approved: boolean;
    pseudonym?: Uint8Array;
    result: SecretBirthCredentialVerificationResult;
  } {
    assertMessageType(submission, "presentation:submission");
    assertBodyHasFields(submission, ["envelope", "schema", "body"]);
    const submissionMessage =
      submission.body as SecretBirthCredentialVerificationSubmission;
    const body = submissionMessage.body;

    secretPureCircuits.assertValidSecretBirthCredentialVerificationRequestMessage(
      simulatorWitness.request,
    );
    secretPureCircuits.assertSecretBirthCredentialVerificationSubmissionMatchesRequest(
      simulatorWitness.request,
      submissionMessage,
      simulatorWitness.holderSecret,
      simulatorWitness.holderSecretOpening,
      simulatorWitness.holderBindingBlindingFactor,
    );

    // Validate the credential and presentation
    secretPureCircuits.assertValidSecretBirthCredentialPresentation(
      body.credential,
      body.credentialProof,
      body.presentation,
    );

    // Verify the presentation satisfies the request (requires witness for simulator)
    secretPureCircuits.assertSecretBirthPresentationSatisfiesRequest(
      body.credential,
      body.credentialProof,
      secretPureCircuits.secretBirthCredentialPresentationRequestFromProtocol(
        simulatorWitness.request,
      ),
      body.presentation,
      simulatorWitness.holderSecret,
      simulatorWitness.holderSecretOpening,
      simulatorWitness.holderBindingBlindingFactor,
    );

    // If an age predicate was requested, validate it
    if (simulatorWitness.request.body.requireAgeOverThreshold) {
      secretPureCircuits.assertValidSecretBirthCredentialAgePredicate(
        body.credential,
        body.presentation,
        simulatorWitness.currentDay,
        simulatorWitness.birthDateDays,
        simulatorWitness.birthDateOpening,
      );
    }

    // Extract pseudonym if it was disclosed
    const pseudonym = body.presentation.disclosed.revealVerifierScopedPseudonym
      ? body.presentation.disclosed.verifierScopedPseudonym
      : undefined;

    const result: SecretBirthCredentialVerificationResult = {
      envelope: createEnvelope(
        "secret-presentation-result",
        "secret-birth-presentation",
        false,
        submissionMessage.envelope.messageId,
        submissionMessage.envelope.threadId,
      ),
      approved: true,
      body: {
        credentialRoot: secretPureCircuits.secretBirthCredentialBodyRoot(
          body.credential,
        ),
        verifiedThresholdYears:
          simulatorWitness.request.body.requestedAgeThresholdYears,
        hasVerifierScopedPseudonym: pseudonym != null,
        verifierScopedPseudonym: pseudonym ?? new Uint8Array(32),
      },
    };

    secretPureCircuits.assertSecretBirthCredentialVerificationResultMatchesSubmission(
      submissionMessage,
      result,
    );

    return { approved: true, pseudonym, result };
  }

  // --- Same-holder composition methods ---

  generateChallenge(): Uint8Array {
    return this.generateChallengeHash();
  }

  verifySameHolderProof(
    presentation: SameHolderPresentation,
    simulatorWitness: SameHolderSimulatorWitness,
  ): { sameHolder: boolean } {
    secretPureCircuits.assertSameHolderSecretBirthPresentations(
      presentation.firstCredential,
      presentation.firstCredentialProof,
      presentation.firstRequest,
      presentation.firstPresentation,
      presentation.secondCredential,
      presentation.secondCredentialProof,
      presentation.secondRequest,
      presentation.secondPresentation,
      simulatorWitness.holderSecret,
      simulatorWitness.firstHolderSecretOpening,
      simulatorWitness.firstHolderBindingBlindingFactor,
      simulatorWitness.secondHolderSecretOpening,
      simulatorWitness.secondHolderBindingBlindingFactor,
    );

    return { sameHolder: true };
  }

  verifySameHolderProof3(
    presentation: SameHolderTriplePresentation,
    simulatorWitness: SameHolderTripleSimulatorWitness,
  ): { sameHolder: boolean } {
    secretPureCircuits.assertSameHolderSecretBirthPresentations3(
      presentation.firstCredential,
      presentation.firstCredentialProof,
      presentation.firstRequest,
      presentation.firstPresentation,
      presentation.secondCredential,
      presentation.secondCredentialProof,
      presentation.secondRequest,
      presentation.secondPresentation,
      presentation.thirdCredential,
      presentation.thirdCredentialProof,
      presentation.thirdRequest,
      presentation.thirdPresentation,
      simulatorWitness.holderSecret,
      simulatorWitness.firstHolderSecretOpening,
      simulatorWitness.firstHolderBindingBlindingFactor,
      simulatorWitness.secondHolderSecretOpening,
      simulatorWitness.secondHolderBindingBlindingFactor,
      simulatorWitness.thirdHolderSecretOpening,
      simulatorWitness.thirdHolderBindingBlindingFactor,
    );

    return { sameHolder: true };
  }
}
