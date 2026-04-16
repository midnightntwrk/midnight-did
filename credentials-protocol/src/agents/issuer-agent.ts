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
  HolderBindingProfile,
  pureCircuits,
} from "../../../credentials-birth/src/managed/birth-credential/contract/index.js";
import { mod, padText } from "../shared/crypto.js";
import { createEnvelope } from "../shared/envelope.js";
import { assertBodyHasFields,assertMessageType } from "../shared/validation.js";
import type { MessageBus } from "../transport/message-bus.js";
import type { PartyId,ProtocolMessage } from "../transport/types.js";
import type { DIDProfile } from "./types.js";

export type ClaimWitness = {
  readonly subjectId: Uint8Array;
  readonly subjectOpening: Uint8Array;
  readonly legalNamePadded: Uint8Array;
  readonly legalNameOpening: Uint8Array;
  readonly birthDateDays: bigint;
  readonly birthDateOpening: Uint8Array;
  readonly birthCountryCodePadded: Uint8Array;
  readonly birthCountryCodeOpening: Uint8Array;
  readonly issuedAt: bigint;
  readonly expiresAt: bigint;
};

const BIRTH_SCHEMA = {
  packageId: padText("midnight-did:vc:birth"),
  schemaId: padText("birth-credential:v1"),
  majorVersion: 1n,
  minorVersion: 0n,
};

const FEATURES = {
  supportsSelectiveDisclosure: true,
  supportsPredicateProofs: true,
  supportsVerifierScopedPseudonym: false,
  supportsSameHolderProof: false,
};

export class IssuerAgent {
  private readonly profile: DIDProfile;
  private readonly bus: MessageBus;

  constructor(profile: DIDProfile, bus: MessageBus) {
    this.profile = profile;
    this.bus = bus;
  }

  createAndSendOffer(holderLabel: PartyId): void {
    const offer: BirthCredentialIssuanceOffer = {
      envelope: createEnvelope("issuance-offer", "birth-issuance", true),
      schema: BIRTH_SCHEMA,
      issuerVerificationMethodRef: this.profile.signer.verificationMethodRef,
      holderBindingProfile: HolderBindingProfile.explicitDid,
      features: FEATURES,
      body: {
        supportsExpiration: true,
        defaultExpirationDays: 365n,
        requiresHolderPublicKey: true,
      },
    };

    this.bus.send({
      type: "issuance:offer",
      from: this.profile.label,
      to: holderLabel,
      envelope: offer.envelope,
      body: offer,
    });
  }

  receiveRequestAndIssueCredential(
    request: ProtocolMessage,
    claimWitness: ClaimWitness,
  ): void {
    assertMessageType(request, "issuance:request");
    assertBodyHasFields(request, ["envelope", "schema", "body"]);
    const issuanceRequest = request.body as BirthCredentialIssuanceRequest;

    const claims = {
      subjectIdCommitment: pureCircuits.subjectIdCommitment(
        claimWitness.subjectId,
        claimWitness.subjectOpening,
      ),
      legalNameCommitment: pureCircuits.legalNameCommitment(
        claimWitness.legalNamePadded,
        claimWitness.legalNameOpening,
      ),
      birthDateCommitment: pureCircuits.birthDateCommitment(
        claimWitness.birthDateDays,
        claimWitness.birthDateOpening,
      ),
      birthCountryCodeCommitment: pureCircuits.birthCountryCodeCommitment(
        claimWitness.birthCountryCodePadded,
        claimWitness.birthCountryCodeOpening,
      ),
    };

    const credential: BirthCredential = {
      version: 1n,
      schema: BIRTH_SCHEMA,
      issuerVerificationMethodRef: this.profile.signer.verificationMethodRef,
      holderBinding: issuanceRequest.body.holderBinding,
      issuedAt: claimWitness.issuedAt,
      hasExpiration: true,
      expiresAt: claimWitness.expiresAt,
      claims,
      claimRoot: pureCircuits.birthCredentialClaimRoot(claims),
    };

    const bodyRoot = pureCircuits.birthCredentialBodyRoot(credential);
    const challengeHash = issuanceRequest.body.holderChallengeHash;
    // TEST ONLY: production must use cryptographically random nonces.
    // Reusing a nonce across Schnorr signatures leaks the private key.
    const nonceScalar = 11n;

    const proof: Proof = {
      signerVerificationMethodRef: this.profile.signer.verificationMethodRef,
      createdAt: claimWitness.issuedAt + 1n,
      challengeHash,
      publicKey: this.profile.signer.publicKey,
      signature: {
        r: ecMulGenerator(nonceScalar),
        s: 0n,
      },
    };

    const challenge = genericPureCircuits.issuanceProofChallenge(
      bodyRoot,
      proof,
    );

    const credentialProof: Proof = {
      ...proof,
      signature: {
        r: proof.signature.r,
        s: mod(nonceScalar + challenge * this.profile.signer.secretKey),
      },
    };

    const result: BirthCredentialIssuanceResult = {
      envelope: createEnvelope(
        "issuance-result",
        "birth-issuance",
        false,
        issuanceRequest.envelope.messageId,
        issuanceRequest.envelope.threadId,
      ),
      schema: BIRTH_SCHEMA,
      issuerVerificationMethodRef: this.profile.signer.verificationMethodRef,
      holderBindingProfile: HolderBindingProfile.explicitDid,
      body: {
        credential,
        credentialProof,
        holderPublicKey: issuanceRequest.body.holderPublicKey,
        issuanceChallengeHash: challengeHash,
      },
    };

    this.bus.send({
      type: "issuance:result",
      from: this.profile.label,
      to: request.from,
      envelope: result.envelope,
      body: result,
    });
  }
}
