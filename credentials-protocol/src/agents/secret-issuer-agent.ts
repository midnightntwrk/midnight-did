import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";

import {
  type Proof,
  pureCircuits as genericPureCircuits,
  type ProtocolMessageEnvelope,
  HolderBindingProfile,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  pureCircuits,
  type SecretBirthCredential,
} from "../../../credentials-birth-secret/src/managed/secret-birth-credential/contract/index.js";

import type { DIDProfile } from "./types.js";
import type { ProtocolMessage, PartyId } from "../transport/types.js";
import { MessageBus } from "../transport/message-bus.js";
import { assertMessageType, assertBodyHasFields } from "../shared/validation.js";
import { mod, sha256, padText } from "../shared/crypto.js";
import { createEnvelope } from "../shared/envelope.js";

export type SecretClaimWitness = {
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

const SECRET_BIRTH_SCHEMA = {
  packageId: padText("midnight-did:vc:birth-secret"),
  schemaId: padText("birth-credential:v1"),
  majorVersion: 1n,
  minorVersion: 0n,
};

const FEATURES = {
  supportsSelectiveDisclosure: true,
  supportsPredicateProofs: true,
  supportsVerifierScopedPseudonym: true,
  supportsSameHolderProof: true,
};

export type SecretIssuanceOffer = {
  readonly envelope: ProtocolMessageEnvelope;
  readonly schema: typeof SECRET_BIRTH_SCHEMA;
  readonly issuerVerificationMethodRef: DIDProfile["signer"]["verificationMethodRef"];
  readonly holderBindingProfile: HolderBindingProfile;
  readonly features: typeof FEATURES;
  readonly body: {
    readonly supportsExpiration: boolean;
    readonly defaultExpirationDays: bigint;
    readonly requiresHolderSecret: boolean;
  };
};

export type SecretIssuanceRequestBody = {
  readonly holderSecretCommitment: Uint8Array;
  readonly holderBindingBlindingFactor: Uint8Array;
  readonly holderChallengeHash: Uint8Array;
  readonly requestExpiration: boolean;
  readonly requestedExpirationDays: bigint;
};

export type SecretIssuanceRequest = {
  readonly envelope: ProtocolMessageEnvelope;
  readonly schema: typeof SECRET_BIRTH_SCHEMA;
  readonly issuerVerificationMethodRef: DIDProfile["signer"]["verificationMethodRef"];
  readonly holderBindingProfile: HolderBindingProfile;
  readonly body: SecretIssuanceRequestBody;
};

export type SecretIssuanceResult = {
  readonly envelope: ProtocolMessageEnvelope;
  readonly schema: typeof SECRET_BIRTH_SCHEMA;
  readonly issuerVerificationMethodRef: DIDProfile["signer"]["verificationMethodRef"];
  readonly holderBindingProfile: HolderBindingProfile;
  readonly body: {
    readonly credential: SecretBirthCredential;
    readonly credentialProof: Proof;
    readonly issuanceChallengeHash: Uint8Array;
  };
};

export class SecretIssuerAgent {
  private readonly profile: DIDProfile;
  private readonly bus: MessageBus;
  private issuanceCounter = 0;

  constructor(profile: DIDProfile, bus: MessageBus) {
    this.profile = profile;
    this.bus = bus;
  }

  createAndSendOffer(holderLabel: PartyId): void {
    const offer: SecretIssuanceOffer = {
      envelope: createEnvelope(
        "secret-issuance-offer",
        "secret-birth-issuance",
        true,
      ),
      schema: SECRET_BIRTH_SCHEMA,
      issuerVerificationMethodRef: this.profile.signer.verificationMethodRef,
      holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
      features: FEATURES,
      body: {
        supportsExpiration: true,
        defaultExpirationDays: 365n,
        requiresHolderSecret: true,
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
    claimWitness: SecretClaimWitness,
  ): void {
    assertMessageType(request, "issuance:request");
    assertBodyHasFields(request, ["envelope", "schema", "body"]);
    const issuanceRequest = request.body as SecretIssuanceRequest;
    const requestBody = issuanceRequest.body;

    // TEST ONLY: production must use a unique random nonce per issuance.
    const issuerNonce = sha256(`issuer-nonce:${this.profile.label}:${this.issuanceCounter++}`);

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

    const credential: SecretBirthCredential = {
      version: 1n,
      schema: SECRET_BIRTH_SCHEMA,
      issuerVerificationMethodRef: this.profile.signer.verificationMethodRef,
      holderBinding: {
        blindedHolderSecretCommitment:
          genericPureCircuits.blindedSecretHolderCommitment(
            requestBody.holderSecretCommitment,
            issuerNonce,
            requestBody.holderBindingBlindingFactor,
          ),
        issuerNonce,
        requestChallengeResponse:
          genericPureCircuits.noSecretHolderChallengeResponse(),
      },
      issuedAt: claimWitness.issuedAt,
      hasExpiration: true,
      expiresAt: claimWitness.expiresAt,
      claims,
      claimRoot: pureCircuits.birthCredentialClaimRoot(claims),
    };

    const bodyRoot = pureCircuits.secretBirthCredentialBodyRoot(credential);
    const challengeHash = requestBody.holderChallengeHash;
    // TEST ONLY: production must use cryptographically random nonces.
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

    const result: SecretIssuanceResult = {
      envelope: createEnvelope(
        "secret-issuance-result",
        "secret-birth-issuance",
        false,
        issuanceRequest.envelope.messageId,
      ),
      schema: SECRET_BIRTH_SCHEMA,
      issuerVerificationMethodRef: this.profile.signer.verificationMethodRef,
      holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
      body: {
        credential,
        credentialProof,
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
