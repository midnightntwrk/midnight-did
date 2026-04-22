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
  Proof,
  SanctionScreeningCredential,
  SanctionScreeningCredentialClaims,
  SanctionScreeningCredentialDisclosures,
  SanctionScreeningCredentialPresentation,
  SchemaRef,
  Signature,
  VerificationMethodRef,
} from "./managed/sanction-screening-credential/contract/index.js";

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

export const sanctionScreeningProofDescriptor: CompactType<Proof> = {
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

const sanctionClaimsDescriptor: CompactType<SanctionScreeningCredentialClaims> =
  {
    alignment: () =>
      bytes32
        .alignment()
        .concat(
          uint8
            .alignment()
            .concat(
              CompactTypeBoolean.alignment().concat(
                uint8
                  .alignment()
                  .concat(
                    uint16
                      .alignment()
                      .concat(
                        uint8
                          .alignment()
                          .concat(
                            bytes32.alignment().concat(uint32.alignment()),
                          ),
                      ),
                  ),
              ),
            ),
        ),
    fromValue: (value: Value): SanctionScreeningCredentialClaims => ({
      subjectIdCommitment: bytes32.fromValue(value),
      screeningResult: uint8.fromValue(value),
      isPep: CompactTypeBoolean.fromValue(value),
      sanctionsListsChecked: uint8.fromValue(value),
      issuerJurisdiction: uint16.fromValue(value),
      riskLevel: uint8.fromValue(value),
      screeningDateCommitment: bytes32.fromValue(value),
      validUntilDay: uint32.fromValue(value),
    }),
    toValue: (value: SanctionScreeningCredentialClaims): Value =>
      bytes32
        .toValue(value.subjectIdCommitment)
        .concat(
          uint8
            .toValue(value.screeningResult)
            .concat(
              CompactTypeBoolean.toValue(value.isPep).concat(
                uint8
                  .toValue(value.sanctionsListsChecked)
                  .concat(
                    uint16
                      .toValue(value.issuerJurisdiction)
                      .concat(
                        uint8
                          .toValue(value.riskLevel)
                          .concat(
                            bytes32
                              .toValue(value.screeningDateCommitment)
                              .concat(uint32.toValue(value.validUntilDay)),
                          ),
                      ),
                  ),
              ),
            ),
        ),
  };

export const sanctionScreeningCredentialDescriptor: CompactType<SanctionScreeningCredential> =
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
                                sanctionClaimsDescriptor
                                  .alignment()
                                  .concat(bytes32.alignment()),
                              ),
                          ),
                        ),
                    ),
                ),
            ),
        ),
    fromValue: (value: Value): SanctionScreeningCredential => ({
      version: uint16.fromValue(value),
      schema: schemaRefDescriptor.fromValue(value),
      issuerVerificationMethodRef:
        verificationMethodRefDescriptor.fromValue(value),
      holderBinding: blindedHolderBindingDescriptor.fromValue(value),
      issuedAt: uint64.fromValue(value),
      hasExpiration: CompactTypeBoolean.fromValue(value),
      expiresAt: uint64.fromValue(value),
      claims: sanctionClaimsDescriptor.fromValue(value),
      claimRoot: bytes32.fromValue(value),
    }),
    toValue: (value: SanctionScreeningCredential): Value =>
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
                                sanctionClaimsDescriptor
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

