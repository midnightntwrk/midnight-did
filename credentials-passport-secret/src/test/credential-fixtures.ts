import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";

import {
  ecMulGenerator,
  type JubjubPoint,
} from "@midnight-ntwrk/compact-runtime";

import {
  HolderBindingProfile,
  type Proof,
  type ProtocolMessageEnvelope,
  pureCircuits as genericPureCircuits,
  type VerificationMethodRef,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  pureCircuits,
  type SecretPassportCredential,
  type SecretPassportCredentialPresentation,
  type SecretPassportCredentialPresentationRequest,
  type SecretPassportCredentialVerificationRequest,
} from "../managed/secret-passport-credential/contract/index.js";

const JUBJUB_FIELD_MODULUS =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

export type Signer = {
  readonly label: string;
  readonly secretKey: bigint;
  readonly publicKey: JubjubPoint;
  readonly verificationMethodRef: VerificationMethodRef;
};

export type PassportCredentialFixture = {
  readonly issuer: Signer;
  readonly credential: SecretPassportCredential;
  readonly credentialProof: Proof;
  readonly presentationRequest: SecretPassportCredentialPresentationRequest;
  readonly verificationRequest: SecretPassportCredentialVerificationRequest;
  readonly presentation: SecretPassportCredentialPresentation;
  readonly witness: {
    readonly holderSecret: Uint8Array;
    readonly holderSecretOpening: Uint8Array;
    readonly holderBindingBlindingFactor: Uint8Array;
    readonly holderBindingIssuerNonce: Uint8Array;
    readonly verifierDomainHash: Uint8Array;
    readonly documentNumber: Uint8Array;
    readonly documentNumberOpening: Uint8Array;
    readonly issuingCountry: { value: bigint };
    readonly nationality: bigint;
    readonly nationalityOpening: Uint8Array;
    readonly givenNamePadded: Uint8Array;
    readonly givenNameOpening: Uint8Array;
    readonly familyNamePadded: Uint8Array;
    readonly familyNameOpening: Uint8Array;
    readonly birthDateDays: bigint;
    readonly birthDateOpening: Uint8Array;
    readonly gender: bigint;
    readonly genderOpening: Uint8Array;
    readonly expiryDate: bigint;
    readonly currentDay: bigint;
  };
};

export type SecretPassportCredentialFixtureOptions = {
  readonly issuerLabel?: string;
  readonly issuerSecretKey?: bigint;
  readonly issuerVerificationMethodRef?: VerificationMethodRef;
  readonly verifierChallengeHash?: Uint8Array;
  readonly holderSecret?: Uint8Array;
  readonly holderSecretOpening?: Uint8Array;
  readonly holderBindingBlindingFactor?: Uint8Array;
  readonly holderBindingIssuerNonce?: Uint8Array;
  readonly verifierDomainHash?: Uint8Array;
  readonly documentNumber?: Uint8Array;
  readonly documentNumberOpening?: Uint8Array;
  readonly issuingCountry?: { value: bigint };
  readonly nationality?: bigint;
  readonly nationalityOpening?: Uint8Array;
  readonly givenNamePadded?: Uint8Array;
  readonly givenNameOpening?: Uint8Array;
  readonly familyNamePadded?: Uint8Array;
  readonly familyNameOpening?: Uint8Array;
  readonly birthDateDays?: bigint;
  readonly birthDateOpening?: Uint8Array;
  readonly gender?: bigint;
  readonly genderOpening?: Uint8Array;
  readonly expiryDate?: bigint;
  readonly currentDay?: bigint;
};

const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

const padText = (value: string, length = 32): Uint8Array => {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length >= length) {
    return bytes.subarray(0, length);
  }
  const padded = new Uint8Array(length);
  padded.set(bytes);
  return padded;
};

const mod = (value: bigint): bigint => {
  const reduced = value % JUBJUB_FIELD_MODULUS;
  return reduced >= 0n ? reduced : reduced + JUBJUB_FIELD_MODULUS;
};

const contractAddress = (label: string): { bytes: Uint8Array } => ({
  bytes: sha256(`contract:${label}`),
});

