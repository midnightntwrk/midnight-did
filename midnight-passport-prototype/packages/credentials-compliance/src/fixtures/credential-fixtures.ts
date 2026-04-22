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
} from "@midnight-ntwrk/midnight-did-credentials";

import {
  pureCircuits,
  type SanctionScreeningCredential,
  type SanctionScreeningCredentialIssuanceOffer,
  type SanctionScreeningCredentialIssuanceRequest,
  type SanctionScreeningCredentialIssuanceResult,
  type SanctionScreeningCredentialPresentation,
  type SanctionScreeningCredentialPresentationRequest,
  type SanctionScreeningCredentialVerificationRequest,
  type SanctionScreeningCredentialVerificationResult,
  type SanctionScreeningCredentialVerificationSubmission,
} from "../managed/sanction-screening-credential/contract/index.js";

const JUBJUB_FIELD_MODULUS =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

export type Signer = {
  readonly label: string;
  readonly secretKey: bigint;
  readonly publicKey: JubjubPoint;
  readonly verificationMethodRef: VerificationMethodRef;
};

export type SanctionScreeningFixture = {
  readonly issuer: Signer;
  readonly credential: SanctionScreeningCredential;
  readonly credentialProof: Proof;
  readonly presentationRequest: SanctionScreeningCredentialPresentationRequest;
  readonly verificationRequest: SanctionScreeningCredentialVerificationRequest;
  readonly verificationSubmission: SanctionScreeningCredentialVerificationSubmission;
  readonly verificationResult: SanctionScreeningCredentialVerificationResult;
  readonly issuanceOffer: SanctionScreeningCredentialIssuanceOffer;
  readonly issuanceRequest: SanctionScreeningCredentialIssuanceRequest;
  readonly issuanceResult: SanctionScreeningCredentialIssuanceResult;
  readonly presentation: SanctionScreeningCredentialPresentation;
  readonly witness: {
    readonly holderSecret: Uint8Array;
    readonly holderSecretOpening: Uint8Array;
    readonly holderBindingBlindingFactor: Uint8Array;
    readonly holderBindingIssuerNonce: Uint8Array;
    readonly verifierDomainHash: Uint8Array;
    readonly subjectId: Uint8Array;
    readonly subjectIdOpening: Uint8Array;
    readonly screeningDateDay: bigint;
    readonly screeningDateOpening: Uint8Array;
    readonly validUntilDay: bigint;
    readonly currentDay: bigint;
  };
};

