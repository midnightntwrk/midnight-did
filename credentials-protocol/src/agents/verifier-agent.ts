import { createHash } from "node:crypto";

import {
  type Proof,
  pureCircuits as genericPureCircuits,
  type ProtocolMessageEnvelope,
  type VerificationMethodRef,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type BirthCredential,
  type BirthCredentialPresentation,
  type BirthCredentialPresentationRequest,
  pureCircuits,
} from "../../../credentials-birth/src/managed/birth-credential/contract/index.js";

import type { DIDProfile } from "./types.js";
import type { ProtocolMessage, PartyId } from "../transport/types.js";
import { MessageBus } from "../transport/message-bus.js";

const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

const padText = (value: string, length = 32): Uint8Array => {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length >= length) return bytes.subarray(0, length);
  const padded = new Uint8Array(length);
  padded.set(bytes);
  return padded;
};

const createEnvelope = (
  label: string,
  threadLabel: string,
  initial: boolean,
  respondsTo?: Uint8Array,
): ProtocolMessageEnvelope => ({
  version: 1n,
  messageId: sha256(`protocol:message:${label}`),
  threadId: sha256(`protocol:thread:${threadLabel}`),
  initialMessage: initial,
  respondsToMessageId:
    respondsTo ?? genericPureCircuits.noProtocolResponseReference(),
  createdAt: BigInt(Date.now()),
  hasExpiresAt: false,
  expiresAt: 0n,
});

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

export type PresentationSubmissionBody = {
  readonly credential: BirthCredential;
  readonly credentialProof: Proof;
  readonly presentation: BirthCredentialPresentation;
  readonly presentationProof: Proof;
  readonly request: BirthCredentialPresentationRequest;
  readonly currentDay: bigint;
  readonly birthDateDays: bigint;
  readonly birthDateOpening: Uint8Array;
};

export class VerifierAgent {
  private readonly profile: DIDProfile;
  private readonly bus: MessageBus;

  constructor(profile: DIDProfile, bus: MessageBus) {
    this.profile = profile;
    this.bus = bus;
  }

  get verifierChallengeHash(): Uint8Array {
    return sha256(`midnight:vc:verifier:${this.profile.label}:challenge`);
  }

  createAndSendPresentationRequest(
    holderLabel: PartyId,
    requirements: PresentationRequirements,
  ): void {
    const request: BirthCredentialPresentationRequest = {
      version: 1n,
      schema: BIRTH_SCHEMA,
      issuerVerificationMethodRef: requirements.issuerVerificationMethodRef,
      requireSubjectIdCommitmentDisclosure:
        requirements.requireSubjectIdCommitmentDisclosure,
      requireBirthCountryDisclosure:
        requirements.requireBirthCountryDisclosure,
      requireAgeOverThreshold: requirements.requireAgeOverThreshold,
      requestedAgeThresholdYears: BigInt(
        requirements.requestedAgeThresholdYears,
      ),
      verifierChallengeHash: this.verifierChallengeHash,
    };

    this.bus.send({
      type: "presentation:request",
      from: this.profile.label,
      to: holderLabel,
      envelope: createEnvelope(
        "presentation-request",
        "birth-presentation",
        true,
      ),
      body: request,
    });
  }

  receiveSubmissionAndEvaluate(
    submission: ProtocolMessage,
  ): { approved: boolean } {
    if (submission.type !== "presentation:submission") {
      throw new Error(
        `Expected presentation:submission message, got ${submission.type}`,
      );
    }

    const body = submission.body as PresentationSubmissionBody;

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
      body.request,
      body.presentation,
      body.presentationProof,
    );

    // If an age predicate was requested, validate it
    if (body.request.requireAgeOverThreshold) {
      pureCircuits.assertValidBirthCredentialAgePredicate(
        body.credential,
        body.presentation,
        body.currentDay,
        body.birthDateDays,
        body.birthDateOpening,
      );
    }

    return { approved: true };
  }
}
