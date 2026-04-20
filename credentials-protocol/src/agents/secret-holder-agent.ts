import { Buffer } from "node:buffer";

import {
  HolderBindingProfile,
  type Proof,
  pureCircuits as genericPureCircuits,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type SecretBirthCredential,
  type SecretBirthCredentialIssuanceOffer,
  type SecretBirthCredentialIssuanceRequest,
  type SecretBirthCredentialIssuanceResult,
  type SecretBirthCredentialPresentation,
  type SecretBirthCredentialVerificationRequest,
  type SecretBirthCredentialVerificationSubmission,
} from "../../../credentials-birth-secret/src/managed/secret-birth-credential/contract/index.js";
import { padText,sha256 } from "../shared/crypto.js";
import { createEnvelope } from "../shared/envelope.js";
import { assertBodyHasFields,assertMessageType } from "../shared/validation.js";
import type { MessageBus } from "../transport/message-bus.js";
import type { ProtocolMessage } from "../transport/types.js";

const SECRET_BIRTH_SCHEMA = {
  packageId: padText("midnight-did:vc:birth-secret"),
  schemaId: padText("birth-credential:v1"),
  majorVersion: 1n,
  minorVersion: 0n,
};

const SECRET_HOLDER_FEATURES = {
  supportsSelectiveDisclosure: true,
  supportsPredicateProofs: true,
  supportsVerifierScopedPseudonym: true,
  supportsSameHolderProof: true,
};

export type SecretStoredCredential = {
  readonly credential: SecretBirthCredential;
  readonly credentialProof: Proof;
  readonly holderBindingBlindingFactor: Uint8Array;
};

/**
 * Protocol data for a same-holder composition proof.
 * Contains only what would be transmitted to the verifier in a real protocol.
 */
export type SameHolderPresentation = {
  readonly firstCredential: SecretBirthCredential;
  readonly firstCredentialProof: Proof;
  readonly firstRequest: SecretBirthCredentialVerificationRequest;
  readonly firstPresentation: SecretBirthCredentialPresentation;
  readonly secondCredential: SecretBirthCredential;
  readonly secondCredentialProof: Proof;
  readonly secondRequest: SecretBirthCredentialVerificationRequest;
  readonly secondPresentation: SecretBirthCredentialPresentation;
};

export type SameHolderTriplePresentation = SameHolderPresentation & {
  readonly thirdCredential: SecretBirthCredential;
  readonly thirdCredentialProof: Proof;
  readonly thirdRequest: SecretBirthCredentialVerificationRequest;
  readonly thirdPresentation: SecretBirthCredentialPresentation;
};

export type SecretPresentationWitness = {
  readonly credentialIndex: number;
  readonly currentDay: bigint;
  readonly birthDateDays: bigint;
  readonly birthDateOpening: Uint8Array;
  readonly birthCountryCodePadded: Uint8Array;
  readonly birthCountryCodeOpening: Uint8Array;
};

export class SecretHolderAgent {
  readonly label: string;
  private readonly holderSecret: Uint8Array;
  private readonly holderSecretOpening: Uint8Array;
  private readonly bus: MessageBus;
  private readonly credentials: SecretStoredCredential[] = [];

  constructor(
    config: {
      readonly label: string;
      readonly holderSecret: Uint8Array;
      readonly holderSecretOpening: Uint8Array;
    },
    bus: MessageBus,
  ) {
    this.label = config.label;
    this.holderSecret = config.holderSecret;
    this.holderSecretOpening = config.holderSecretOpening;
    this.bus = bus;
  }

  receiveOfferAndSendRequest(offer: ProtocolMessage): void {
    assertMessageType(offer, "issuance:offer");
    assertBodyHasFields(offer, ["envelope", "schema", "body"]);
    const issuanceOffer = offer.body as SecretBirthCredentialIssuanceOffer;
    const challengeHash = sha256("challenge:issuance");

    const holderSecretCommitment =
      genericPureCircuits.secretHolderBindingCommitment(
        this.holderSecret,
        this.holderSecretOpening,
      );

    // TEST ONLY: production must use a unique random blinding factor per issuance.
    const blindingIndex = this.credentials.length;
    const holderBindingBlindingFactor = sha256(`blinding:holder-secret:${blindingIndex}`);

    const request: SecretBirthCredentialIssuanceRequest = {
      envelope: createEnvelope(
        "secret-issuance-request",
        "secret-birth-issuance",
        false,
        issuanceOffer.envelope.messageId,
        issuanceOffer.envelope.threadId,
      ),
      schema: issuanceOffer.schema,
      issuerVerificationMethodRef: issuanceOffer.issuerVerificationMethodRef,
      holderBindingProfile: issuanceOffer.holderBindingProfile,
      body: {
        holderSecretCommitment,
        holderBindingBlindingFactor,
        holderChallengeHash: challengeHash,
        requestExpiration: true,
        requestedExpirationDays: 365n,
      },
    };

    // Store the blinding factor keyed by request message ID for later retrieval
    const requestMessageId = Buffer.from(request.envelope.messageId).toString("hex");
    this.pendingBlindingFactors.set(requestMessageId, holderBindingBlindingFactor);

    this.bus.send({
      type: "issuance:request",
      from: this.label,
      to: offer.from,
      envelope: request.envelope,
      body: request,
    });
  }

