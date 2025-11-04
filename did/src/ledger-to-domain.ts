import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  createVerificationMethod,
  CurveType,
  DIDDocumentMetadata,
  FieldCodec,
  KeyType,
  normalizeServiceEndpoint,
  PublicKeyJwk,
  Service,
  VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { z } from "zod/v4-mini";

import {
  createMidnightDIDString,
  MidnightNetwork,
  parseContractAddress,
} from "./midnight";
import {
  createMidnightDIDDocument,
  MidnightDIDDocument,
} from "./midnight-did-document";

const bytesToHex = (bytes: Iterable<number>): string => {
  let hex = "";
  for (const byte of bytes) {
    hex += Number(byte).toString(16).padStart(2, "0");
  }
  return hex;
};

const LedgerCurveType = DIDContract.CurveType;
const LedgerKeyType = DIDContract.KeyType;
const LedgerVerificationMethodType = DIDContract.VerificationMethodType;
const LedgerVerificationMethodRelation = DIDContract.VerificationMethodRelation;

type LedgerKeyTypeValue = (typeof LedgerKeyType)[keyof typeof LedgerKeyType];
type LedgerCurveTypeValue =
  (typeof LedgerCurveType)[keyof typeof LedgerCurveType];
type LedgerVerificationMethodTypeValue =
  (typeof LedgerVerificationMethodType)[keyof typeof LedgerVerificationMethodType];
type LedgerVerificationMethodRelationValue =
  (typeof LedgerVerificationMethodRelation)[keyof typeof LedgerVerificationMethodRelation];
type Ledger = DIDContract.Ledger;
type LedgerPublicKeyJwk = DIDContract.PublicKeyJwk;
type LedgerService = DIDContract.Service;

export class LedgerToDomain {
  static readonly KeyTypeMap: Record<LedgerKeyTypeValue, KeyType> = {
    [LedgerKeyType.EC]: KeyType.EC,
    [LedgerKeyType.RSA]: KeyType.RSA,
    [LedgerKeyType.oct]: KeyType.oct,
    [LedgerKeyType.OKP]: KeyType.OKP,
  };

  static readonly CurveTypeMap: Record<LedgerCurveTypeValue, CurveType> = {
    [LedgerCurveType.Ed25519]: CurveType.Ed25519,
    [LedgerCurveType.Jubjub]: CurveType.Jubjub,
  };

  static readonly VerificationMethodTypeMap: Record<
    LedgerVerificationMethodTypeValue,
    VerificationMethodType
  > = {
    [LedgerVerificationMethodType.Undefined]: VerificationMethodType.Undefined,
    [LedgerVerificationMethodType.JsonWebKey]:
      VerificationMethodType.JsonWebKey,
  };

