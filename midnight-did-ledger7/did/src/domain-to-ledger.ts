import {
  DIDContract,
  OperationBuilder,
} from "@midnight-ntwrk/midnight-did-contract";
import {
  CurveType,
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
  DIDOperation as DomainUpdateOperation,
  DIDOperationType,
} from "./did-operations";

const LedgerCurveType = DIDContract.CurveType;
const LedgerVerificationMethodType = DIDContract.VerificationMethodType;
const LedgerVerificationMethodRelation = DIDContract.VerificationMethodRelation;
const LedgerOperationType = DIDContract.OperationType;
const LedgerKeyType = DIDContract.KeyType;

type LedgerKeyTypeValue = (typeof LedgerKeyType)[keyof typeof LedgerKeyType];
type LedgerCurveTypeValue =
  (typeof LedgerCurveType)[keyof typeof LedgerCurveType];
type LedgerVerificationMethodTypeValue =
  (typeof LedgerVerificationMethodType)[keyof typeof LedgerVerificationMethodType];
type LedgerVerificationMethodRelationValue =
  (typeof LedgerVerificationMethodRelation)[keyof typeof LedgerVerificationMethodRelation];
type LedgerOperationTypeValue =
  (typeof LedgerOperationType)[keyof typeof LedgerOperationType];

type LedgerPublicKeyJwk = DIDContract.PublicKeyJwk;
type LedgerService = DIDContract.Service;
type LedgerVerificationMethod = DIDContract.VerificationMethod;
type LedgerUpdateOperation = DIDContract.DIDUpdateOperation;

export class DomainToLedger {
  static readonly KeyTypeMap: Record<KeyType, LedgerKeyTypeValue> = {
    [KeyType.EC]: LedgerKeyType.EC,
    [KeyType.RSA]: LedgerKeyType.RSA,
    [KeyType.oct]: LedgerKeyType.oct,
    [KeyType.OKP]: LedgerKeyType.OKP,
  };

  static readonly CurveTypeMap: Record<CurveType, LedgerCurveTypeValue> = {
    [CurveType.Ed25519]: LedgerCurveType.Ed25519,
    [CurveType.Jubjub]: LedgerCurveType.Jubjub,
  };

  static readonly VerificationMethodTypeMap: Record<
    VerificationMethodType,
    LedgerVerificationMethodTypeValue
  > = {
    [VerificationMethodType.Undefined]: LedgerVerificationMethodType.Undefined,
    [VerificationMethodType.JsonWebKey]:
      LedgerVerificationMethodType.JsonWebKey,
  };

  static readonly VerificationMethodRelationMap: Record<
    VerificationMethodRelationType,
    LedgerVerificationMethodRelationValue
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

  static publicKeyJwk(publicKeyJwk: PublicKeyJwk): LedgerPublicKeyJwk {
    const kty = this.KeyTypeMap[publicKeyJwk.kty];
    const crv = this.CurveTypeMap[publicKeyJwk.crv];
    const x = z.decode(FieldCodec as any, publicKeyJwk.x) as bigint;
    const y =
      publicKeyJwk.y !== undefined
        ? (z.decode(FieldCodec as any, publicKeyJwk.y) as bigint)
        : 0n;

    return { kty, crv, x, y };
  }

  static verificationMethod(
    method: VerificationMethod,
  ): LedgerVerificationMethod {
    return {
      id: this.verificationMethodId(method.id),
      typ: this.VerificationMethodTypeMap[method.type],
      publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
    };
  }

  static verificationMethodId(methodId: string): string {
    const normalized = methodId.trim();
    if (normalized.startsWith("#")) return normalized.slice(1);
    if (normalized.startsWith("did:") && normalized.includes("#")) {
      const fragmentIndex = normalized.indexOf("#");
      return normalized.slice(fragmentIndex + 1);
    }
    return normalized;
  }

  static service(service: Service): LedgerService {
    return {
      id: this.serviceId(service.id),
      typ: this.serviceType(service.type),
      serviceEndpoint: this.serviceEndpoint(service.serviceEndpoint),
    };
  }

  static serviceId(serviceId: string): string {
    const normalized = serviceId.trim();
    if (normalized.startsWith("#")) return normalized.slice(1);
    if (normalized.startsWith("did:") && normalized.includes("#")) {
      const fragmentIndex = normalized.indexOf("#");
      const fragment = normalized.slice(fragmentIndex + 1);
      return fragment;
    }
    return normalized;
  }

  static readonly OperationMap: Record<
    DIDOperationType,
    LedgerOperationTypeValue
  > = {
    [DIDOperationType.AddVerificationMethod]:
      LedgerOperationType.AddVerificationMethod,
    [DIDOperationType.UpdateVerificationMethod]:
      LedgerOperationType.UpdateVerificationMethod,
    [DIDOperationType.RemoveVerificationMethod]:
      LedgerOperationType.RemoveVerificationMethod,
    [DIDOperationType.AddVerificationMethodRelation]:
      LedgerOperationType.AddVerificationMethodRelation,
    [DIDOperationType.RemoveVerificationMethodRelation]:
      LedgerOperationType.RemoveVerificationMethodRelation,
    [DIDOperationType.AddService]: LedgerOperationType.AddService,
    [DIDOperationType.UpdateService]: LedgerOperationType.UpdateService,
    [DIDOperationType.RemoveService]: LedgerOperationType.RemoveService,
    [DIDOperationType.AddAlsoKnownAs]: LedgerOperationType.AddAlsoKnownAs,
    [DIDOperationType.RemoveAlsoKnownAs]: LedgerOperationType.RemoveAlsoKnownAs,
    [DIDOperationType.Deactivate]: LedgerOperationType.Deactivate,
  };

