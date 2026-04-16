import { createHash } from "node:crypto";

import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";

import {
  type Proof,
  pureCircuits as genericPureCircuits,
  type ProtocolMessageEnvelope,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type BirthCredential,
  type BirthCredentialIssuanceOffer,
  type BirthCredentialIssuanceRequest,
  type BirthCredentialIssuanceResult,
  type BirthCredentialPresentation,
  type BirthCredentialPresentationRequest,
  HolderBindingProfile,
  pureCircuits,
} from "../../../credentials-birth/src/managed/birth-credential/contract/index.js";

import type { DIDProfile } from "./types.js";
import type { ProtocolMessage } from "../transport/types.js";
import { MessageBus } from "../transport/message-bus.js";
import type { PresentationSubmissionBody } from "./verifier-agent.js";

const JUBJUB_FIELD_MODULUS =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

const mod = (value: bigint): bigint => {
  const reduced = value % JUBJUB_FIELD_MODULUS;
  return reduced >= 0n ? reduced : reduced + JUBJUB_FIELD_MODULUS;
};

const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

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

export type StoredCredential = {
  readonly credential: BirthCredential;
  readonly credentialProof: Proof;
};

export type PresentationWitness = {
  readonly credentialIndex: number;
  readonly currentDay: bigint;
  readonly birthDateDays: bigint;
  readonly birthDateOpening: Uint8Array;
  readonly birthCountryCodePadded: Uint8Array;
  readonly birthCountryCodeOpening: Uint8Array;
};

export class HolderAgent {
  private readonly profile: DIDProfile;
  private readonly bus: MessageBus;
  private readonly credentials: StoredCredential[] = [];

  constructor(profile: DIDProfile, bus: MessageBus) {
    this.profile = profile;
    this.bus = bus;
  }

  receiveOfferAndSendRequest(offer: ProtocolMessage): void {
    if (offer.type !== "issuance:offer") {
      throw new Error(
        `Expected issuance:offer message, got ${offer.type}`,
      );
    }

    const issuanceOffer = offer.body as BirthCredentialIssuanceOffer;
    const challengeHash = sha256("challenge:issuance");

    const request: BirthCredentialIssuanceRequest = {
      envelope: createEnvelope(
        "issuance-request",
        "birth-issuance",
        false,
        issuanceOffer.envelope.messageId,
      ),
      schema: issuanceOffer.schema,
      issuerVerificationMethodRef: issuanceOffer.issuerVerificationMethodRef,
      holderBindingProfile: HolderBindingProfile.explicitDid,
      body: {
        holderBinding: {
          holderVerificationMethodRef:
            this.profile.signer.verificationMethodRef,
        },
        holderPublicKey: this.profile.signer.publicKey,
        holderChallengeHash: challengeHash,
        requestExpiration: true,
        requestedExpirationDays: 365n,
      },
    };

    this.bus.send({
      type: "issuance:request",
      from: this.profile.label,
      to: offer.from,
      envelope: request.envelope,
      body: request,
    });
  }

  receiveCredentialResult(result: ProtocolMessage): void {
    if (result.type !== "issuance:result") {
      throw new Error(
        `Expected issuance:result message, got ${result.type}`,
      );
    }

    const issuanceResult = result.body as BirthCredentialIssuanceResult;
    this.credentials.push({
      credential: issuanceResult.body.credential,
      credentialProof: issuanceResult.body.credentialProof,
    });
  }

  get credentialCount(): number {
    return this.credentials.length;
  }

  getCredential(index: number): StoredCredential {
    if (index < 0 || index >= this.credentials.length) {
      throw new RangeError(
        `Credential index ${index} out of range [0, ${this.credentials.length})`,
      );
    }
    return this.credentials[index];
  }

  buildPresentationForContract(
    credentialIndex: number,
    request: BirthCredentialPresentationRequest,
    witnessData: PresentationWitness,
  ): { presentation: BirthCredentialPresentation; presentationProof: Proof } {
    const stored = this.getCredential(credentialIndex);
    const credential = stored.credential;

    const presentation: BirthCredentialPresentation = {
      version: 1n,
      schema: credential.schema,
      credentialClaimRoot: credential.claimRoot,
      issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
      holderBinding: credential.holderBinding,
      disclosed: {
        revealSubjectIdCommitment: request.requireSubjectIdCommitmentDisclosure,
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
        proveAgeOverThreshold: request.requireAgeOverThreshold,
        ageThresholdYears: request.requestedAgeThresholdYears,
      },
    };

    const bodyRoot =
      pureCircuits.birthCredentialPresentationBodyRoot(presentation);
    const nonceScalar = 17n;

    const proof: Proof = {
      signerVerificationMethodRef: this.profile.signer.verificationMethodRef,
      createdAt: BigInt(Date.now()),
      challengeHash: request.verifierChallengeHash,
      publicKey: this.profile.signer.publicKey,
      signature: {
        r: ecMulGenerator(nonceScalar),
        s: 0n,
      },
    };

    const challenge = genericPureCircuits.presentationProofChallenge(
      bodyRoot,
      proof,
    );

    const presentationProof: Proof = {
      ...proof,
      signature: {
        r: proof.signature.r,
        s: mod(nonceScalar + challenge * this.profile.signer.secretKey),
      },
    };

    return { presentation, presentationProof };
  }

  receiveRequestAndSendPresentation(
    requestMessage: ProtocolMessage,
    witnessData: PresentationWitness,
  ): void {
    if (requestMessage.type !== "presentation:request") {
      throw new Error(
        `Expected presentation:request message, got ${requestMessage.type}`,
      );
    }

    const request = requestMessage.body as BirthCredentialPresentationRequest;
    const stored = this.getCredential(witnessData.credentialIndex);

    const { presentation, presentationProof } =
      this.buildPresentationForContract(
        witnessData.credentialIndex,
        request,
        witnessData,
      );

    const submissionBody: PresentationSubmissionBody = {
      credential: stored.credential,
      credentialProof: stored.credentialProof,
      presentation,
      presentationProof,
      request,
      currentDay: witnessData.currentDay,
      birthDateDays: witnessData.birthDateDays,
      birthDateOpening: witnessData.birthDateOpening,
    };

    this.bus.send({
      type: "presentation:submission",
      from: this.profile.label,
      to: requestMessage.from,
      envelope: createEnvelope(
        "presentation-submission",
        "birth-presentation",
        false,
        requestMessage.envelope.messageId,
      ),
      body: submissionBody,
    });
  }
}
