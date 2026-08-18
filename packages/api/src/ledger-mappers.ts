import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  CurveType,
  decodeBase64UrlBytes,
  KeyType,
  PublicKeyJwk,
  publicKeyJwkCoordinateByteLength,
  Service,
  serviceEndpointToLedger as serviceEndpointToLedgerValue,
  serviceTypeToLedger as serviceTypeToLedgerValue,
  VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";

import { getDidSubject, normalizeBoundFragmentId } from "./did-subject.js";
import {
  type DeployedMidnightDIDContract,
  type SchnorrJubjubVerificationMethod,
} from "./types.js";

const LedgerKeyType = DIDContract.KeyType;
const LedgerCurveType = DIDContract.CurveType;
const LedgerVerificationMethodType = DIDContract.VerificationMethodType;
const LedgerVerificationMethodRelation = DIDContract.VerificationMethodRelation;

const LedgerKeyTypeMap: Record<
  KeyType,
  (typeof LedgerKeyType)[keyof typeof LedgerKeyType]
> = {
  [KeyType.EC]: LedgerKeyType.EC,
  [KeyType.RSA]: LedgerKeyType.RSA,
  [KeyType.oct]: LedgerKeyType.oct,
  [KeyType.OKP]: LedgerKeyType.OKP,
};

const LedgerCurveTypeMap: Record<
  CurveType,
  (typeof LedgerCurveType)[keyof typeof LedgerCurveType]
> = {
  [CurveType.Ed25519]: LedgerCurveType.Ed25519,
  [CurveType.X25519]: LedgerCurveType.X25519,
  [CurveType.Jubjub]: LedgerCurveType.Jubjub,
  [CurveType.P256]: LedgerCurveType.P256,
  [CurveType.Secp256k1]: LedgerCurveType.Secp256k1,
  [CurveType.BLS12381G1]: LedgerCurveType.BLS12381G1,
  [CurveType.BLS12381G2]: LedgerCurveType.BLS12381G2,
};

const LedgerVerificationMethodTypeMap: Record<
  VerificationMethodType,
  (typeof LedgerVerificationMethodType)[keyof typeof LedgerVerificationMethodType]
> = {
  [VerificationMethodType.Undefined]: LedgerVerificationMethodType.Undefined,
  [VerificationMethodType.JsonWebKey]: LedgerVerificationMethodType.JsonWebKey,
};

export const LedgerVerificationMethodRelationMap: Record<
  VerificationMethodRelationType,
  (typeof LedgerVerificationMethodRelation)[keyof typeof LedgerVerificationMethodRelation]
> = {
  [VerificationMethodRelationType.Undefined]:
    LedgerVerificationMethodRelation.Undefined,
  [VerificationMethodRelationType.Authentication]:
    LedgerVerificationMethodRelation.Authentication,
  [VerificationMethodRelationType.AssertionMethod]:
    LedgerVerificationMethodRelation.AssertionMethod,
  [VerificationMethodRelationType.KeyAgreement]:
    LedgerVerificationMethodRelation.KeyAgreement,
  [VerificationMethodRelationType.CapabilityInvocation]:
    LedgerVerificationMethodRelation.CapabilityInvocation,
  [VerificationMethodRelationType.CapabilityDelegation]:
    LedgerVerificationMethodRelation.CapabilityDelegation,
};

const publicKeyJwkToLedger = (
  publicKeyJwk: PublicKeyJwk,
): DIDContract.PublicKeyJwk => {
  if ("d" in publicKeyJwk) {
    throw new Error("publicKeyJwk must not include private key material");
  }
  const kty = LedgerKeyTypeMap[publicKeyJwk.kty];
  const crv = LedgerCurveTypeMap[publicKeyJwk.crv];
  const xLength = publicKeyJwkCoordinateByteLength(publicKeyJwk, "x");
  if (xLength === undefined) {
    throw new Error(
      `Unsupported publicKeyJwk.x profile ${publicKeyJwk.kty}/${publicKeyJwk.crv}`,
    );
  }
  decodeBase64UrlBytes(publicKeyJwk.x, xLength, "publicKeyJwk.x");
  if (publicKeyJwk.y !== undefined) {
    const yLength = publicKeyJwkCoordinateByteLength(publicKeyJwk, "y");
    if (yLength === undefined) {
      throw new Error(
        `Unsupported publicKeyJwk.y profile ${publicKeyJwk.kty}/${publicKeyJwk.crv}`,
      );
    }
    decodeBase64UrlBytes(publicKeyJwk.y, yLength, "publicKeyJwk.y");
  }

  return {
    kty,
    crv,
    x: publicKeyJwk.x,
    y: publicKeyJwk.y ?? "",
  };
};