export type SanctionScreeningFixtureOptions = {
  readonly screeningResult?: bigint;
  readonly isPep?: boolean;
  readonly holderSecret?: Uint8Array;
  readonly holderSecretOpening?: Uint8Array;
  readonly holderBindingBlindingFactor?: Uint8Array;
  readonly screeningDateDay?: bigint;
  readonly validUntilDay?: bigint;
  readonly currentDay?: bigint;
  readonly verifierChallengeHash?: Uint8Array;
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

export const createSanctionScreeningFixture = (
  options: SanctionScreeningFixtureOptions = {},
): SanctionScreeningFixture => {
  const issuer = createSigner("compliance-issuer", 98_765_432n);
  const witness = {
    holderSecret: options.holderSecret ?? sha256("holder-secret:alice"),
    holderSecretOpening:
      options.holderSecretOpening ?? sha256("opening:holder-secret"),
    holderBindingBlindingFactor:
      options.holderBindingBlindingFactor ?? sha256("blinding:holder-secret"),
    holderBindingIssuerNonce: sha256("issuer-nonce:sanction-screening"),
    verifierDomainHash: sha256("verifier-domain:exchange.example"),
    subjectId: sha256("subject:alice"),
    subjectIdOpening: sha256("opening:subject-id"),
    screeningDateDay: options.screeningDateDay ?? 12_700n,
    screeningDateOpening: sha256("opening:screening-date"),
    validUntilDay: options.validUntilDay ?? 12_900n,
    currentDay: options.currentDay ?? 12_730n,
  };

  const claims = {
    subjectIdCommitment: pureCircuits.subjectIdCommitment(
      witness.subjectId,
      witness.subjectIdOpening,
    ),
    screeningResult:
      options.screeningResult ?? pureCircuits.screeningResultPass(),
    isPep: options.isPep ?? false,
    sanctionsListsChecked: 7n,
    issuerJurisdiction: 840n,
    riskLevel: pureCircuits.riskLevelLow(),
    screeningDateCommitment: pureCircuits.screeningDateCommitment(
      witness.screeningDateDay,
      witness.screeningDateOpening,
    ),
    validUntilDay: witness.validUntilDay,
  };

  const credential: SanctionScreeningCredential = {
    version: 1n,
    schema: {
      packageId: padText("midnight-did:vc:compliance"),
      schemaId: padText("sanction-screening:v1"),
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
    issuedAt: 12_700n,
    hasExpiration: true,
    expiresAt: 12_900n,
    claims,
    claimRoot: pureCircuits.sanctionScreeningCredentialClaimRoot(claims),
  };

  const credentialProof = signProof({
    bodyRoot: pureCircuits.sanctionScreeningCredentialBodyRoot(credential),
    signer: issuer,
    createdAt: 12_701n,
    challengeHash: sha256("challenge:compliance-issuance"),
    nonceScalar: 19n,
  });

  const presentationRequest: SanctionScreeningCredentialPresentationRequest = {
    version: 1n,
    schema: credential.schema,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    requireScreeningResultPass: true,
    requirePepFalse: true,
    requireVerifierScopedPseudonym: true,
    verifierDomainHash: witness.verifierDomainHash,
    requireScreeningFresh: true,
    maxScreeningAgeDays: 60n,
    requireNotExpired: true,
    verifierChallengeHash:
      options.verifierChallengeHash ?? sha256("challenge:compliance-verifier"),
  };

  const presentation: SanctionScreeningCredentialPresentation = {
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
      revealScreeningResult: true,
      screeningResult: claims.screeningResult,
      revealPepStatus: true,
      isPep: claims.isPep,
      revealVerifierScopedPseudonym: true,
      verifierScopedPseudonym: genericPureCircuits.verifierScopedPseudonym(
        witness.holderSecret,
        witness.verifierDomainHash,
      ),
      proveScreeningFresh: true,
      maxScreeningAgeDays: presentationRequest.maxScreeningAgeDays,
      proveNotExpired: true,
    },
  };

  const verificationRequest: SanctionScreeningCredentialVerificationRequest = {
    envelope: createProtocolEnvelope({
      label: "compliance-presentation-request",
      threadLabel: "compliance-presentation",
      initialMessage: true,
      createdAt: 12_731n,
    }),
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
      requireScreeningResultPass:
        presentationRequest.requireScreeningResultPass,
      requirePepFalse: presentationRequest.requirePepFalse,
      requireVerifierScopedPseudonym:
        presentationRequest.requireVerifierScopedPseudonym,
      verifierDomainHash: presentationRequest.verifierDomainHash,
      requireScreeningFresh: presentationRequest.requireScreeningFresh,
      maxScreeningAgeDays: presentationRequest.maxScreeningAgeDays,
      requireNotExpired: presentationRequest.requireNotExpired,
    },
  };

  const verificationSubmission: SanctionScreeningCredentialVerificationSubmission =
    {
      envelope: createProtocolEnvelope({
        label: "compliance-presentation-submission",
        threadLabel: "compliance-presentation",
        initialMessage: false,
        respondsToMessageId: verificationRequest.envelope.messageId,
        createdAt: 12_732n,
      }),
      schema: credential.schema,
      issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
      holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
      challengeHash: presentationRequest.verifierChallengeHash,
      body: {
        credential,
        credentialProof,
        presentation,
      },
    };

  const verificationResult: SanctionScreeningCredentialVerificationResult = {
    envelope: createProtocolEnvelope({
      label: "compliance-presentation-result",
      threadLabel: "compliance-presentation",
      initialMessage: false,
      respondsToMessageId: verificationSubmission.envelope.messageId,
      createdAt: 12_733n,
    }),
    approved: true,
    body: {
      credentialRoot:
        pureCircuits.sanctionScreeningCredentialBodyRoot(credential),
      verifiedScreeningResultPass: true,
      verifiedPepFalse: true,
      verifiedScreeningFresh: true,
      verifiedNotExpired: true,
      hasVerifierScopedPseudonym: true,
      verifierScopedPseudonym: presentation.disclosed.verifierScopedPseudonym,
    },
  };

  const issuanceOffer: SanctionScreeningCredentialIssuanceOffer = {
    envelope: createProtocolEnvelope({
      label: "compliance-issuance-offer",
      threadLabel: "compliance-issuance",
      initialMessage: true,
      createdAt: 12_699n,
    }),
    schema: credential.schema,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
    features: {
      supportsSelectiveDisclosure: true,
      supportsPredicateProofs: true,
      supportsVerifierScopedPseudonym: true,
      supportsSameHolderProof: true,
    },
    body: {
      supportsExpiration: true,
      defaultExpirationDays: 180n,
      requiresHolderSecret: true,
    },
  };

  const issuanceRequest: SanctionScreeningCredentialIssuanceRequest = {
    envelope: createProtocolEnvelope({
      label: "compliance-issuance-request",
      threadLabel: "compliance-issuance",
      initialMessage: false,
      respondsToMessageId: issuanceOffer.envelope.messageId,
      createdAt: 12_700n,
    }),
    schema: credential.schema,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
    body: {
      holderSecretCommitment: genericPureCircuits.secretHolderBindingCommitment(
        witness.holderSecret,
        witness.holderSecretOpening,
      ),
      holderBindingBlindingFactor: witness.holderBindingBlindingFactor,
      holderChallengeHash: credentialProof.challengeHash,
      requestExpiration: true,
      requestedExpirationDays: 180n,
    },
  };

  const issuanceResult: SanctionScreeningCredentialIssuanceResult = {
    envelope: createProtocolEnvelope({
      label: "compliance-issuance-result",
      threadLabel: "compliance-issuance",
      initialMessage: false,
      respondsToMessageId: issuanceRequest.envelope.messageId,
      createdAt: 12_701n,
    }),
    schema: credential.schema,
    issuerVerificationMethodRef: credential.issuerVerificationMethodRef,
    holderBindingProfile: HolderBindingProfile.blindedSecretHolder,
    body: {
      credential,
      credentialProof,
      issuanceChallengeHash: credentialProof.challengeHash,
    },
  };

  return {
    issuer,
    credential,
    credentialProof,
    presentationRequest,
    verificationRequest,
    verificationSubmission,
    verificationResult,
    issuanceOffer,
    issuanceRequest,
    issuanceResult,
    presentation,
    witness,
  };
};
