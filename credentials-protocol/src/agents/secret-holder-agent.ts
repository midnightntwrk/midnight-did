import {
  type Proof,
  pureCircuits as genericPureCircuits,
  HolderBindingProfile,
  type BirthCredentialPresentationRequest,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type SecretBirthCredential,
  type SecretBirthCredentialPresentation,
  type BirthCredentialPresentationRequest as SecretBirthPresentationRequest,
} from "../../../credentials-birth-secret/src/managed/secret-birth-credential/contract/index.js";

import type { ProtocolMessage } from "../transport/types.js";
import { MessageBus } from "../transport/message-bus.js";
import type {
  SecretIssuanceOffer,
  SecretIssuanceResult,
} from "./secret-issuer-agent.js";
import type { SecretPresentationSubmissionBody } from "./verifier-agent.js";
import { assertMessageType, assertBodyHasFields } from "../shared/validation.js";
import { sha256, padText } from "../shared/crypto.js";
import { createEnvelope } from "../shared/envelope.js";

const SECRET_BIRTH_SCHEMA = {
  packageId: padText("midnight-did:vc:birth-secret"),
  schemaId: padText("birth-credential:v1"),
  majorVersion: 1n,
  minorVersion: 0n,
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
  readonly firstRequest: SecretBirthPresentationRequest;
  readonly firstPresentation: SecretBirthCredentialPresentation;
  readonly secondCredential: SecretBirthCredential;
  readonly secondCredentialProof: Proof;
  readonly secondRequest: SecretBirthPresentationRequest;
  readonly secondPresentation: SecretBirthCredentialPresentation;
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
    const issuanceOffer = offer.body as SecretIssuanceOffer;
    const challengeHash = sha256("challenge:issuance");

    const holderSecretCommitment =
      genericPureCircuits.secretHolderBindingCommitment(
        this.holderSecret,
        this.holderSecretOpening,
      );

    // TEST ONLY: production must use a unique random blinding factor per issuance.
    const blindingIndex = this.credentials.length;
    const holderBindingBlindingFactor = sha256(`blinding:holder-secret:${blindingIndex}`);

    const request = {
      envelope: createEnvelope(
        "secret-issuance-request",
        "secret-birth-issuance",
        false,
        issuanceOffer.envelope.messageId,
      ),
      schema: SECRET_BIRTH_SCHEMA,
      issuerVerificationMethodRef: issuanceOffer.issuerVerificationMethodRef,
      holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
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
    const issuanceResult = result.body as SecretIssuanceResult;
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
    assertBodyHasFields(requestMessage, ["version", "schema", "verifierChallengeHash"]);
    const request =
      requestMessage.body as BirthCredentialPresentationRequest;
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
          request.requireSubjectIdCommitmentDisclosure,
        subjectIdCommitment: request.requireSubjectIdCommitmentDisclosure
          ? credential.claims.subjectIdCommitment
          : new Uint8Array(32),
        revealBirthCountryCode: request.requireBirthCountryDisclosure,
        birthCountryCodePadded: request.requireBirthCountryDisclosure
          ? witnessData.birthCountryCodePadded
          : new Uint8Array(32),
        birthCountryCodeOpening: request.requireBirthCountryDisclosure
          ? witnessData.birthCountryCodeOpening
          : new Uint8Array(32),
        revealVerifierScopedPseudonym:
          request.requireVerifierScopedPseudonym,
        verifierScopedPseudonym: request.requireVerifierScopedPseudonym
          ? genericPureCircuits.verifierScopedPseudonym(
              this.holderSecret,
              request.verifierDomainHash,
            )
          : new Uint8Array(32),
        proveAgeOverThreshold: request.requireAgeOverThreshold,
        ageThresholdYears: request.requestedAgeThresholdYears,
      },
    };

    const submissionBody: SecretPresentationSubmissionBody = {
      credential: stored.credential,
      credentialProof: stored.credentialProof,
      presentation,
    };

    this.bus.send({
      type: "presentation:submission",
      from: this.label,
      to: requestMessage.from,
      envelope: createEnvelope(
        "secret-presentation-submission",
        "secret-birth-presentation",
        false,
        requestMessage.envelope.messageId,
      ),
      body: submissionBody,
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

  private _buildSameHolderProofForPair(
    first: SecretStoredCredential,
    second: SecretStoredCredential,
    verifierChallengeHash: Uint8Array,
  ): SameHolderPresentation {
    const buildRequest = (
      credential: SecretBirthCredential,
    ): SecretBirthPresentationRequest => ({
      version: 1n,
      schema: credential.schema,
      issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: false,
      requireVerifierScopedPseudonym: false,
      verifierDomainHash: new Uint8Array(32),
      requireAgeOverThreshold: false,
      requestedAgeThresholdYears: 0n,
      verifierChallengeHash,
    });

    const buildPresentation = (
      credential: SecretBirthCredential,
      request: SecretBirthPresentationRequest,
    ): SecretBirthCredentialPresentation => ({
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
    });

    const firstRequest = buildRequest(first.credential);
    const secondRequest = buildRequest(second.credential);
    const firstPresentation = buildPresentation(first.credential, firstRequest);
    const secondPresentation = buildPresentation(
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
}