const assertMidnightKeyProfile = (publicKeyJwk: PublicKeyJwk): void => {
  if (publicKeyJwk.kty === KeyType.OKP) {
    if (
      publicKeyJwk.crv !== CurveType.Ed25519 &&
      publicKeyJwk.crv !== CurveType.X25519 &&
      publicKeyJwk.crv !== CurveType.BLS12381G1 &&
      publicKeyJwk.crv !== CurveType.BLS12381G2
    ) {
      throw new Error(
        "OKP keys must use Ed25519, X25519, BLS12381G1, or BLS12381G2",
      );
    }
    if (publicKeyJwk.y !== undefined) {
      throw new Error("OKP keys must not include a y coordinate");
    }
    return;
  }
  if (publicKeyJwk.kty === KeyType.EC) {
    if (publicKeyJwk.crv === CurveType.Jubjub) {
      throw new Error(
        "Jubjub keys must use addSchnorrJubjubVerificationMethod",
      );
    }
    if (
      publicKeyJwk.crv !== CurveType.P256 &&
      publicKeyJwk.crv !== CurveType.Secp256k1
    ) {
      throw new Error(
        "EC keys must use P-256 or secp256k1; use SchnorrJubjub methods for Jubjub",
      );
    }
    if (publicKeyJwk.y === undefined) {
      throw new Error("EC keys must include a y coordinate");
    }
    return;
  }
  throw new Error(
    "Only OKP (Ed25519/X25519/BLS12381G1/BLS12381G2) and EC (P-256/secp256k1) keys are supported",
  );
};

export const verificationMethodToLedger = (
  didContract: DeployedMidnightDIDContract,
  method: VerificationMethod,
): DIDContract.VerificationMethod => {
  if (method.type !== VerificationMethodType.JsonWebKey) {
    throw new Error("verificationMethod.type must be JsonWebKey");
  }
  assertMidnightKeyProfile(method.publicKeyJwk);
  const didSubject = getDidSubject(didContract);
  if (method.controller !== didSubject) {
    throw new Error(
      `verificationMethod.controller must equal DID subject (${didSubject})`,
    );
  }
  return {
    id: normalizeBoundFragmentId(
      didContract,
      method.id,
      "verificationMethod.id",
    ),
    typ: LedgerVerificationMethodTypeMap[method.type],
    publicKeyJwk: publicKeyJwkToLedger(method.publicKeyJwk),
  };
};

export const schnorrJubjubVerificationMethodToLedger = (
  didContract: DeployedMidnightDIDContract,
  method: SchnorrJubjubVerificationMethod,
): DIDContract.SchnorrJubjubVerificationMethod => ({
  id: normalizeBoundFragmentId(
    didContract,
    method.id,
    "schnorrJubjubVerificationMethod.id",
  ),
  publicKey: method.publicKey,
});

export const serviceToLedger = (
  didContract: DeployedMidnightDIDContract,
  service: Service,
): DIDContract.Service => {
  let endpoint: string;
  try {
    endpoint = serviceEndpointToLedgerValue(service.serviceEndpoint);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("serviceEndpoint values must be unique")
    ) {
      throw error;
    }
    throw new Error("Invalid serviceEndpoint: could not serialize to JSON");
  }

  return {
    id: normalizeBoundFragmentId(didContract, service.id, "service.id"),
    typ: serviceTypeToLedgerValue(service.type),
    serviceEndpoint: endpoint,
  };
};

export const relationSetFromState = (
  didState: DIDContract.Ledger,
  relation: VerificationMethodRelationType,
) => {
  switch (relation) {
    case VerificationMethodRelationType.Authentication:
      return didState.authenticationRelation;
    case VerificationMethodRelationType.AssertionMethod:
      return didState.assertionMethodRelation;
    case VerificationMethodRelationType.KeyAgreement:
      return didState.keyAgreementRelation;
    case VerificationMethodRelationType.CapabilityInvocation:
      return didState.capabilityInvocationRelation;
    case VerificationMethodRelationType.CapabilityDelegation:
      return didState.capabilityDelegationRelation;
    case VerificationMethodRelationType.Undefined:
      throw new Error("relation must be defined");
  }
};