  private readonly pendingBlindingFactors = new Map<string, Uint8Array>();

  receiveCredentialResult(result: ProtocolMessage): void {
    assertMessageType(result, "issuance:result");
    assertBodyHasFields(result, ["envelope", "schema", "body"]);
    const issuanceResult = result.body as SecretBirthCredentialIssuanceResult;
    const respondsToId = Buffer.from(result.envelope.respondsToMessageId).toString("hex");
    const blindingFactor = this.pendingBlindingFactors.get(respondsToId);
    if (!blindingFactor) {
      throw new Error(
        "No pending blinding factor found for this credential result. " +
        "Ensure receiveOfferAndSendRequest was called first.",
      );
    }
    this.pendingBlindingFactors.delete(respondsToId);

    this.credentials.push({
      credential: issuanceResult.body.credential,
      credentialProof: issuanceResult.body.credentialProof,
      holderBindingBlindingFactor: blindingFactor,
    });
  }

  get credentialCount(): number {
    return this.credentials.length;
  }

  getCredential(index: number): SecretStoredCredential {
    if (index < 0 || index >= this.credentials.length) {
      throw new RangeError(
        `Credential index ${index} out of range [0, ${this.credentials.length})`,
      );
    }
    return this.credentials[index];
  }

  /**
   * The holder secret is private. This accessor exposes it only so that
   * simulator-based tests can pass the witness data into the verifier's
   * circuit assertions. In a real ZK deployment the verifier never sees it.
   */
  get secretWitness(): {
    holderSecret: Uint8Array;
    holderSecretOpening: Uint8Array;
  } {
    return {
      holderSecret: this.holderSecret,
      holderSecretOpening: this.holderSecretOpening,
    };
  }

  receiveRequestAndSendPresentation(
    requestMessage: ProtocolMessage,
    witnessData: SecretPresentationWitness,
  ): void {
    assertMessageType(requestMessage, "presentation:request");
    assertBodyHasFields(requestMessage, ["envelope", "schema", "verifierChallengeHash", "body"]);
    const request =
      requestMessage.body as SecretBirthCredentialVerificationRequest;
    const stored = this.getCredential(witnessData.credentialIndex);
    const credential = stored.credential;

    const presentation: SecretBirthCredentialPresentation = {
      version: 1n,
      schema: credential.schema,
      credentialClaimRoot: credential.claimRoot,
      issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
      holderBinding: {
        blindedHolderSecretCommitment:
          credential.holderBinding.blindedHolderSecretCommitment,
        issuerNonce: credential.holderBinding.issuerNonce,
        requestChallengeResponse:
          genericPureCircuits.secretHolderBindingChallengeResponse(
            this.holderSecret,
            request.verifierChallengeHash,
          ),
      },
      disclosed: {
        revealSubjectIdCommitment:
          request.body.requireSubjectIdCommitmentDisclosure,
        subjectIdCommitment: request.body.requireSubjectIdCommitmentDisclosure
          ? credential.claims.subjectIdCommitment
          : new Uint8Array(32),
        revealBirthCountryCode: request.body.requireBirthCountryDisclosure,
        birthCountryCodePadded: request.body.requireBirthCountryDisclosure
          ? witnessData.birthCountryCodePadded
          : new Uint8Array(32),
        birthCountryCodeOpening: request.body.requireBirthCountryDisclosure
          ? witnessData.birthCountryCodeOpening
          : new Uint8Array(32),
        revealVerifierScopedPseudonym:
          request.body.requireVerifierScopedPseudonym,
        verifierScopedPseudonym: request.body.requireVerifierScopedPseudonym
          ? genericPureCircuits.verifierScopedPseudonym(
              this.holderSecret,
              request.body.verifierDomainHash,
            )
          : new Uint8Array(32),
        proveAgeOverThreshold: request.body.requireAgeOverThreshold,
        ageThresholdYears: request.body.requestedAgeThresholdYears,
      },
    };

    const submission: SecretBirthCredentialVerificationSubmission = {
      envelope: createEnvelope(
        "secret-presentation-submission",
        "secret-birth-presentation",
        false,
        requestMessage.envelope.messageId,
        requestMessage.envelope.threadId,
      ),
      schema: request.schema,
      issuerVerificationMethodRef: request.issuerVerificationMethodRef,
      holderBindingProfile: request.holderBindingProfile,
      challengeHash: request.verifierChallengeHash,
      body: {
        credential: stored.credential,
        credentialProof: stored.credentialProof,
        presentation,
      },
    };

    this.bus.send({
      type: "presentation:submission",
      from: this.label,
      to: requestMessage.from,
      envelope: submission.envelope,
      body: submission,
    });
  }

