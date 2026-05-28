import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  createService,
  createVerificationMethod,
  CurveType,
  DIDDocumentMetadata,
  encodeBase64Url,
  KeyType,
  normalizeServiceEndpoint,
  PublicKeyJwk,
  PublicKeyJwkSchema,
  Service,
  ServiceEndpointSchema,
  VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";

import {
  createMidnightDIDString,
  MidnightNetwork,
  parseContractAddress,
} from "./midnight.js";
import {
  createMidnightDIDDocument,
  MidnightDIDDocument,
} from "./midnight-did-document.js";

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
type LedgerSchnorrJubjubVerificationMethod =
  DIDContract.SchnorrJubjubVerificationMethod;
type LedgerService = DIDContract.Service;

const bigintTo32Le = (value: bigint): Uint8Array => {
  if (value < 0n) {
    throw new Error("Jubjub public key coordinate must be non-negative");
  }
  const bytes = new Uint8Array(32);
  let remaining = value;
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  if (remaining !== 0n) {
    throw new Error("Jubjub public key coordinate does not fit in 32 bytes");
  }
  return bytes;
};

export class LedgerToDomain {
  private static readonly KeyTypeMap: Record<LedgerKeyTypeValue, KeyType> = {
    [LedgerKeyType.EC]: KeyType.EC,
    [LedgerKeyType.RSA]: KeyType.RSA,
    [LedgerKeyType.oct]: KeyType.oct,
    [LedgerKeyType.OKP]: KeyType.OKP,
  };

  private static readonly CurveTypeMap: Record<
    LedgerCurveTypeValue,
    CurveType
  > = {
    [LedgerCurveType.Ed25519]: CurveType.Ed25519,
    [LedgerCurveType.X25519]: CurveType.X25519,
    [LedgerCurveType.Jubjub]: CurveType.Jubjub,
    [LedgerCurveType.P256]: CurveType.P256,
    [LedgerCurveType.Secp256k1]: CurveType.Secp256k1,
  };

  private static readonly VerificationMethodTypeMap: Record<
    LedgerVerificationMethodTypeValue,
    VerificationMethodType
  > = {
    [LedgerVerificationMethodType.Undefined]: VerificationMethodType.Undefined,
    [LedgerVerificationMethodType.JsonWebKey]:
      VerificationMethodType.JsonWebKey,
  };

  private static readonly VerificationMethodRelationMap: Record<
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
    const x = this.ledgerOpaqueString(publicKeyJwk.x, "publicKeyJwk.x");
    const y = this.ledgerOpaqueString(publicKeyJwk.y, "publicKeyJwk.y");

    if (
      kty === KeyType.OKP &&
      (crv === CurveType.Ed25519 || crv === CurveType.X25519)
    ) {
      if (y !== "") {
        throw new Error("OKP ledger publicKeyJwk.y must be empty");
      }
      return PublicKeyJwkSchema.parse({ kty, crv, x });
    }