const createProtocolEnvelope = (
  label: string,
  threadLabel: string,
): ProtocolMessageEnvelope => ({
  version: 1n,
  messageId: sha256(`protocol:message:${label}`),
  threadId: sha256(`protocol:thread:${threadLabel}`),
  initialMessage: true,
  respondsToMessageId: genericPureCircuits.noProtocolResponseReference(),
  createdAt: 1n,
  hasExpiresAt: false,
  expiresAt: 0n,
});

export const createSigner = (
  label: string,
  secretKey: bigint,
  methodId = `#${label}-key-1`,
): Signer => ({
  label,
  secretKey,
  publicKey: ecMulGenerator(secretKey),
  verificationMethodRef: {
    didContractAddress: contractAddress(label),
    methodId: padText(methodId),
  },
});

export const signProof = ({
  bodyRoot,
  signer,
  createdAt,
  challengeHash,
  nonceScalar,
}: {
  readonly bodyRoot: Uint8Array;
  readonly signer: Signer;
  readonly createdAt: bigint;
  readonly challengeHash: Uint8Array;
  readonly nonceScalar: bigint;
}): Proof => {
  const proof: Proof = {
    signerVerificationMethodRef: signer.verificationMethodRef,
    createdAt,
    challengeHash,
    publicKey: signer.publicKey,
    signature: {
      r: ecMulGenerator(nonceScalar),
      s: 0n,
    },
  };
  const challenge = genericPureCircuits.issuanceProofChallenge(bodyRoot, proof);
  return {
    ...proof,
    signature: {
      r: proof.signature.r,
      s: mod(nonceScalar + challenge * signer.secretKey),
    },
  };
};

