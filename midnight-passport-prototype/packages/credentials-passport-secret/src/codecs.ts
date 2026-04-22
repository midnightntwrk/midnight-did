import {
  type CompactType,
  CompactTypeBoolean,
  CompactTypeBytes,
  CompactTypeField,
  CompactTypeJubjubPoint,
  CompactTypeUnsignedInteger,
  type Value,
} from "@midnight-ntwrk/compact-runtime";
import {
  decodeCompactPayload,
  encodeCompactPayload,
  type EncodedCompactValue,
} from "@midnight-ntwrk/midnight-did-credentials-openid";

import type {
  BlindedSecretHolderBinding,
  PassportCredentialClaims,
  Proof,
  SchemaRef,
  SecretPassportCredential,
  SecretPassportCredentialDisclosures,
  SecretPassportCredentialPresentation,
  Signature,
  VerificationMethodRef,
} from "./managed/secret-passport-credential/contract/index.js";

const uint8 = new CompactTypeUnsignedInteger(255n, 1);
const uint16 = new CompactTypeUnsignedInteger(65_535n, 2);
const uint32 = new CompactTypeUnsignedInteger(4_294_967_295n, 4);
const uint64 = new CompactTypeUnsignedInteger(18_446_744_073_709_551_615n, 8);
const bytes32 = new CompactTypeBytes(32);

const schemaRefDescriptor: CompactType<SchemaRef> = {
  alignment: () =>
    bytes32
      .alignment()
      .concat(
        bytes32
          .alignment()
          .concat(uint16.alignment().concat(uint16.alignment())),
      ),
  fromValue: (value: Value): SchemaRef => ({
    packageId: bytes32.fromValue(value),
    schemaId: bytes32.fromValue(value),
    majorVersion: uint16.fromValue(value),
    minorVersion: uint16.fromValue(value),
  }),
  toValue: (value: SchemaRef): Value =>
    bytes32
      .toValue(value.packageId)
      .concat(
        bytes32
          .toValue(value.schemaId)
          .concat(
            uint16
              .toValue(value.majorVersion)
              .concat(uint16.toValue(value.minorVersion)),
          ),
      ),
};

const contractAddressDescriptor: CompactType<{ bytes: Uint8Array }> = {
  alignment: () => bytes32.alignment(),
  fromValue: (value: Value) => ({ bytes: bytes32.fromValue(value) }),
  toValue: (value) => bytes32.toValue(value.bytes),
};

const verificationMethodRefDescriptor: CompactType<VerificationMethodRef> = {
  alignment: () =>
    contractAddressDescriptor.alignment().concat(bytes32.alignment()),
  fromValue: (value: Value): VerificationMethodRef => ({
    didContractAddress: contractAddressDescriptor.fromValue(value),
    methodId: bytes32.fromValue(value),
  }),
  toValue: (value: VerificationMethodRef): Value =>
    contractAddressDescriptor
      .toValue(value.didContractAddress)
      .concat(bytes32.toValue(value.methodId)),
};

const blindedHolderBindingDescriptor: CompactType<BlindedSecretHolderBinding> =
  {
    alignment: () =>
      bytes32
        .alignment()
        .concat(bytes32.alignment().concat(bytes32.alignment())),
    fromValue: (value: Value): BlindedSecretHolderBinding => ({
      blindedHolderSecretCommitment: bytes32.fromValue(value),
      issuerNonce: bytes32.fromValue(value),
      requestChallengeResponse: bytes32.fromValue(value),
    }),
    toValue: (value: BlindedSecretHolderBinding): Value =>
      bytes32
        .toValue(value.blindedHolderSecretCommitment)
        .concat(
          bytes32
            .toValue(value.issuerNonce)
            .concat(bytes32.toValue(value.requestChallengeResponse)),
        ),
  };

const signatureDescriptor: CompactType<Signature> = {
  alignment: () =>
    CompactTypeJubjubPoint.alignment().concat(CompactTypeField.alignment()),
  fromValue: (value: Value): Signature => ({
    r: CompactTypeJubjubPoint.fromValue(value),
    s: CompactTypeField.fromValue(value),
  }),
  toValue: (value: Signature): Value =>
    CompactTypeJubjubPoint.toValue(value.r).concat(
      CompactTypeField.toValue(value.s),
    ),
};

export const secretPassportProofDescriptor: CompactType<Proof> = {
  alignment: () =>
    verificationMethodRefDescriptor
      .alignment()
      .concat(
        uint64
          .alignment()
          .concat(
            bytes32
              .alignment()
              .concat(
                CompactTypeJubjubPoint.alignment().concat(
                  signatureDescriptor.alignment(),
                ),
              ),
          ),
      ),
  fromValue: (value: Value): Proof => ({
    signerVerificationMethodRef:
      verificationMethodRefDescriptor.fromValue(value),
    createdAt: uint64.fromValue(value),
    challengeHash: bytes32.fromValue(value),
    publicKey: CompactTypeJubjubPoint.fromValue(value),
    signature: signatureDescriptor.fromValue(value),
  }),
  toValue: (value: Proof): Value =>
    verificationMethodRefDescriptor
      .toValue(value.signerVerificationMethodRef)
      .concat(
        uint64
          .toValue(value.createdAt)
          .concat(
            bytes32
              .toValue(value.challengeHash)
              .concat(
                CompactTypeJubjubPoint.toValue(value.publicKey).concat(
                  signatureDescriptor.toValue(value.signature),
                ),
              ),
          ),
      ),
};

