import { Buffer } from "buffer";
import { z } from "zod/v4-mini";
import {
  createDIDDocument,
  createVerificationMethod,
  CurveType,
  DIDDocument,
  KeyType,
  PublicKeyJwk,
  Service,
  VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
  FieldCodec,
  MidnightNetwork,
  createMidnightDIDString,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did-domain";
import {
  CurveType as LedgerCurveType,
  KeyType as LedgerKeyType,
  Ledger,
  PublicKeyJwk as LedgerPublicKeyJwk,
  Service as LedgerService,
  VerificationMethod as LedgerVerificationMethod,
  VerificationMethodRelation as LedgerVerificationMethodRelation,
  VerificationMethodType as LedgerVerificationMethodType,
} from "@midnight-ntwrk/midnight-did-contract/dist/managed/did/contract/index.cjs";

export class LedgerToDomain {
  static readonly KeyTypeMap: Record<LedgerKeyType, KeyType> = {
    [LedgerKeyType.EC]: KeyType.EC,
    [LedgerKeyType.RSA]: KeyType.RSA,
    [LedgerKeyType.oct]: KeyType.oct,
    [LedgerKeyType.OKP]: KeyType.OKP,
  };

  static readonly CurveTypeMap: Record<LedgerCurveType, CurveType> = {
    [LedgerCurveType.ed25519]: CurveType.ed25519,
    [LedgerCurveType.Jubjub]: CurveType.Jubjub,
  };

  static readonly VerificationMethodTypeMap: Record<
    LedgerVerificationMethodType,
    VerificationMethodType
  > = {
    [LedgerVerificationMethodType.Undefined]: VerificationMethodType.Undefined,
    [LedgerVerificationMethodType.JsonWebKey]: VerificationMethodType.JsonWebKey,
  };

  static readonly VerificationMethodRelationMap: Record<
    LedgerVerificationMethodRelation,
    VerificationMethodRelationType
  > = {
    [LedgerVerificationMethodRelation.Undefined]:
      VerificationMethodRelationType.Undefined,
    [LedgerVerificationMethodRelation.Authentication]:
      VerificationMethodRelationType.Authentication,
    [LedgerVerificationMethodRelation.AssertionMethod]:
      VerificationMethodRelationType.AssertionMethod,
    [LedgerVerificationMethodRelation.KeyAgreement]:
      VerificationMethodRelationType.KeyAgreement,
    [LedgerVerificationMethodRelation.CapabilityInvocation]:
      VerificationMethodRelationType.CapabilityInvocation,
    [LedgerVerificationMethodRelation.CapabilityDelegation]:
      VerificationMethodRelationType.CapabilityDelegation,
  };

  static publicKeyJwk(publicKeyJwk: LedgerPublicKeyJwk): PublicKeyJwk {
    return {
      kty: this.KeyTypeMap[publicKeyJwk.kty],
      crv: this.CurveTypeMap[publicKeyJwk.crv],
      x: z.encode(FieldCodec as any, publicKeyJwk.x) as string,
      y: z.encode(FieldCodec as any, publicKeyJwk.y) as string,
    };
  }

  static service(service: LedgerService): Service {
    const serviceEndpoint = service.serviceEndpoint.filter((e) => e.trim() !== "");
    return { id: service.id, type: service.type, serviceEndpoint } as Service;
  }

  static toJSON(ledger: Ledger): object {
    return {
      id: Buffer.from(ledger.id.bytes).toString("hex"),
      version: Number(ledger.version.toString()),
      active: ledger.active,
      operationCount: Number(ledger.operationCount.toString()),
      alsoKnownAs: Array.from(ledger.alsoKnownAs),
      verificationMethods: Array.from(ledger.verificationMethods, ([id, method]) => ({
        id,
        type: method.type,
        publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
      })),
      authenticationRelation: Array.from(ledger.authenticationRelation),
      assertionMethodRelation: Array.from(ledger.assertionMethodRelation),
      keyAgreementRelation: Array.from(ledger.keyAgreementRelation),
      capabilityInvocationRelation: Array.from(ledger.capabilityInvocationRelation),
      capabilityDelegationRelation: Array.from(ledger.capabilityDelegationRelation),
      services: Array.from(ledger.services, ([, service]) => this.service(service)),
    };
  }

  static ledgerStateToDIDDocument(
    ledger: Ledger,
    network: MidnightNetwork,
    contractAddress: ReturnType<typeof parseContractAddress>
  ): DIDDocument {
    const ctx = ["https://www.w3.org/ns/did/v1"];
    const did = createMidnightDIDString(contractAddress, network);

    const verificationMethod: VerificationMethod[] = [];
    for (const [id, method] of ledger.verificationMethods) {
      verificationMethod.push(
        createVerificationMethod({
          id,
          type: LedgerToDomain.VerificationMethodTypeMap[method.type],
          controller: did,
          publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
        })
      );
    }

    const assertionMethod = ledger.assertionMethodRelation.isEmpty()
      ? undefined
      : Array.from(ledger.assertionMethodRelation);
    const authentication = ledger.authenticationRelation.isEmpty()
      ? undefined
      : Array.from(ledger.authenticationRelation);
    const capabilityDelegation = ledger.capabilityDelegationRelation.isEmpty()
      ? undefined
      : Array.from(ledger.capabilityDelegationRelation);
    const capabilityInvocation = ledger.capabilityInvocationRelation.isEmpty()
      ? undefined
      : Array.from(ledger.capabilityInvocationRelation);
    const keyAgreement = ledger.keyAgreementRelation.isEmpty()
      ? undefined
      : Array.from(ledger.keyAgreementRelation);
    const service = ledger.services.isEmpty()
      ? undefined
      : Array.from(ledger.services, ([, s]) => this.service(s));
    const alsoKnownAs = ledger.alsoKnownAs.isEmpty()
      ? undefined
      : Array.from(ledger.alsoKnownAs);

    const didDocument = createDIDDocument({
      id: did,
      context: ctx,
      alsoKnownAs: undefined,
      controller: did,
      verificationMethod,
      authentication,
      assertionMethod,
      keyAgreement,
      capabilityInvocation,
      capabilityDelegation,
      service,
    });

    if (alsoKnownAs !== undefined) {
      (didDocument as unknown as { alsoKnownAs?: string[] }).alsoKnownAs = alsoKnownAs;
    }
    return didDocument;
  }
}