  static readonly VerificationMethodRelationMap: Record<
    LedgerVerificationMethodRelationValue,
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
      crv === CurveType.Ed25519 &&
      publicKeyJwk.y === 0n
    )
      return { kty, crv, x } as PublicKeyJwk;

    return { kty, crv, x, y } as PublicKeyJwk;
  }

  static service(service: LedgerService): Service {
    const rawId = service.id.trim();
    const needsFragmentPrefix =
      rawId.startsWith("//") ||
      (!rawId.startsWith("did:") &&
        !rawId.startsWith("#") &&
        !rawId.startsWith("/") &&
        !rawId.startsWith(".") &&
        !rawId.startsWith("?"));
    const serviceId = needsFragmentPrefix ? `#${rawId}` : rawId;

    const serviceEndpoint = this.parseServiceEndpoint(service.serviceEndpoint);
    return {
      id: serviceId,
      type: service.type,
      serviceEndpoint,
    } as Service;
  }

  private static parseServiceEndpoint(
    endpoint: unknown,
  ): Service["serviceEndpoint"] {
    const normalize = (
      value: Service["serviceEndpoint"],
    ): Service["serviceEndpoint"] => normalizeServiceEndpoint(value);

    if (Array.isArray(endpoint)) {
      const filtered = endpoint
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value !== "");
      if (filtered.length === 0) return "";
      if (filtered.length === 1) return normalize(filtered[0]);
      return normalize(filtered as Service["serviceEndpoint"]);
    }

    if (typeof endpoint === "string") {
      const raw = endpoint.trim();
      if (raw === "") return "";
      try {
        const parsed = JSON.parse(raw);
        return normalize(parsed as Service["serviceEndpoint"]);
      } catch {
        return normalize(raw);
      }
    }

    return normalize(endpoint as Service["serviceEndpoint"]);
  }

  static verificationMethodId(id: string): string {
    const rawId = id.trim();
    if (rawId.startsWith("did:")) {
      if (rawId.includes("#")) return rawId;
      return `${rawId}#${rawId.slice(rawId.lastIndexOf(":") + 1)}`;
    }
    const needsFragmentPrefix =
      !rawId.startsWith("#") &&
      !rawId.startsWith("/") &&
      !rawId.startsWith(".") &&
      !rawId.startsWith("?");
    return needsFragmentPrefix ? `#${rawId}` : rawId;
  }

  static toJSON(ledger: Ledger): object {
    return {
      id: bytesToHex(ledger.id.bytes),
      version: Number(ledger.version.toString()),
      active: ledger.active,
      operationCount: Number(ledger.operationCount.toString()),
      alsoKnownAs: Array.from(ledger.alsoKnownAs),
      verificationMethods: Array.from(
        ledger.verificationMethods,
        ([id, method]) => ({
          id: this.verificationMethodId(id),
          type: method.type,
          publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
        }),
      ),
      authenticationRelation: Array.from(
        ledger.authenticationRelation,
        (value) => this.verificationMethodId(value),
      ),
      assertionMethodRelation: Array.from(
        ledger.assertionMethodRelation,
        (value) => this.verificationMethodId(value),
      ),
      keyAgreementRelation: Array.from(ledger.keyAgreementRelation, (value) =>
        this.verificationMethodId(value),
      ),
      capabilityInvocationRelation: Array.from(
        ledger.capabilityInvocationRelation,
        (value) => this.verificationMethodId(value),
      ),
      capabilityDelegationRelation: Array.from(
        ledger.capabilityDelegationRelation,
        (value) => this.verificationMethodId(value),
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
  ): MidnightDIDDocument {
    const did = createMidnightDIDString(contractAddress, network);

    const verificationMethod: VerificationMethod[] = [];
    for (const [id, method] of ledger.verificationMethods) {
      verificationMethod.push(
        createVerificationMethod({
          id: this.verificationMethodId(id),
          type: LedgerToDomain.VerificationMethodTypeMap[method.type],
          controller: did,
          publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
        }),
      );
    }

    const mapRelation = (
      relation: Iterable<string> & { isEmpty(): boolean },
    ): string[] | undefined =>
      relation.isEmpty()
        ? undefined
        : Array.from(relation, (value) => this.verificationMethodId(value));

    const assertionMethod = mapRelation(ledger.assertionMethodRelation);
    const authentication = mapRelation(ledger.authenticationRelation);
    const capabilityDelegation = mapRelation(
      ledger.capabilityDelegationRelation,
    );
    const capabilityInvocation = mapRelation(
      ledger.capabilityInvocationRelation,
    );
    const keyAgreement = mapRelation(ledger.keyAgreementRelation);
    const service = ledger.services.isEmpty()
      ? undefined
      : Array.from(ledger.services, ([, s]) => this.service(s));
    const alsoKnownAs = ledger.alsoKnownAs.isEmpty()
      ? undefined
      : Array.from(ledger.alsoKnownAs);

    return createMidnightDIDDocument({
      id: did,
      verificationMethod,
      authentication,
      assertionMethod,
      keyAgreement,
      capabilityInvocation,
      capabilityDelegation,
      service,
      alsoKnownAs,
    });
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