const countryCodeDescriptor: CompactType<{ value: bigint }> = {
  alignment: () => uint16.alignment(),
  fromValue: (value: Value) => ({ value: uint16.fromValue(value) }),
  toValue: (value) => uint16.toValue(value.value),
};

const passportClaimsDescriptor: CompactType<PassportCredentialClaims> = {
  alignment: () =>
    bytes32
      .alignment()
      .concat(
        countryCodeDescriptor
          .alignment()
          .concat(
            bytes32
              .alignment()
              .concat(
                bytes32
                  .alignment()
                  .concat(
                    bytes32
                      .alignment()
                      .concat(
                        bytes32
                          .alignment()
                          .concat(
                            bytes32.alignment().concat(uint32.alignment()),
                          ),
                      ),
                  ),
              ),
          ),
      ),
  fromValue: (value: Value): PassportCredentialClaims => ({
    documentNumberCommitment: bytes32.fromValue(value),
    issuingCountry: countryCodeDescriptor.fromValue(value),
    nationalityCommitment: bytes32.fromValue(value),
    givenNameCommitment: bytes32.fromValue(value),
    familyNameCommitment: bytes32.fromValue(value),
    birthDateCommitment: bytes32.fromValue(value),
    genderCommitment: bytes32.fromValue(value),
    expiryDate: uint32.fromValue(value),
  }),
  toValue: (value: PassportCredentialClaims): Value =>
    bytes32
      .toValue(value.documentNumberCommitment)
      .concat(
        countryCodeDescriptor
          .toValue(value.issuingCountry)
          .concat(
            bytes32
              .toValue(value.nationalityCommitment)
              .concat(
                bytes32
                  .toValue(value.givenNameCommitment)
                  .concat(
                    bytes32
                      .toValue(value.familyNameCommitment)
                      .concat(
                        bytes32
                          .toValue(value.birthDateCommitment)
                          .concat(
                            bytes32
                              .toValue(value.genderCommitment)
                              .concat(uint32.toValue(value.expiryDate)),
                          ),
                      ),
                  ),
              ),
          ),
      ),
};

export const secretPassportCredentialDescriptor: CompactType<SecretPassportCredential> =
  {
    alignment: () =>
      uint16
        .alignment()
        .concat(
          schemaRefDescriptor
            .alignment()
            .concat(
              verificationMethodRefDescriptor
                .alignment()
                .concat(
                  blindedHolderBindingDescriptor
                    .alignment()
                    .concat(
                      uint64
                        .alignment()
                        .concat(
                          CompactTypeBoolean.alignment().concat(
                            uint64
                              .alignment()
                              .concat(
                                passportClaimsDescriptor
                                  .alignment()
                                  .concat(bytes32.alignment()),
                              ),
                          ),
                        ),
                    ),
                ),
            ),
        ),
    fromValue: (value: Value): SecretPassportCredential => ({
      version: uint16.fromValue(value),
      schema: schemaRefDescriptor.fromValue(value),
      issuerVerificationMethodRef:
        verificationMethodRefDescriptor.fromValue(value),
      holderBinding: blindedHolderBindingDescriptor.fromValue(value),
      issuedAt: uint64.fromValue(value),
      hasExpiration: CompactTypeBoolean.fromValue(value),
      expiresAt: uint64.fromValue(value),
      claims: passportClaimsDescriptor.fromValue(value),
      claimRoot: bytes32.fromValue(value),
    }),
    toValue: (value: SecretPassportCredential): Value =>
      uint16
        .toValue(value.version)
        .concat(
          schemaRefDescriptor
            .toValue(value.schema)
            .concat(
              verificationMethodRefDescriptor
                .toValue(value.issuerVerificationMethodRef)
                .concat(
                  blindedHolderBindingDescriptor
                    .toValue(value.holderBinding)
                    .concat(
                      uint64
                        .toValue(value.issuedAt)
                        .concat(
                          CompactTypeBoolean.toValue(
                            value.hasExpiration,
                          ).concat(
                            uint64
                              .toValue(value.expiresAt)
                              .concat(
                                passportClaimsDescriptor
                                  .toValue(value.claims)
                                  .concat(bytes32.toValue(value.claimRoot)),
                              ),
                          ),
                        ),
                    ),
                ),
            ),
        ),
  };

