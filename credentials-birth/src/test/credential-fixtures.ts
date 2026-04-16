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
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type BirthCredential,
  type BirthCredentialIssuanceOffer,
  type BirthCredentialIssuanceRequest,
  type BirthCredentialIssuanceResult,
  type BirthCredentialPresentation,
  type BirthCredentialPresentationRequest,
  type BirthCredentialVerificationRequest,
  type BirthCredentialVerificationResult,
  type BirthCredentialVerificationSubmission,
  type CredentialProtocolFeatures,
  HolderBindingProfile,
  type ProtocolMessageEnvelope,
  pureCircuits,
} from "../managed/birth-credential/contract/index.js";

const JUBJUB_FIELD_MODULUS =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

export type Signer = {
  readonly label: string;
  readonly secretKey: bigint;
  readonly publicKey: JubjubPoint;
  readonly verificationMethodRef: VerificationMethodRef;
};

export type ProofContext = "issuance" | "presentation";

export type BirthCredentialFixture = {
  readonly issuer: Signer;
  readonly holder: Signer;
  readonly credential: BirthCredential;
  readonly credentialProof: Proof;
  readonly presentationRequest: BirthCredentialPresentationRequest;
  readonly presentation: BirthCredentialPresentation;
  readonly presentationProof: Proof;
  readonly witness: {
    readonly subjectId: Uint8Array;
    readonly subjectOpening: Uint8Array;
    readonly legalNamePadded: Uint8Array;
    readonly legalNameOpening: Uint8Array;
    readonly birthDateDays: bigint;
    readonly birthDateOpening: Uint8Array;
    readonly birthCountryCodePadded: Uint8Array;
    readonly birthCountryCodeOpening: Uint8Array;
    readonly currentDay: bigint;
  };
};

