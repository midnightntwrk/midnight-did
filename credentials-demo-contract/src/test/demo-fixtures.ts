import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";

import {
  ecMulGenerator,
  type JubjubPoint,
} from "@midnight-ntwrk/compact-runtime";

import {
  type BirthCredential,
  type BirthCredentialPresentation,
  CredentialProofPurpose,
  CredentialTypeId,
  type JubjubCredentialProof,
  pureCircuits,
  type VerificationMethodId,
} from "../managed/demo/contract/index.js";

const JUBJUB_FIELD_MODULUS =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

export type JubjubSigner = {
  readonly label: string;
  readonly secretKey: bigint;
  readonly publicKey: JubjubPoint;
  readonly verificationMethodId: VerificationMethodId;
};

export type BirthCredentialFixture = {
  readonly issuer: JubjubSigner;
  readonly holder: JubjubSigner;
  readonly credential: BirthCredential;
  readonly credentialProof: JubjubCredentialProof;
  readonly presentation: BirthCredentialPresentation;
  readonly presentationProof: JubjubCredentialProof;
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

export const createJubjubSigner = (
  label: string,
  secretKey: bigint,
  methodIndex: bigint,
): JubjubSigner => ({
  label,
  secretKey,
  publicKey: ecMulGenerator(secretKey),
  verificationMethodId: {
    didContractAddress: contractAddress(label),
    methodIndex,
  },
});

export const signCredentialProof = ({
  bodyRoot,
  purpose,
  signer,
  createdAt,
  challengeHash,
  nonceScalar,
}: {
  readonly bodyRoot: Uint8Array;
  readonly purpose: CredentialProofPurpose;
  readonly signer: JubjubSigner;
  readonly createdAt: bigint;
  readonly challengeHash: Uint8Array;
  readonly nonceScalar: bigint;
}): JubjubCredentialProof => {
  const proof: JubjubCredentialProof = {
    purpose,
    signerVerificationMethodId: signer.verificationMethodId,
    createdAt,
    challengeHash,
    publicKey: signer.publicKey,
    signature: {
      r: ecMulGenerator(nonceScalar),
      s: 0n,
    },
  };
  const challenge = pureCircuits.jubjubProofChallenge(bodyRoot, proof);
  return {
    ...proof,
    signature: {
      r: proof.signature.r,
      s: mod(nonceScalar + challenge * signer.secretKey),
    },
  };
};

export const createBirthCredentialFixture = (): BirthCredentialFixture => {
  const issuer = createJubjubSigner("issuer", 123456789n, 1n);
  const holder = createJubjubSigner("holder", 987654321n, 1n);

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
    credentialType: CredentialTypeId.BirthCredential,
    schema: {
      packageId: padText("midnight-did:vc"),
      schemaId: padText("birth-credential:v1"),
      majorVersion: 1n,
      minorVersion: 0n,
    },
    issuerVerificationMethodId: issuer.verificationMethodId,
    holderBinding: {
      holderVerificationMethodId: holder.verificationMethodId,
    },
    issuedAt: 10_000n,
    hasExpiration: true,
    expiresAt: 20_000n,
    claims,
    claimRoot: pureCircuits.birthCredentialClaimRoot(claims),
  };

  const credentialProof = signCredentialProof({
    bodyRoot: pureCircuits.birthCredentialBodyRoot(credential),
    purpose: CredentialProofPurpose.CredentialIssuance,
    signer: issuer,
    createdAt: 10_001n,
    challengeHash: sha256("challenge:issuance"),
    nonceScalar: 11n,
  });

  const presentation: BirthCredentialPresentation = {
    version: 1n,
    credentialType: CredentialTypeId.BirthCredentialPresentation,
    schema: credential.schema,
    credentialClaimRoot: credential.claimRoot,
    issuerVerificationMethodId: credential.issuerVerificationMethodId,
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

  const presentationProof = signCredentialProof({
    bodyRoot: pureCircuits.birthCredentialPresentationBodyRoot(presentation),
    purpose: CredentialProofPurpose.PresentationAuthentication,
    signer: holder,
    createdAt: 10_100n,
    challengeHash: sha256("challenge:verifier"),
    nonceScalar: 17n,
  });

  return {
    issuer,
    holder,
    credential,
    credentialProof,
    presentation,
    presentationProof,
    witness,
  };
};