  /**
   * Build a same-holder proof for two stored credentials.
   * Both presentations use the same verifier challenge hash so the
   * verifier can confirm they share a single hidden holder secret.
   */
  buildSameHolderProof(
    credentialIndices: [number, number],
    verifierChallengeHash: Uint8Array,
  ): SameHolderPresentation {
    const first = this.getCredential(credentialIndices[0]);
    const second = this.getCredential(credentialIndices[1]);

    return this._buildSameHolderProofForPair(
      first,
      second,
      verifierChallengeHash,
    );
  }

  /**
   * Build a same-holder proof using two arbitrary stored credentials.
   * Useful for negative testing (e.g. mixing credentials that belong
   * to different holder secrets).
   */
  buildSameHolderProofWith(
    ownCredential: SecretStoredCredential,
    otherCredential: SecretStoredCredential,
    verifierChallengeHash: Uint8Array,
  ): SameHolderPresentation {
    return this._buildSameHolderProofForPair(
      ownCredential,
      otherCredential,
      verifierChallengeHash,
    );
  }

  /**
   * Build a same-holder proof for three stored credentials under one shared
   * verifier challenge.
   */
  buildSameHolderProof3(
    credentialIndices: [number, number, number],
    verifierChallengeHash: Uint8Array,
  ): SameHolderTriplePresentation {
    const first = this.getCredential(credentialIndices[0]);
    const second = this.getCredential(credentialIndices[1]);
    const third = this.getCredential(credentialIndices[2]);

    const pair = this._buildSameHolderProofForPair(
      first,
      second,
      verifierChallengeHash,
    );
    const thirdRequest = this._buildSameHolderRequest(
      third.credential,
      verifierChallengeHash,
    );
    const thirdPresentation = this._buildSameHolderPresentation(
      third.credential,
      thirdRequest,
    );

    return {
      ...pair,
      thirdCredential: third.credential,
      thirdCredentialProof: third.credentialProof,
      thirdRequest,
      thirdPresentation,
    };
  }

  private _buildSameHolderProofForPair(
    first: SecretStoredCredential,
    second: SecretStoredCredential,
    verifierChallengeHash: Uint8Array,
  ): SameHolderPresentation {
    const firstRequest = this._buildSameHolderRequest(
      first.credential,
      verifierChallengeHash,
    );
    const secondRequest = this._buildSameHolderRequest(
      second.credential,
      verifierChallengeHash,
    );
    const firstPresentation = this._buildSameHolderPresentation(
      first.credential,
      firstRequest,
    );
    const secondPresentation = this._buildSameHolderPresentation(
      second.credential,
      secondRequest,
    );

    return {
      firstCredential: first.credential,
      firstCredentialProof: first.credentialProof,
      firstRequest,
      firstPresentation,
      secondCredential: second.credential,
      secondCredentialProof: second.credentialProof,
      secondRequest,
      secondPresentation,
    };
  }

  private _buildSameHolderRequest(
    credential: SecretBirthCredential,
    verifierChallengeHash: Uint8Array,
  ): SecretBirthCredentialVerificationRequest {
    return {
      envelope: createEnvelope(
        "same-holder-presentation-request",
        "secret-birth-presentation",
        true,
      ),
      schema: credential.schema,
      issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
      holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
      features: SECRET_HOLDER_FEATURES,
      verifierChallengeHash,
      body: {
        requireSubjectIdCommitmentDisclosure: false,
        requireBirthCountryDisclosure: false,
        requireVerifierScopedPseudonym: false,
        verifierDomainHash: new Uint8Array(32),
        requireAgeOverThreshold: false,
        requestedAgeThresholdYears: 0n,
      },
    };
  }

  private _buildSameHolderPresentation(
    credential: SecretBirthCredential,
    request: SecretBirthCredentialVerificationRequest,
  ): SecretBirthCredentialPresentation {
    return {
      version: 1n,
      schema: credential.schema,
      credentialClaimRoot: credential.claimRoot,
      issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
      holderBinding: {
        blindedHolderSecretCommitment:
          credential.holderBinding.blindedHolderSecretCommitment,
        issuerNonce: credential.holderBinding.issuerNonce,
        requestChallengeResponse:
          genericPureCircuits.secretHolderBindingChallengeResponse(
            this.holderSecret,
            request.verifierChallengeHash,
          ),
      },
      disclosed: {
        revealSubjectIdCommitment: false,
        subjectIdCommitment: new Uint8Array(32),
        revealBirthCountryCode: false,
        birthCountryCodePadded: new Uint8Array(32),
        birthCountryCodeOpening: new Uint8Array(32),
        revealVerifierScopedPseudonym: false,
        verifierScopedPseudonym: new Uint8Array(32),
        proveAgeOverThreshold: false,
        ageThresholdYears: 0n,
      },
    };
  }
}