  static undefinedVerificationMethod: LedgerVerificationMethod = {
    id: "",
    typ: LedgerVerificationMethodType.Undefined,
    publicKeyJwk: OperationBuilder.defaultPublicKeyJwk,
  };

  static defaultLedgerUpdateOperation(): LedgerUpdateOperation {
    return {
      operationType: LedgerOperationType.Undefined,
      addVerificationMethodOptions: {
        verificationMethod: this.undefinedVerificationMethod,
      },
      updateVerificationMethodOptions: {
        verificationMethod: this.undefinedVerificationMethod,
      },
      removeVerificationMethodOptions: { id: "" },
      addVerificationMethodRelationOptions: {
        relation: LedgerVerificationMethodRelation.Undefined,
        methodId: "",
      },
      removeVerificationMethodRelationOptions: {
        relation: LedgerVerificationMethodRelation.Undefined,
        methodId: "",
      },
      addServiceOptions: {
        service: {
          id: "",
          typ: "",
          serviceEndpoint: '""',
        },
      },
      updateServiceOptions: {
        service: {
          id: "",
          typ: "",
          serviceEndpoint: '""',
        },
      },
      removeServiceOptions: { id: "" },
      addAlsoKnownAsOptions: { value: "" },
      removeAlsoKnownAsOptions: { value: "" },
    };
  }

  static updateOperation(
    updateOperation: DomainUpdateOperation,
  ): LedgerUpdateOperation {
    const { type } = updateOperation;
    let ledgerUpdateOperation = this.defaultLedgerUpdateOperation();
    ledgerUpdateOperation.operationType = this.OperationMap[type];

    switch (type) {
      case DIDOperationType.AddVerificationMethod:
        ledgerUpdateOperation.addVerificationMethodOptions = {
          verificationMethod: this.verificationMethod(
            updateOperation.verificationMethod,
          ),
        };
        return ledgerUpdateOperation;
      case DIDOperationType.UpdateVerificationMethod:
        ledgerUpdateOperation.updateVerificationMethodOptions = {
          verificationMethod: this.verificationMethod(
            updateOperation.verificationMethod,
          ),
        };
        return ledgerUpdateOperation;
      case DIDOperationType.RemoveVerificationMethod:
        ledgerUpdateOperation.removeVerificationMethodOptions = {
          id: this.verificationMethodId(updateOperation.id),
        };
        return ledgerUpdateOperation;
      case DIDOperationType.AddVerificationMethodRelation:
        ledgerUpdateOperation.addVerificationMethodRelationOptions = {
          methodId: this.verificationMethodId(updateOperation.methodId),
          relation:
            this.VerificationMethodRelationMap[updateOperation.relation],
        };
        return ledgerUpdateOperation;
      case DIDOperationType.RemoveVerificationMethodRelation:
        ledgerUpdateOperation.removeVerificationMethodRelationOptions = {
          methodId: this.verificationMethodId(updateOperation.methodId),
          relation:
            this.VerificationMethodRelationMap[updateOperation.relation],
        };
        return ledgerUpdateOperation;
      case DIDOperationType.Deactivate:
        return ledgerUpdateOperation;
      case DIDOperationType.AddService: {
        const serviceToAdd = this.service(updateOperation.service);
        ledgerUpdateOperation.addServiceOptions = { service: serviceToAdd };
        return ledgerUpdateOperation;
      }
      case DIDOperationType.UpdateService: {
        const serviceToUpdate = this.service(updateOperation.service);
        ledgerUpdateOperation.updateServiceOptions = {
          service: serviceToUpdate,
        };
        return ledgerUpdateOperation;
      }
      case DIDOperationType.RemoveService:
        ledgerUpdateOperation.removeServiceOptions = {
          id: this.serviceId(updateOperation.serviceId),
        };
        return ledgerUpdateOperation;
      case DIDOperationType.AddAlsoKnownAs:
        ledgerUpdateOperation.addAlsoKnownAsOptions = {
          value: updateOperation.aliasUri,
        };
        return ledgerUpdateOperation;
      case DIDOperationType.RemoveAlsoKnownAs:
        ledgerUpdateOperation.removeAlsoKnownAsOptions = {
          value: updateOperation.aliasUri,
        };
        return ledgerUpdateOperation;
      default:
        throw new Error(`Unsupported operation type: ${type}`);
    }
  }

  static serviceType(serviceType: string | string[]): string {
    if (typeof serviceType === "string") return serviceType;
    if (Array.isArray(serviceType) && serviceType.length === 1)
      return serviceType[0];
    throw new Error(
      "service type property must be a string or an array with exactly one element",
    );
  }

  static serviceEndpoint(serviceEndpoint: Service["serviceEndpoint"]): string {
    try {
      const normalized = normalizeServiceEndpoint(serviceEndpoint);
      return JSON.stringify(normalized);
    } catch {
      throw new Error("Invalid serviceEndpoint: could not serialize to JSON");
    }
  }

  static updateOperations(
    operations: Array<DomainUpdateOperation>,
  ): Array<LedgerUpdateOperation> {
    return operations.map((op) => this.updateOperation(op));
  }
}