export const createSecretPassportCredentialFixture = (
  options: SecretPassportCredentialFixtureOptions = {},
): PassportCredentialFixture => {
  const baseIssuer = createSigner(
    options.issuerLabel ?? "issuer",
    options.issuerSecretKey ?? 123456789n,
  );
  const issuer = {
    ...baseIssuer,
    verificationMethodRef:
      options.issuerVerificationMethodRef ?? baseIssuer.verificationMethodRef,
  };

  const witness = {
    holderSecret: options.holderSecret ?? sha256("holder-secret:alice"),
    holderSecretOpening:
      options.holderSecretOpening ?? sha256("opening:holder-secret"),
    holderBindingBlindingFactor:
      options.holderBindingBlindingFactor ?? sha256("blinding:holder-secret"),
    holderBindingIssuerNonce:
      options.holderBindingIssuerNonce ??
      sha256("issuer-nonce:passport-secret"),
    verifierDomainHash:
      options.verifierDomainHash ??
      sha256("verifier-domain:age-gateway.example"),
    documentNumber: options.documentNumber ?? sha256("passport:P12345678"),
    documentNumberOpening:
      options.documentNumberOpening ?? sha256("opening:document-number"),
    issuingCountry: options.issuingCountry ?? { value: 276n },
    nationality: options.nationality ?? 276n,
    nationalityOpening:
      options.nationalityOpening ?? sha256("opening:nationality"),
    givenNamePadded: options.givenNamePadded ?? padText("Alice"),
    givenNameOpening: options.givenNameOpening ?? sha256("opening:given-name"),
    familyNamePadded: options.familyNamePadded ?? padText("Example"),
    familyNameOpening:
      options.familyNameOpening ?? sha256("opening:family-name"),
    birthDateDays: options.birthDateDays ?? 3650n,
    birthDateOpening: options.birthDateOpening ?? sha256("opening:birth-date"),
    gender: options.gender ?? 2n,
    genderOpening: options.genderOpening ?? sha256("opening:gender"),
    expiryDate: options.expiryDate ?? 25000n,
    currentDay: options.currentDay ?? 12775n,
  };

  const claims = {
    documentNumberCommitment: pureCircuits.documentNumberCommitment(
      witness.documentNumber,
      witness.documentNumberOpening,
    ),
    issuingCountry: witness.issuingCountry,
    nationalityCommitment: pureCircuits.nationalityCommitment(
      witness.nationality,
      witness.nationalityOpening,
    ),
    givenNameCommitment: pureCircuits.givenNameCommitment(
      witness.givenNamePadded,
      witness.givenNameOpening,
    ),
    familyNameCommitment: pureCircuits.familyNameCommitment(
      witness.familyNamePadded,
      witness.familyNameOpening,
    ),
    birthDateCommitment: pureCircuits.birthDateCommitment(
      witness.birthDateDays,
      witness.birthDateOpening,
    ),
    genderCommitment: pureCircuits.genderCommitment(
      witness.gender,
      witness.genderOpening,
    ),
    expiryDate: witness.expiryDate,
  };

  const credential: SecretPassportCredential = {
    version: 1n,
    schema: {
      packageId: padText("midnight-did:vc:passport-secret"),
      schemaId: padText("passport-credential:v1"),
      majorVersion: 1n,
      minorVersion: 0n,
    },
    issuerVerificationMethodRef: issuer.verificationMethodRef,
    holderBinding: {
      blindedHolderSecretCommitment:
        genericPureCircuits.blindedSecretHolderCommitment(
          genericPureCircuits.secretHolderBindingCommitment(
            witness.holderSecret,
            witness.holderSecretOpening,
          ),
          witness.holderBindingIssuerNonce,
          witness.holderBindingBlindingFactor,
        ),
      issuerNonce: witness.holderBindingIssuerNonce,
      requestChallengeResponse:
        genericPureCircuits.noSecretHolderChallengeResponse(),
    },
    issuedAt: 10_000n,
    hasExpiration: true,
    expiresAt: 20_000n,
    claims,
    claimRoot: pureCircuits.passportCredentialClaimRoot(claims),
  };

  const credentialProof = signProof({
    bodyRoot: pureCircuits.secretPassportCredentialBodyRoot(credential),
    signer: issuer,
    createdAt: 10_001n,
    challengeHash: sha256("challenge:issuance"),
    nonceScalar: 11n,
  });

  const presentationRequest: SecretPassportCredentialPresentationRequest = {
    version: 1n,
    schema: credential.schema,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    requireNationalityDisclosure: true,
    requireGenderDisclosure: false,
    requireVerifierScopedPseudonym: true,
    verifierDomainHash: witness.verifierDomainHash,
    requireAgeOverThreshold: true,
    requestedAgeThresholdYears: 18n,
    requireNotExpired: false,
    verifierChallengeHash:
      options.verifierChallengeHash ?? sha256("challenge:verifier"),
  };

  const verificationRequest: SecretPassportCredentialVerificationRequest = {
    envelope: createProtocolEnvelope(
      "secret-presentation-request",
      "secret-passport-presentation",
    ),
    schema: credential.schema,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
    features: {
      supportsSelectiveDisclosure: true,
      supportsPredicateProofs: true,
      supportsVerifierScopedPseudonym: true,
      supportsSameHolderProof: true,
    },
    verifierChallengeHash: presentationRequest.verifierChallengeHash,
    body: {
      requireNationalityDisclosure:
        presentationRequest.requireNationalityDisclosure,
      requireGenderDisclosure: presentationRequest.requireGenderDisclosure,
      requireVerifierScopedPseudonym:
        presentationRequest.requireVerifierScopedPseudonym,
      verifierDomainHash: presentationRequest.verifierDomainHash,
      requireAgeOverThreshold: presentationRequest.requireAgeOverThreshold,
      requestedAgeThresholdYears:
        presentationRequest.requestedAgeThresholdYears,
      requireNotExpired: presentationRequest.requireNotExpired,
    },
  };

  const presentation: SecretPassportCredentialPresentation = {
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
          witness.holderSecret,
          presentationRequest.verifierChallengeHash,
        ),
    },
    disclosed: {
      revealNationality: true,
      nationalityValue: witness.nationality,
      nationalityOpening: witness.nationalityOpening,
      revealGender: false,
      genderValue: 0n,
      genderOpening: new Uint8Array(32),
      revealVerifierScopedPseudonym: true,
      verifierScopedPseudonym: genericPureCircuits.verifierScopedPseudonym(
        witness.holderSecret,
        witness.verifierDomainHash,
      ),
      proveAgeOverThreshold: true,
      ageThresholdYears: 18n,
      proveNotExpired: false,
    },
  };

  return {
    issuer,
    credential,
    credentialProof,
    presentationRequest,
    verificationRequest,
    presentation,
    witness,
  };
};