export type BirthCredentialProtocolFixture = BirthCredentialFixture & {
  readonly features: CredentialProtocolFeatures;
  readonly issuanceOffer: BirthCredentialIssuanceOffer;
  readonly issuanceRequest: BirthCredentialIssuanceRequest;
  readonly issuanceResult: BirthCredentialIssuanceResult;
  readonly verificationRequest: BirthCredentialVerificationRequest;
  readonly verificationSubmission: BirthCredentialVerificationSubmission;
  readonly verificationResult: BirthCredentialVerificationResult;
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

const buildBirthCredentialFixture = (
  issuer: Signer,
  holder: Signer,
  verifierChallengeHash = sha256("challenge:verifier"),
): BirthCredentialFixture => {
  const witness = {
    subjectId: sha256("subject:alice"),
    subjectOpening: sha256("opening:subject"),
    legalNamePadded: padText("Alice Example"),
    legalNameOpening: sha256("opening:legal-name"),
    birthDateDays: 3650n,
    birthDateOpening: sha256("opening:birth-date"),
    birthCountryCodePadded: padText("CAN"),
    birthCountryCodeOpening: sha256("opening:birth-country"),
    currentDay: 3650n + 365n * 25n,
  };

  const claims = {
    subjectIdCommitment: pureCircuits.subjectIdCommitment(
      witness.subjectId,
      witness.subjectOpening,
    ),
    legalNameCommitment: pureCircuits.legalNameCommitment(
      witness.legalNamePadded,
      witness.legalNameOpening,
    ),
    birthDateCommitment: pureCircuits.birthDateCommitment(
      witness.birthDateDays,
      witness.birthDateOpening,
    ),
    birthCountryCodeCommitment: pureCircuits.birthCountryCodeCommitment(
      witness.birthCountryCodePadded,
      witness.birthCountryCodeOpening,
    ),
  };

  const credential: BirthCredential = {
    version: 1n,
    schema: {
      packageId: padText("midnight-did:vc:birth"),
      schemaId: padText("birth-credential:v1"),
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
    claimRoot: pureCircuits.birthCredentialClaimRoot(claims),
  };

  const credentialProof = signProof({
    bodyRoot: pureCircuits.birthCredentialBodyRoot(credential),
    context: "issuance",
    signer: issuer,
    createdAt: 10_001n,
    challengeHash: sha256("challenge:issuance"),
    nonceScalar: 11n,
  });

  const presentationRequest: BirthCredentialPresentationRequest = {
    version: 1n,
    schema: credential.schema,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    requireSubjectIdCommitmentDisclosure: false,
    requireBirthCountryDisclosure: true,
    requireAgeOverThreshold: true,
    requestedAgeThresholdYears: 18n,
    verifierChallengeHash,
  };

  const presentation: BirthCredentialPresentation = {
    version: 1n,
    schema: credential.schema,
    credentialClaimRoot: credential.claimRoot,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    holderBinding: credential.holderBinding,
    disclosed: {
      revealSubjectIdCommitment: false,
      subjectIdCommitment: new Uint8Array(32),
      revealBirthCountryCode: true,
      birthCountryCodePadded: witness.birthCountryCodePadded,
      birthCountryCodeOpening: witness.birthCountryCodeOpening,
      proveAgeOverThreshold: true,
      ageThresholdYears: 18n,
    },
  };

  const presentationProof = signProof({
    bodyRoot: pureCircuits.birthCredentialPresentationBodyRoot(presentation),
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

export const createBirthCredentialFixture = (): BirthCredentialFixture =>
  buildBirthCredentialFixture(
    createSigner("issuer", 123456789n),
    createSigner("holder", 987654321n),
  );

export const createBirthCredentialFixtureForParticipants = (
  issuer: Signer,
  holder: Signer,
  verifierChallengeHash?: Uint8Array,
): BirthCredentialFixture =>
  buildBirthCredentialFixture(issuer, holder, verifierChallengeHash);

export const createBirthCredentialProtocolFixture =
  (): BirthCredentialProtocolFixture => {
    const fixture = createBirthCredentialFixture();
    const features: CredentialProtocolFeatures = {
      supportsSelectiveDisclosure: true,
      supportsPredicateProofs: true,
      supportsVerifierScopedPseudonym: false,
      supportsSameHolderProof: false,
    };

    return createBirthCredentialProtocolFixtureFromFixture(fixture, features);
  };

export const createBirthCredentialProtocolFixtureForParticipants = (
  issuer: Signer,
  holder: Signer,
  verifierChallengeHash?: Uint8Array,
): BirthCredentialProtocolFixture =>
  createBirthCredentialProtocolFixtureFromFixture(
    createBirthCredentialFixtureForParticipants(
      issuer,
      holder,
      verifierChallengeHash,
    ),
  );

const createBirthCredentialProtocolFixtureFromFixture = (
  fixture: BirthCredentialFixture,
  features: CredentialProtocolFeatures = {
    supportsSelectiveDisclosure: true,
    supportsPredicateProofs: true,
    supportsVerifierScopedPseudonym: false,
    supportsSameHolderProof: false,
  },
): BirthCredentialProtocolFixture => {
  const normalizedFeatures: CredentialProtocolFeatures = {
    supportsSelectiveDisclosure: features.supportsSelectiveDisclosure,
    supportsPredicateProofs: features.supportsPredicateProofs,
    supportsVerifierScopedPseudonym: features.supportsVerifierScopedPseudonym,
    supportsSameHolderProof: features.supportsSameHolderProof,
  };

  const issuanceOffer: BirthCredentialIssuanceOffer = {
    envelope: createProtocolEnvelope({
      label: "issuance-offer",
      threadLabel: "birth-issuance",
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

  const issuanceRequest: BirthCredentialIssuanceRequest = {
    envelope: createProtocolEnvelope({
      label: "issuance-request",
      threadLabel: "birth-issuance",
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

  const issuanceResult: BirthCredentialIssuanceResult = {
    envelope: createProtocolEnvelope({
      label: "issuance-result",
      threadLabel: "birth-issuance",
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

  const verificationRequest: BirthCredentialVerificationRequest = {
    envelope: createProtocolEnvelope({
      label: "verification-request",
      threadLabel: "birth-verification",
      initialMessage: true,
      createdAt: 21_000n,
    }),
    schema: fixture.credential.schema,
    issuerVerificationMethodRef: fixture.credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.explicitDid,
    features: normalizedFeatures,
    verifierChallengeHash: fixture.presentationRequest.verifierChallengeHash,
    body: {
      requireSubjectIdCommitmentDisclosure:
        fixture.presentationRequest.requireSubjectIdCommitmentDisclosure,
      requireBirthCountryDisclosure:
        fixture.presentationRequest.requireBirthCountryDisclosure,
      requireAgeOverThreshold:
        fixture.presentationRequest.requireAgeOverThreshold,
      requestedAgeThresholdYears:
        fixture.presentationRequest.requestedAgeThresholdYears,
    },
  };

  const verificationSubmission: BirthCredentialVerificationSubmission = {
    envelope: createProtocolEnvelope({
      label: "verification-submission",
      threadLabel: "birth-verification",
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

  const verificationResult: BirthCredentialVerificationResult = {
    envelope: createProtocolEnvelope({
      label: "verification-result",
      threadLabel: "birth-verification",
      initialMessage: false,
      respondsToMessageId: verificationSubmission.envelope.messageId,
      createdAt: 21_020n,
    }),
    approved: true,
    body: {
      credentialRoot: pureCircuits.birthCredentialBodyRoot(fixture.credential),
      verifiedThresholdYears: fixture.presentation.disclosed.ageThresholdYears,
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
