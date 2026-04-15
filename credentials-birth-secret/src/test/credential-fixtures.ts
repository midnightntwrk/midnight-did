import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";

import {
  ecMulGenerator,
  type JubjubPoint,
} from "@midnight-ntwrk/compact-runtime";

import {
  type Proof,
  pureCircuits as genericPureCircuits,
  type VerificationMethodId,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type BirthCredentialPresentationRequest,
  pureCircuits,
  type SecretBirthCredential,
  type SecretBirthCredentialPresentation,
} from "../managed/secret-birth-credential/contract/index.js";

const JUBJUB_FIELD_MODULUS =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

export type Signer = {
  readonly label: string;
  readonly secretKey: bigint;
  readonly publicKey: JubjubPoint;
  readonly verificationMethodId: VerificationMethodId;
};

export type BirthCredentialFixture = {
  readonly issuer: Signer;
  readonly credential: SecretBirthCredential;
  readonly credentialProof: Proof;
  readonly presentationRequest: BirthCredentialPresentationRequest;
  readonly presentation: SecretBirthCredentialPresentation;
  readonly witness: {
    readonly holderSecret: Uint8Array;
    readonly holderSecretOpening: Uint8Array;
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

export const createSigner = (
  label: string,
  secretKey: bigint,
  methodIndex: bigint,
): Signer => ({
  label,
  secretKey,
  publicKey: ecMulGenerator(secretKey),
  verificationMethodId: {
    didContractAddress: contractAddress(label),
    methodIndex,
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
    signerVerificationMethodId: signer.verificationMethodId,
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

export const createSecretBirthCredentialFixture =
  (): BirthCredentialFixture => {
    const issuer = createSigner("issuer", 123456789n, 1n);

    const witness = {
      holderSecret: sha256("holder-secret:alice"),
      holderSecretOpening: sha256("opening:holder-secret"),
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

    const credential: SecretBirthCredential = {
      version: 1n,
      schema: {
        packageId: padText("midnight-did:vc:birth-secret"),
        schemaId: padText("birth-credential:v1"),
        majorVersion: 1n,
        minorVersion: 0n,
      },
      issuerVerificationMethodId: issuer.verificationMethodId,
      holderBinding: {
        holderSecretCommitment:
          genericPureCircuits.secretHolderBindingCommitment(
            witness.holderSecret,
            witness.holderSecretOpening,
          ),
        requestChallengeResponse:
          genericPureCircuits.noSecretHolderChallengeResponse(),
      },
      issuedAt: 10_000n,
      hasExpiration: true,
      expiresAt: 20_000n,
      claims,
      claimRoot: pureCircuits.birthCredentialClaimRoot(claims),
    };

    const credentialProof = signProof({
      bodyRoot: pureCircuits.secretBirthCredentialBodyRoot(credential),
      signer: issuer,
      createdAt: 10_001n,
      challengeHash: sha256("challenge:issuance"),
      nonceScalar: 11n,
    });

    const presentationRequest: BirthCredentialPresentationRequest = {
      version: 1n,
      schema: credential.schema,
      issuerVerificationMethodId: credential.issuerVerificationMethodId,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: true,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18n,
      verifierChallengeHash: sha256("challenge:verifier"),
    };

    const presentation: SecretBirthCredentialPresentation = {
      version: 1n,
      schema: credential.schema,
      credentialClaimRoot: credential.claimRoot,
      issuerVerificationMethodId: credential.issuerVerificationMethodId,
      holderBinding: {
        holderSecretCommitment: credential.holderBinding.holderSecretCommitment,
        requestChallengeResponse:
          genericPureCircuits.secretHolderBindingChallengeResponse(
            witness.holderSecret,
            presentationRequest.verifierChallengeHash,
          ),
      },
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

    return {
      issuer,
      credential,
      credentialProof,
      presentationRequest,
      presentation,
      witness,
    };
  };