const sanctionDisclosuresDescriptor: CompactType<SanctionScreeningCredentialDisclosures> =
  {
    alignment: () =>
      CompactTypeBoolean.alignment().concat(
        uint8
          .alignment()
          .concat(
            CompactTypeBoolean.alignment().concat(
              CompactTypeBoolean.alignment().concat(
                CompactTypeBoolean.alignment().concat(
                  bytes32
                    .alignment()
                    .concat(
                      CompactTypeBoolean.alignment().concat(
                        uint32
                          .alignment()
                          .concat(CompactTypeBoolean.alignment()),
                      ),
                    ),
                ),
              ),
            ),
          ),
      ),
    fromValue: (value: Value): SanctionScreeningCredentialDisclosures => ({
      revealScreeningResult: CompactTypeBoolean.fromValue(value),
      screeningResult: uint8.fromValue(value),
      revealPepStatus: CompactTypeBoolean.fromValue(value),
      isPep: CompactTypeBoolean.fromValue(value),
      revealVerifierScopedPseudonym: CompactTypeBoolean.fromValue(value),
      verifierScopedPseudonym: bytes32.fromValue(value),
      proveScreeningFresh: CompactTypeBoolean.fromValue(value),
      maxScreeningAgeDays: uint32.fromValue(value),
      proveNotExpired: CompactTypeBoolean.fromValue(value),
    }),
    toValue: (value: SanctionScreeningCredentialDisclosures): Value =>
      CompactTypeBoolean.toValue(value.revealScreeningResult).concat(
        uint8
          .toValue(value.screeningResult)
          .concat(
            CompactTypeBoolean.toValue(value.revealPepStatus).concat(
              CompactTypeBoolean.toValue(value.isPep).concat(
                CompactTypeBoolean.toValue(
                  value.revealVerifierScopedPseudonym,
                ).concat(
                  bytes32
                    .toValue(value.verifierScopedPseudonym)
                    .concat(
                      CompactTypeBoolean.toValue(
                        value.proveScreeningFresh,
                      ).concat(
                        uint32
                          .toValue(value.maxScreeningAgeDays)
                          .concat(
                            CompactTypeBoolean.toValue(value.proveNotExpired),
                          ),
                      ),
                    ),
                ),
              ),
            ),
          ),
      ),
  };

export const sanctionScreeningPresentationDescriptor: CompactType<SanctionScreeningCredentialPresentation> =
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
                        .concat(sanctionDisclosuresDescriptor.alignment()),
                    ),
                ),
            ),
        ),
    fromValue: (value: Value): SanctionScreeningCredentialPresentation => ({
      version: uint16.fromValue(value),
      schema: schemaRefDescriptor.fromValue(value),
      credentialClaimRoot: bytes32.fromValue(value),
      issuerVerificationMethodRef:
        verificationMethodRefDescriptor.fromValue(value),
      holderBinding: blindedHolderBindingDescriptor.fromValue(value),
      disclosed: sanctionDisclosuresDescriptor.fromValue(value),
    }),
    toValue: (value: SanctionScreeningCredentialPresentation): Value =>
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
                          sanctionDisclosuresDescriptor.toValue(
                            value.disclosed,
                          ),
                        ),
                    ),
                ),
            ),
        ),
  };

export const encodeSanctionScreeningCredential = (
  credential: SanctionScreeningCredential,
): EncodedCompactValue =>
  encodeCompactPayload(sanctionScreeningCredentialDescriptor, credential);

export const decodeSanctionScreeningCredential = (
  encoded: EncodedCompactValue,
): SanctionScreeningCredential =>
  decodeCompactPayload(sanctionScreeningCredentialDescriptor, encoded);

export const encodeSanctionScreeningPresentation = (
  presentation: SanctionScreeningCredentialPresentation,
): EncodedCompactValue =>
  encodeCompactPayload(sanctionScreeningPresentationDescriptor, presentation);

export const decodeSanctionScreeningPresentation = (
  encoded: EncodedCompactValue,
): SanctionScreeningCredentialPresentation =>
  decodeCompactPayload(sanctionScreeningPresentationDescriptor, encoded);

export const encodeSanctionScreeningProof = (
  proof: Proof,
): EncodedCompactValue =>
  encodeCompactPayload(sanctionScreeningProofDescriptor, proof);

export const decodeSanctionScreeningProof = (
  encoded: EncodedCompactValue,
): Proof => decodeCompactPayload(sanctionScreeningProofDescriptor, encoded);
