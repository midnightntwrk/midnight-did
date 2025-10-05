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
import {
  createDIDDocument,
  createMidnightDIDString,
  createVerificationMethod,
  CurveType,
  DIDDocument,
  DIDDocumentMetadata,
  FieldCodec,
  KeyType,
  MidnightNetwork,
  parseContractAddress,
  PublicKeyJwk,
  Service,
  VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { Buffer } from "buffer";
import { z } from "zod/v4-mini";

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
    [LedgerVerificationMethodType.JsonWebKey]:
      VerificationMethodType.JsonWebKey,
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
    const kty = this.KeyTypeMap[publicKeyJwk.kty];
    const crv = this.CurveTypeMap[publicKeyJwk.crv];
    const x = z.encode(FieldCodec as any, publicKeyJwk.x) as string;
    const y = z.encode(FieldCodec as any, publicKeyJwk.y) as string;

    if (
      kty === KeyType.OKP &&
      crv === CurveType.ed25519 &&
      publicKeyJwk.y === 0n
    )
      return { kty, crv, x } as PublicKeyJwk;

    return { kty, crv, x, y } as PublicKeyJwk;
  }

  static service(service: LedgerService): Service {
    const serviceEndpoint = service.serviceEndpoint.filter(
      (e) => e.trim() !== "",
    );
    return { id: service.id, type: service.type, serviceEndpoint } as Service;
  }

  static toJSON(ledger: Ledger): object {
    return {
      id: Buffer.from(ledger.id.bytes).toString("hex"),
      version: Number(ledger.version.toString()),
      active: ledger.active,
      operationCount: Number(ledger.operationCount.toString()),
      alsoKnownAs: Array.from(ledger.alsoKnownAs),
      verificationMethods: Array.from(
        ledger.verificationMethods,
        ([id, method]) => ({
          id,
          type: method.type,
          publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
        }),
      ),
      authenticationRelation: Array.from(ledger.authenticationRelation),
      assertionMethodRelation: Array.from(ledger.assertionMethodRelation),
      keyAgreementRelation: Array.from(ledger.keyAgreementRelation),
      capabilityInvocationRelation: Array.from(
        ledger.capabilityInvocationRelation,
      ),
      capabilityDelegationRelation: Array.from(
        ledger.capabilityDelegationRelation,
      ),
      services: Array.from(ledger.services, ([, service]) =>
        this.service(service),
      ),
    };
  }

  static ledgerStateToDIDDocument(
    ledger: Ledger,
    network: MidnightNetwork,
    contractAddress: ReturnType<typeof parseContractAddress>,
  ): DIDDocument {
    const ctx = [
      "https://www.w3.org/ns/did/v1",
      "https://w3c.github.io/vc-jws-2020/contexts/v1",
    ];
    const did = createMidnightDIDString(contractAddress, network);

    const verificationMethod: VerificationMethod[] = [];
    for (const [id, method] of ledger.verificationMethods) {
      verificationMethod.push(
        createVerificationMethod({
          id,
          type: LedgerToDomain.VerificationMethodTypeMap[method.type],
          controller: did,
          publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
        }),
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
      (didDocument as unknown as { alsoKnownAs?: string[] }).alsoKnownAs =
        alsoKnownAs;
    }
    return didDocument;
  }

  static ledgerStateToMetadata(ledger: Ledger): DIDDocumentMetadata {
    const created = this.timestampToIsoString(ledger.createdAt);
    const updated = this.timestampToIsoString(ledger.updatedAt);
    const deactivatedAt = this.timestampToIsoString(ledger.deactivatedAt);

    const metadata: DIDDocumentMetadata = {
      created,
      updated,
      deactivated: !ledger.active,
      versionId: ledger.version.toString(),
    };

    if (metadata.deactivated && deactivatedAt !== undefined)
      metadata.updated ??= deactivatedAt;

    return metadata;
  }

  private static timestampToIsoString(timestamp: bigint): string | undefined {
    if (timestamp === 0n) return undefined;
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (timestamp > maxSafe || timestamp < 0n) return undefined;
    const milliseconds = Number(timestamp);
    if (Number.isNaN(milliseconds)) return undefined;
    return new Date(milliseconds).toISOString();
  }
}