const passportDisclosuresDescriptor: CompactType<SecretPassportCredentialDisclosures> =
  {
    alignment: () =>
      CompactTypeBoolean.alignment().concat(
        uint16
          .alignment()
          .concat(
            bytes32
              .alignment()
              .concat(
                CompactTypeBoolean.alignment().concat(
                  uint8
                    .alignment()
                    .concat(
                      bytes32
                        .alignment()
                        .concat(
                          CompactTypeBoolean.alignment().concat(
                            bytes32
                              .alignment()
                              .concat(
                                CompactTypeBoolean.alignment().concat(
                                  uint8
                                    .alignment()
                                    .concat(CompactTypeBoolean.alignment()),
                                ),
                              ),
                          ),
                        ),
                    ),
                ),
              ),
          ),
      ),
    fromValue: (value: Value): SecretPassportCredentialDisclosures => ({
      revealNationality: CompactTypeBoolean.fromValue(value),
      nationalityValue: uint16.fromValue(value),
      nationalityOpening: bytes32.fromValue(value),
      revealGender: CompactTypeBoolean.fromValue(value),
      genderValue: uint8.fromValue(value),
      genderOpening: bytes32.fromValue(value),
      revealVerifierScopedPseudonym: CompactTypeBoolean.fromValue(value),
      verifierScopedPseudonym: bytes32.fromValue(value),
      proveAgeOverThreshold: CompactTypeBoolean.fromValue(value),
      ageThresholdYears: uint8.fromValue(value),
      proveNotExpired: CompactTypeBoolean.fromValue(value),
    }),
    toValue: (value: SecretPassportCredentialDisclosures): Value =>
      CompactTypeBoolean.toValue(value.revealNationality).concat(
        uint16
          .toValue(value.nationalityValue)
          .concat(
            bytes32
              .toValue(value.nationalityOpening)
              .concat(
                CompactTypeBoolean.toValue(value.revealGender).concat(
                  uint8
                    .toValue(value.genderValue)
                    .concat(
                      bytes32
                        .toValue(value.genderOpening)
                        .concat(
                          CompactTypeBoolean.toValue(
                            value.revealVerifierScopedPseudonym,
                          ).concat(
                            bytes32
                              .toValue(value.verifierScopedPseudonym)
                              .concat(
                                CompactTypeBoolean.toValue(
                                  value.proveAgeOverThreshold,
                                ).concat(
                                  uint8
                                    .toValue(value.ageThresholdYears)
                                    .concat(
                                      CompactTypeBoolean.toValue(
                                        value.proveNotExpired,
                                      ),
                                    ),
                                ),
                              ),
                          ),
                        ),
                    ),
                ),
              ),
          ),
      ),
  };

export const secretPassportPresentationDescriptor: CompactType<SecretPassportCredentialPresentation> =
  {
    alignment: () =>
      uint16
        .alignment()
        .concat(
          schemaRefDescriptor
            .alignment()
            .concat(
              bytes32
                .alignment()
                .concat(
                  verificationMethodRefDescriptor
                    .alignment()
                    .concat(
                      blindedHolderBindingDescriptor
                        .alignment()
                        .concat(passportDisclosuresDescriptor.alignment()),
                    ),
                ),
            ),
        ),
    fromValue: (value: Value): SecretPassportCredentialPresentation => ({
      version: uint16.fromValue(value),
      schema: schemaRefDescriptor.fromValue(value),
      credentialClaimRoot: bytes32.fromValue(value),
      issuerVerificationMethodRef:
        verificationMethodRefDescriptor.fromValue(value),
      holderBinding: blindedHolderBindingDescriptor.fromValue(value),
      disclosed: passportDisclosuresDescriptor.fromValue(value),
    }),
    toValue: (value: SecretPassportCredentialPresentation): Value =>
      uint16
        .toValue(value.version)
        .concat(
          schemaRefDescriptor
            .toValue(value.schema)
            .concat(
              bytes32
                .toValue(value.credentialClaimRoot)
                .concat(
                  verificationMethodRefDescriptor
                    .toValue(value.issuerVerificationMethodRef)
                    .concat(
                      blindedHolderBindingDescriptor
                        .toValue(value.holderBinding)
                        .concat(
                          passportDisclosuresDescriptor.toValue(
                            value.disclosed,
                          ),
                        ),
                    ),
                ),
            ),
        ),
  };

export const encodeSecretPassportCredential = (
  credential: SecretPassportCredential,
): EncodedCompactValue =>
  encodeCompactPayload(secretPassportCredentialDescriptor, credential);

export const decodeSecretPassportCredential = (
  encoded: EncodedCompactValue,
): SecretPassportCredential =>
  decodeCompactPayload(secretPassportCredentialDescriptor, encoded);

export const encodeSecretPassportPresentation = (
  presentation: SecretPassportCredentialPresentation,
): EncodedCompactValue =>
  encodeCompactPayload(secretPassportPresentationDescriptor, presentation);

export const decodeSecretPassportPresentation = (
  encoded: EncodedCompactValue,
): SecretPassportCredentialPresentation =>
  decodeCompactPayload(secretPassportPresentationDescriptor, encoded);

export const encodeSecretPassportProof = (proof: Proof): EncodedCompactValue =>
  encodeCompactPayload(secretPassportProofDescriptor, proof);

export const decodeSecretPassportProof = (
  encoded: EncodedCompactValue,
): Proof => decodeCompactPayload(secretPassportProofDescriptor, encoded);
