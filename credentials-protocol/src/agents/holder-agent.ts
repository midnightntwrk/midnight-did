import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";

import {
  type Proof,
  pureCircuits as genericPureCircuits,
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
import { assertMessageType, assertBodyHasFields } from "../shared/validation.js";
import { mod, sha256 } from "../shared/crypto.js";
import { createEnvelope } from "../shared/envelope.js";

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
    assertMessageType(offer, "issuance:offer");
    assertBodyHasFields(offer, ["envelope", "schema", "body"]);
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
    assertMessageType(result, "issuance:result");
    assertBodyHasFields(result, ["envelope", "schema", "body"]);
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
    // TEST ONLY: production must use cryptographically random nonces.
    // Reusing a nonce across Schnorr signatures leaks the private key.
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
    assertMessageType(requestMessage, "presentation:request");
    assertBodyHasFields(requestMessage, ["version", "schema", "verifierChallengeHash"]);
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
