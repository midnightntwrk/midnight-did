import { OperationBuilder } from "../../ledger-operation-builder";
import {
  CurveType,
  KeyType,
  VerificationMethodRelation,
  VerificationMethodType
} from "../../managed/did/contract/index.js";
import { MidnightDIDSimulator } from "../midnight-did-simulator";

export const mockVerificationMethod = {
  id: "did:midnight:xyz#key-1",
  typ: VerificationMethodType.JsonWebKey,
  publicKeyJwk: {
    kty: KeyType.OKP,
    crv: CurveType.Ed25519,
    x: 0n,
    y: 0n
  }
};

export const mockAuthenticationRelation = {
  relation: VerificationMethodRelation.Authentication,
  methodId: mockVerificationMethod.id
};

export const createSimulator = () => new MidnightDIDSimulator();

export const addVerificationMethod = () =>
  OperationBuilder.addVerificationMethod({
    verificationMethod: mockVerificationMethod
  });

export const addAuthenticationRelation = () =>
  OperationBuilder.addVerificationMethodRelation(mockAuthenticationRelation);
