import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";

import {
  ecMulGenerator,
  type JubjubPoint,
} from "@midnight-ntwrk/compact-runtime";
import {
  type Proof,
  pureCircuits as genericPureCircuits,
  type VerificationMethodRef,
} from "@midnight-ntwrk/midnight-did-credentials";

import {
  type CredentialProtocolFeatures,
  HolderBindingProfile,
  type PassportCredential,
  type PassportCredentialIssuanceOffer,
  type PassportCredentialIssuanceRequest,
  type PassportCredentialIssuanceResult,
  type PassportCredentialPresentation,
  type PassportCredentialPresentationRequest,
  type PassportCredentialVerificationRequest,
  type PassportCredentialVerificationResult,
  type PassportCredentialVerificationSubmission,
  type ProtocolMessageEnvelope,
  pureCircuits,
} from "../managed/passport-credential/contract/index.js";

const JUBJUB_FIELD_MODULUS =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

export type Signer = {
  readonly label: string;
  readonly secretKey: bigint;
  readonly publicKey: JubjubPoint;
  readonly verificationMethodRef: VerificationMethodRef;
};

export type ProofContext = "issuance" | "presentation";

export type PassportCredentialFixture = {
  readonly issuer: Signer;
  readonly holder: Signer;
  readonly credential: PassportCredential;
  readonly credentialProof: Proof;
  readonly presentationRequest: PassportCredentialPresentationRequest;
  readonly presentation: PassportCredentialPresentation;
  readonly presentationProof: Proof;
  readonly witness: {
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

export type PassportCredentialProtocolFixture = PassportCredentialFixture & {
  readonly features: CredentialProtocolFeatures;
  readonly issuanceOffer: PassportCredentialIssuanceOffer;
  readonly issuanceRequest: PassportCredentialIssuanceRequest;
  readonly issuanceResult: PassportCredentialIssuanceResult;
  readonly verificationRequest: PassportCredentialVerificationRequest;
  readonly verificationSubmission: PassportCredentialVerificationSubmission;
  readonly verificationResult: PassportCredentialVerificationResult;
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

const createProtocolEnvelope = ({
  label,
  threadLabel,
  initialMessage,
  respondsToMessageId,
  createdAt,
}: {
  readonly label: string;
  readonly threadLabel: string;
  readonly initialMessage: boolean;
  readonly respondsToMessageId?: Uint8Array;
  readonly createdAt: bigint;
}): ProtocolMessageEnvelope => ({
  version: 1n,
  messageId: sha256(`protocol:message:${label}`),
  threadId: sha256(`protocol:thread:${threadLabel}`),
  initialMessage,
  respondsToMessageId:
    respondsToMessageId ?? genericPureCircuits.noProtocolResponseReference(),
  createdAt,
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

export const withVerificationMethodRef = (
  signer: Signer,
  verificationMethodRef: VerificationMethodRef,
): Signer => ({
  ...signer,
  verificationMethodRef,
});

const deriveProofChallenge = (
  bodyRoot: Uint8Array,
  proof: Proof,
  context: ProofContext,
): bigint =>
  context === "issuance"
    ? genericPureCircuits.issuanceProofChallenge(bodyRoot, proof)
    : genericPureCircuits.presentationProofChallenge(bodyRoot, proof);

export const signProof = ({
  bodyRoot,
  context,
  signer,
  createdAt,
  challengeHash,
  nonceScalar,
}: {
  readonly bodyRoot: Uint8Array;
  readonly context: ProofContext;
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
  const challenge = deriveProofChallenge(bodyRoot, proof, context);
  return {
    ...proof,
    signature: {
      r: proof.signature.r,
      s: mod(nonceScalar + challenge * signer.secretKey),
    },
  };
};

const buildPassportCredentialFixture = (
  issuer: Signer,
  holder: Signer,
  verifierChallengeHash = sha256("challenge:verifier"),
): PassportCredentialFixture => {
  const witness = {
    documentNumber: sha256("passport:P12345678"),
    documentNumberOpening: sha256("opening:document-number"),
    issuingCountry: { value: 276n },
    nationality: 276n,
    nationalityOpening: sha256("opening:nationality"),
    givenNamePadded: padText("Alice"),
    givenNameOpening: sha256("opening:given-name"),
    familyNamePadded: padText("Example"),
    familyNameOpening: sha256("opening:family-name"),
    birthDateDays: 3650n,
    birthDateOpening: sha256("opening:birth-date"),
    gender: 2n,
    genderOpening: sha256("opening:gender"),
    expiryDate: 25000n,
    currentDay: 12775n,
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

  const credential: PassportCredential = {
    version: 1n,
    schema: {
      packageId: padText("midnight-did:vc:passport"),
      schemaId: padText("passport-credential:v1"),
      majorVersion: 1n,
      minorVersion: 0n,
    },
    issuerVerificationMethodRef: issuer.verificationMethodRef,
    holderBinding: {
      holderVerificationMethodRef: holder.verificationMethodRef,
    },
    issuedAt: 10_000n,
    hasExpiration: true,
    expiresAt: 20_000n,
    claims,
    claimRoot: pureCircuits.passportCredentialClaimRoot(claims),
  };

  const credentialProof = signProof({
    bodyRoot: pureCircuits.passportCredentialBodyRoot(credential),
    context: "issuance",
    signer: issuer,
    createdAt: 10_001n,
    challengeHash: sha256("challenge:issuance"),
    nonceScalar: 11n,
  });

  const presentationRequest: PassportCredentialPresentationRequest = {
    version: 1n,
    schema: credential.schema,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    requireNationalityDisclosure: true,
    requireGenderDisclosure: false,
    requireAgeOverThreshold: true,
    requestedAgeThresholdYears: 18n,
    requireNotExpired: false,
    verifierChallengeHash,
  };

  const presentation: PassportCredentialPresentation = {
    version: 1n,
    schema: credential.schema,
    credentialClaimRoot: credential.claimRoot,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    holderBinding: credential.holderBinding,
    disclosed: {
      revealNationality: true,
      nationalityValue: witness.nationality,
      nationalityOpening: witness.nationalityOpening,
      revealGender: false,
      genderValue: 0n,
      genderOpening: new Uint8Array(32),
      proveAgeOverThreshold: true,
      ageThresholdYears: 18n,
      proveNotExpired: false,
    },
  };

  const presentationProof = signProof({
    bodyRoot: pureCircuits.passportCredentialPresentationBodyRoot(presentation),
    context: "presentation",
    signer: holder,
    createdAt: 10_100n,
    challengeHash: presentationRequest.verifierChallengeHash,
    nonceScalar: 17n,
  });

  return {
    issuer,
    holder,
    credential,
    credentialProof,
    presentationRequest,
    presentation,
    presentationProof,
    witness,
  };
};

export const createPassportCredentialFixture = (): PassportCredentialFixture =>
  buildPassportCredentialFixture(
    createSigner("issuer", 123456789n),
    createSigner("holder", 987654321n),
  );

export const createPassportCredentialFixtureForParticipants = (
  issuer: Signer,
  holder: Signer,
  verifierChallengeHash?: Uint8Array,
): PassportCredentialFixture =>
  buildPassportCredentialFixture(issuer, holder, verifierChallengeHash);

export const createPassportCredentialProtocolFixture =
  (): PassportCredentialProtocolFixture => {
    const fixture = createPassportCredentialFixture();
    const features: CredentialProtocolFeatures = {
      supportsSelectiveDisclosure: true,
      supportsPredicateProofs: true,
      supportsVerifierScopedPseudonym: false,
      supportsSameHolderProof: false,
    };

    return createPassportCredentialProtocolFixtureFromFixture(
      fixture,
      features,
    );
  };

export const createPassportCredentialProtocolFixtureForParticipants = (
  issuer: Signer,
  holder: Signer,
  verifierChallengeHash?: Uint8Array,
): PassportCredentialProtocolFixture =>
  createPassportCredentialProtocolFixtureFromFixture(
    createPassportCredentialFixtureForParticipants(
      issuer,
      holder,
      verifierChallengeHash,
    ),
  );

const createPassportCredentialProtocolFixtureFromFixture = (
  fixture: PassportCredentialFixture,
  features: CredentialProtocolFeatures = {
    supportsSelectiveDisclosure: true,
    supportsPredicateProofs: true,
    supportsVerifierScopedPseudonym: false,
    supportsSameHolderProof: false,
  },
): PassportCredentialProtocolFixture => {
  const normalizedFeatures: CredentialProtocolFeatures = {
    supportsSelectiveDisclosure: features.supportsSelectiveDisclosure,
    supportsPredicateProofs: features.supportsPredicateProofs,
    supportsVerifierScopedPseudonym: features.supportsVerifierScopedPseudonym,
    supportsSameHolderProof: features.supportsSameHolderProof,
  };

  const issuanceOffer: PassportCredentialIssuanceOffer = {
    envelope: createProtocolEnvelope({
      label: "issuance-offer",
      threadLabel: "passport-issuance",
      initialMessage: true,
      createdAt: 20_000n,
    }),
    schema: fixture.credential.schema,
    issuerVerificationMethodRef: fixture.credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.explicitDid,
    features: normalizedFeatures,
    body: {
      supportsExpiration: true,
      defaultExpirationDays: 365n,
      requiresHolderPublicKey: true,
    },
  };

  const issuanceRequest: PassportCredentialIssuanceRequest = {
    envelope: createProtocolEnvelope({
      label: "issuance-request",
      threadLabel: "passport-issuance",
      initialMessage: false,
      respondsToMessageId: issuanceOffer.envelope.messageId,
      createdAt: 20_010n,
    }),
    schema: fixture.credential.schema,
    issuerVerificationMethodRef: fixture.credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.explicitDid,
    body: {
      holderBinding: fixture.credential.holderBinding,
      holderPublicKey: fixture.holder.publicKey,
      holderChallengeHash: fixture.credentialProof.challengeHash,
      requestExpiration: true,
      requestedExpirationDays: 365n,
    },
  };

  const issuanceResult: PassportCredentialIssuanceResult = {
    envelope: createProtocolEnvelope({
      label: "issuance-result",
      threadLabel: "passport-issuance",
      initialMessage: false,
      respondsToMessageId: issuanceRequest.envelope.messageId,
      createdAt: 20_020n,
    }),
    schema: fixture.credential.schema,
    issuerVerificationMethodRef: fixture.credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.explicitDid,
    body: {
      credential: fixture.credential,
      credentialProof: fixture.credentialProof,
      holderPublicKey: fixture.holder.publicKey,
      issuanceChallengeHash: fixture.credentialProof.challengeHash,
    },
  };

  const verificationRequest: PassportCredentialVerificationRequest = {
    envelope: createProtocolEnvelope({
      label: "verification-request",
      threadLabel: "passport-verification",
      initialMessage: true,
      createdAt: 21_000n,
    }),
    schema: fixture.credential.schema,
    issuerVerificationMethodRef: fixture.credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.explicitDid,
    features: normalizedFeatures,
    verifierChallengeHash: fixture.presentationRequest.verifierChallengeHash,
    body: {
      requireNationalityDisclosure:
        fixture.presentationRequest.requireNationalityDisclosure,
      requireGenderDisclosure:
        fixture.presentationRequest.requireGenderDisclosure,
      requireAgeOverThreshold:
        fixture.presentationRequest.requireAgeOverThreshold,
      requestedAgeThresholdYears:
        fixture.presentationRequest.requestedAgeThresholdYears,
      requireNotExpired: fixture.presentationRequest.requireNotExpired,
    },
  };

  const verificationSubmission: PassportCredentialVerificationSubmission = {
    envelope: createProtocolEnvelope({
      label: "verification-submission",
      threadLabel: "passport-verification",
      initialMessage: false,
      respondsToMessageId: verificationRequest.envelope.messageId,
      createdAt: 21_010n,
    }),
    schema: fixture.credential.schema,
    issuerVerificationMethodRef: fixture.credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.explicitDid,
    challengeHash: fixture.presentationProof.challengeHash,
    body: {
      credential: fixture.credential,
      credentialProof: fixture.credentialProof,
      presentation: fixture.presentation,
      presentationProof: fixture.presentationProof,
    },
  };

  const verificationResult: PassportCredentialVerificationResult = {
    envelope: createProtocolEnvelope({
      label: "verification-result",
      threadLabel: "passport-verification",
      initialMessage: false,
      respondsToMessageId: verificationSubmission.envelope.messageId,
      createdAt: 21_020n,
    }),
    approved: true,
    body: {
      credentialRoot: pureCircuits.passportCredentialBodyRoot(
        fixture.credential,
      ),
      verifiedThresholdYears: fixture.presentation.disclosed.ageThresholdYears,
      verifiedNotExpired: false,
    },
  };

  return {
    ...fixture,
    features: normalizedFeatures,
    issuanceOffer,
    issuanceRequest,
    issuanceResult,
    verificationRequest,
    verificationSubmission,
    verificationResult,
  };
};
