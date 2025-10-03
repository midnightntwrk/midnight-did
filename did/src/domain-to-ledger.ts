import { OperationBuilder } from "@midnight-ntwrk/midnight-did-contract";
import {
  CurveType as LedgerCurveType,
  DIDUpdateOperation as LedgerUpdateOperation,
  KeyType as LedgerKeyType,
  Ledger,
  OperationType as LedgerOperationType,
  PublicKeyJwk as LedgerPublicKeyJwk,
  Service as LedgerService,
  VerificationMethod as LedgerVerificationMethod,
  VerificationMethodRelation as LedgerVerificationMethodRelation,
  VerificationMethodType as LedgerVerificationMethodType,
} from "@midnight-ntwrk/midnight-did-contract/dist/managed/did/contract/index.cjs";
import {
  CurveType,
  FieldCodec,
  KeyType,
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

export class DomainToLedger {
  static readonly KeyTypeMap: Record<KeyType, LedgerKeyType> = {
    [KeyType.EC]: LedgerKeyType.EC,
    [KeyType.RSA]: LedgerKeyType.RSA,
    [KeyType.oct]: LedgerKeyType.oct,
    [KeyType.OKP]: LedgerKeyType.OKP,
  };

  static readonly CurveTypeMap: Record<CurveType, LedgerCurveType> = {
    [CurveType.ed25519]: LedgerCurveType.ed25519,
    [CurveType.Jubjub]: LedgerCurveType.Jubjub,
  };

  static readonly VerificationMethodTypeMap: Record<
    VerificationMethodType,
    LedgerVerificationMethodType
  > = {
    [VerificationMethodType.Undefined]: LedgerVerificationMethodType.Undefined,
    [VerificationMethodType.JsonWebKey]:
      LedgerVerificationMethodType.JsonWebKey,
  };

  static readonly VerificationMethodRelationMap: Record<
    VerificationMethodRelationType,
    LedgerVerificationMethodRelation
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
    return {
      kty: this.KeyTypeMap[publicKeyJwk.kty],
      crv: this.CurveTypeMap[publicKeyJwk.crv],
      x: z.decode(FieldCodec as any, publicKeyJwk.x) as bigint,
      y: z.decode(FieldCodec as any, publicKeyJwk.y) as bigint,
    };
  }

  static verificationMethod(
    method: VerificationMethod,
  ): LedgerVerificationMethod {
    return {
      id: method.id,
      type: this.VerificationMethodTypeMap[method.type],
      publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk),
    };
  }

  static service(service: Service): LedgerService {
    return {
      id: service.id,
      type: this.serviceType(service.type),
      serviceEndpoint: this.serviceEndpoint(service.serviceEndpoint),
    };
  }

  static readonly OperationMap: Record<DIDOperationType, LedgerOperationType> =
    {
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
      [DIDOperationType.RemoveAlsoKnownAs]:
        LedgerOperationType.RemoveAlsoKnownAs,
      [DIDOperationType.Deactivate]: LedgerOperationType.Deactivate,
    };

  static undefinedVerificationMethod: LedgerVerificationMethod = {
    id: "",
    type: LedgerVerificationMethodType.Undefined,
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
          type: "",
          serviceEndpoint: Array.of("", "", "", ""),
        },
      },
      updateServiceOptions: {
        service: {
          id: "",
          type: "",
          serviceEndpoint: Array.of("", "", "", ""),
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
          id: updateOperation.id,
        };
        return ledgerUpdateOperation;
      case DIDOperationType.AddVerificationMethodRelation:
        ledgerUpdateOperation.addVerificationMethodRelationOptions = {
          methodId: updateOperation.methodId,
          relation:
            this.VerificationMethodRelationMap[updateOperation.relation],
        };
        return ledgerUpdateOperation;
      case DIDOperationType.RemoveVerificationMethodRelation:
        ledgerUpdateOperation.removeVerificationMethodRelationOptions = {
          methodId: updateOperation.methodId,
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
          id: updateOperation.serviceId,
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

  static serviceEndpoint(serviceEndpoint: string | string[]): string[] {
    let ledgerServiceEndpoint: string[];
    if (typeof serviceEndpoint === "string") {
      ledgerServiceEndpoint = [serviceEndpoint, "", "", ""];
    } else if (Array.isArray(serviceEndpoint)) {
      if (serviceEndpoint.length > 4)
        throw new Error(
          `serviceEndpoint property must contain at most four elements`,
        );
      ledgerServiceEndpoint = [...serviceEndpoint];
      while (ledgerServiceEndpoint.length < 4) ledgerServiceEndpoint.push("");
    } else {
      throw new Error("Invalid type for serviceEndpoint");
    }
    return ledgerServiceEndpoint;
  }

  static updateOperations(
    operations: Array<DomainUpdateOperation>,
  ): Array<LedgerUpdateOperation> {
    return operations.map((op) => this.updateOperation(op));
  }
}
