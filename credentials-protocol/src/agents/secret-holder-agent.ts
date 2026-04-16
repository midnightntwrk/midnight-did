import { createHash } from "node:crypto";

import {
  type Proof,
  pureCircuits as genericPureCircuits,
  type ProtocolMessageEnvelope,
  HolderBindingProfile,
  type BlindedSecretHolderBinding,
  type BirthCredentialPresentationRequest,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type SecretBirthCredential,
  type SecretBirthCredentialPresentation,
} from "../../../credentials-birth-secret/src/managed/secret-birth-credential/contract/index.js";

import type { ProtocolMessage } from "../transport/types.js";
import { MessageBus } from "../transport/message-bus.js";
import type {
  SecretIssuanceOffer,
  SecretIssuanceResult,
} from "./secret-issuer-agent.js";
import type { SecretPresentationSubmissionBody } from "./verifier-agent.js";

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

export type SecretPresentationWitness = {
  readonly credentialIndex: number;
  readonly currentDay: bigint;
  readonly birthDateDays: bigint;
  readonly birthDateOpening: Uint8Array;
  readonly birthCountryCodePadded: Uint8Array;
  readonly birthCountryCodeOpening: Uint8Array;
};

export class SecretHolderAgent {
  private readonly label: string;
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
    if (offer.type !== "issuance:offer") {
      throw new Error(
        `Expected issuance:offer message, got ${offer.type}`,
      );
    }

    const issuanceOffer = offer.body as SecretIssuanceOffer;
    const challengeHash = sha256("challenge:issuance");

    const holderSecretCommitment =
      genericPureCircuits.secretHolderBindingCommitment(
        this.holderSecret,
        this.holderSecretOpening,
      );

    const holderBindingBlindingFactor = sha256("blinding:holder-secret");

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

    // Store the blinding factor so we can include it in credential storage
    this._pendingBlindingFactor = holderBindingBlindingFactor;

    this.bus.send({
      type: "issuance:request",
      from: this.label,
      to: offer.from,
      envelope: request.envelope,
      body: request,
    });
  }

  private _pendingBlindingFactor: Uint8Array | undefined;

  receiveCredentialResult(result: ProtocolMessage): void {
    if (result.type !== "issuance:result") {
      throw new Error(
        `Expected issuance:result message, got ${result.type}`,
      );
    }

    const issuanceResult = result.body as SecretIssuanceResult;
    this.credentials.push({
      credential: issuanceResult.body.credential,
      credentialProof: issuanceResult.body.credentialProof,
      holderBindingBlindingFactor:
        this._pendingBlindingFactor ?? sha256("blinding:holder-secret"),
    });
    this._pendingBlindingFactor = undefined;
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
    if (requestMessage.type !== "presentation:request") {
      throw new Error(
        `Expected presentation:request message, got ${requestMessage.type}`,
      );
    }

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
      request,
      currentDay: witnessData.currentDay,
      birthDateDays: witnessData.birthDateDays,
      birthDateOpening: witnessData.birthDateOpening,
      holderSecret: this.holderSecret,
      holderSecretOpening: this.holderSecretOpening,
      holderBindingBlindingFactor: stored.holderBindingBlindingFactor,
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
}