    return PublicKeyJwkSchema.parse({ kty, crv, x, y });
  }

  static schnorrJubjubPublicKeyJwk(
    verificationMethod: LedgerSchnorrJubjubVerificationMethod,
  ): PublicKeyJwk {
    return PublicKeyJwkSchema.parse({
      kty: KeyType.EC,
      crv: CurveType.Jubjub,
      x: encodeBase64Url(bigintTo32Le(verificationMethod.publicKey.x)),
      y: encodeBase64Url(bigintTo32Le(verificationMethod.publicKey.y)),
    });
  }

  private static ledgerOpaqueString(value: unknown, label: string): string {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array) return new TextDecoder().decode(value);
    if (ArrayBuffer.isView(value)) {
      const view = value as ArrayBufferView;
      return new TextDecoder().decode(
        new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
      );
    }
    const shape =
      value === null
        ? "null"
        : typeof value === "object"
          ? (value.constructor?.name ?? "object")
          : typeof value;
    throw new Error(`${label} has an unsupported runtime shape: ${shape}`);
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
    const serviceType = this.parseServiceType(
      (service as { typ?: string; type?: string }).typ ??
        (service as { typ?: string; type?: string }).type ??
        "",
    );
    return {
      id: serviceId,
      type: serviceType,
      serviceEndpoint,
    } as Service;
  }

  private static parseServiceType(raw: string): Service["type"] {
    const value = raw.trim();
    if (value.length === 0) {
      throw new Error("Invalid service type: empty value");
    }
    if (value.startsWith("[")) {
      try {
        const parsed = JSON.parse(value);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every(
            (entry) => typeof entry === "string" && entry.trim().length > 0,
          ) &&
          new Set(parsed.map((entry) => entry.trim())).size === parsed.length
        ) {
          return parsed.map((entry) => entry.trim());
        }
      } catch {
        throw new Error("Invalid service type: malformed JSON array");
      }
      throw new Error(
        "Invalid service type: expected non-empty unique strings",
      );
    }
    return value;
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
      if (filtered.length === 0) {
        throw new Error("Invalid serviceEndpoint: empty legacy endpoint array");
      }
      if (filtered.length === 1) return normalize(filtered[0]);
      return normalize(filtered as Service["serviceEndpoint"]);
    }

    if (typeof endpoint === "string") {
      const raw = endpoint.trim();
      if (raw === "") {
        throw new Error("Invalid serviceEndpoint: empty value");
      }
      try {
        const parsed = JSON.parse(raw);
        return normalize(
          ServiceEndpointSchema.parse(parsed) as Service["serviceEndpoint"],
        );
      } catch {
        const direct = ServiceEndpointSchema.safeParse(raw);
        if (direct.success) {
          return normalize(direct.data as Service["serviceEndpoint"]);
        }
        throw new Error("Invalid serviceEndpoint: malformed JSON payload");
      }
    }

    const parsed = ServiceEndpointSchema.safeParse(endpoint);
    if (parsed.success) {
      return normalize(parsed.data as Service["serviceEndpoint"]);
    }
    throw new Error("Invalid serviceEndpoint: unsupported endpoint shape");
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

  static absoluteDidUrlReference(did: string, id: string): string {
    const normalized = this.verificationMethodId(id);
    if (normalized.startsWith("did:")) return normalized;
    return `${did}${normalized}`;
  }

  static toJSON(ledger: Ledger): object {
    const created = this.timestampToIsoString(ledger.created);
    const updated = this.timestampToIsoString(ledger.updated);
    const opaqueVerificationMethods = Array.from(
      ledger.verificationMethods,
      ([id, method]) => ({
        id: this.verificationMethodId(id),
        type: this.VerificationMethodTypeMap[method.typ],
        publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
      }),
    );
    const schnorrJubjubVerificationMethods = Array.from(
      ledger.schnorrJubjubVerificationMethods,
      ([id, method]) => ({
        id: this.verificationMethodId(id),
        type: VerificationMethodType.JsonWebKey,
        publicKeyJwk: this.schnorrJubjubPublicKeyJwk(method),
      }),
    );

    return {
      id: bytesToHex(ledger.id.bytes),
      version: Number(ledger.version.toString()),
      active: ledger.active,
      operationCount: Number(ledger.operationCount.toString()),
      created,
      updated,
      deactivated: ledger.deactivated,
      alsoKnownAs: Array.from(ledger.alsoKnownAs),
      verificationMethods: [
        ...opaqueVerificationMethods,
        ...schnorrJubjubVerificationMethods,
      ],
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
    const verificationMethodIds = new Set<string>();
    const registerVerificationMethodId = (id: string): void => {
      const normalizedId = this.verificationMethodId(id);
      if (verificationMethodIds.has(normalizedId)) {
        throw new Error(
          `Duplicate verification method id '${this.absoluteDidUrlReference(did, id)}'`,
        );
      }
      verificationMethodIds.add(normalizedId);
    };

    for (const [id, method] of ledger.verificationMethods) {
      const verificationMethodType =
        LedgerToDomain.VerificationMethodTypeMap[method.typ];
      if (verificationMethodType !== VerificationMethodType.JsonWebKey) {
        throw new Error(
          `Unsupported verification method type for id '${id}': ${verificationMethodType}`,
        );
      }
      registerVerificationMethodId(id);
      verificationMethod.push(
        createVerificationMethod({
          id: this.absoluteDidUrlReference(did, id),
          type: verificationMethodType,
          controller: did,
          publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
        }),
      );
    }

    for (const [id, method] of ledger.schnorrJubjubVerificationMethods) {
      registerVerificationMethodId(id);
      verificationMethod.push(
        createVerificationMethod({
          id: this.absoluteDidUrlReference(did, id),
          type: VerificationMethodType.JsonWebKey,
          controller: did,
          publicKeyJwk: this.schnorrJubjubPublicKeyJwk(method),
        }),
      );
    }

    const assertRelationTargetsExist = (
      relationName: string,
      relation: Iterable<string> & { isEmpty(): boolean },
    ) => {
      if (relation.isEmpty()) return;
      for (const methodId of relation) {
        if (!verificationMethodIds.has(this.verificationMethodId(methodId))) {
          throw new Error(
            `${relationName} references missing verification method '${this.absoluteDidUrlReference(did, methodId)}'`,
          );
        }
      }
    };

    assertRelationTargetsExist("authentication", ledger.authenticationRelation);
    assertRelationTargetsExist(
      "assertionMethod",
      ledger.assertionMethodRelation,
    );
    assertRelationTargetsExist("keyAgreement", ledger.keyAgreementRelation);
    assertRelationTargetsExist(
      "capabilityInvocation",
      ledger.capabilityInvocationRelation,
    );
    assertRelationTargetsExist(
      "capabilityDelegation",
      ledger.capabilityDelegationRelation,
    );

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
      : Array.from(ledger.services, ([, s]) => {
          const parsed = this.service(s);
          return createService({
            id: this.absoluteDidUrlReference(did, s.id),
            type: parsed.type,
            serviceEndpoint: parsed.serviceEndpoint,
          });
        });
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
    const created = this.timestampToIsoString(ledger.created);
    const updated = this.timestampToIsoString(ledger.updated);
    const deactivatedAt = ledger.deactivated
      ? this.timestampToIsoString(ledger.updated)
      : undefined;

    const isDeactivated = ledger.deactivated || !ledger.active;
    const metadata: DIDDocumentMetadata = {
      created,
      updated,
      deactivated: isDeactivated ? true : undefined,
      versionId: ledger.version.toString(),
    };

    if (isDeactivated && deactivatedAt !== undefined) {
      metadata.updated = deactivatedAt;
    }

    return metadata;
  }

  private static timestampToIsoString(timestamp: bigint): string | undefined {
    if (timestamp === 0n) return undefined;
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (timestamp > maxSafe || timestamp < 0n) return undefined;
    const milliseconds = Number(timestamp);
    if (Number.isNaN(milliseconds)) return undefined;
    const iso = new Date(milliseconds).toISOString();
    return iso.replace(/\.\d{3}Z$/, "Z");
  }
}
