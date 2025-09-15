import { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { Buffer } from "buffer";

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
  VerificationMethodType
} from "./did-document";
import {
  DIDOperation as DomainUpdateOperation,
  DIDOperationType
} from "./did-operations";
import { OperationBuilder } from "./ledger-operation-builder";
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
  VerificationMethodType as LedgerVerificationMethodType
} from "./managed/did/contract/index.cjs";
import {
  ContractAddress as MidnightContractAddress,
  createMidnightDIDString,
  MidnightNetwork,
  parseContractAddress
} from "./midnight-did";

export class DomainToLedger {
  static readonly KeyTypeMap: Record<KeyType, LedgerKeyType> = {
    [KeyType.EC]: LedgerKeyType.EC,
    [KeyType.RSA]: LedgerKeyType.RSA,
    [KeyType.oct]: LedgerKeyType.oct,
    [KeyType.OKP]: LedgerKeyType.OKP
  };

  static readonly CurveTypeMap: Record<CurveType, LedgerCurveType> = {
    [CurveType.ed25519]: LedgerCurveType.ed25519,
    [CurveType.Jubjub]: LedgerCurveType.Jubjub
  };

  static readonly VerificationMethodTypeMap: Record<
    VerificationMethodType,
    LedgerVerificationMethodType
  > = {
    [VerificationMethodType.Undefined]: LedgerVerificationMethodType.Undefined,
    [VerificationMethodType.JsonWebKey]: LedgerVerificationMethodType.JsonWebKey
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
      LedgerVerificationMethodRelation.CapabilityDelegation
  };

  static publicKeyJwk(publicKeyJwk: PublicKeyJwk): LedgerPublicKeyJwk {
    return {
      kty: this.KeyTypeMap[publicKeyJwk.kty],
      crv: this.CurveTypeMap[publicKeyJwk.crv],
      x: publicKeyJwk.x,
      y: publicKeyJwk.y
    };
  }

  static verificationMethod(
    method: VerificationMethod
  ): LedgerVerificationMethod {
    return {
      id: method.id,
      type: this.VerificationMethodTypeMap[method.type],
      publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk)
    };
  }

  static service(service: Service): LedgerService {
    return {
      id: service.id,
      type: this.serviceType(service.type),
      serviceEndpoint: this.serviceEndpoint(service.serviceEndpoint)
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
      [DIDOperationType.Deactivate]: LedgerOperationType.Deactivate
    };

  static undefinedVerificationMethod: LedgerVerificationMethod = {
    id: "",
    type: LedgerVerificationMethodType.Undefined,
    publicKeyJwk: OperationBuilder.defaultPublicKeyJwk
  };

  //TODO: clarify with Midnight team how to init the default struct
  static defaultLedgerUpdateOperation(): LedgerUpdateOperation {
    return {
      operationType: LedgerOperationType.Undefined,
      addVerificationMethodOptions: {
        verificationMethod: this.undefinedVerificationMethod
      },
      updateVerificationMethodOptions: {
        verificationMethod: this.undefinedVerificationMethod
      },
      removeVerificationMethodOptions: {
        id: ""
      },
      addVerificationMethodRelationOptions: {
        relation: LedgerVerificationMethodRelation.Undefined,
        methodId: ""
      },
      removeVerificationMethodRelationOptions: {
        relation: LedgerVerificationMethodRelation.Undefined,
        methodId: ""
      },
      addServiceOptions: {
        service: {
          id: "",
          type: "",
          serviceEndpoint: Array.of("", "", "", "")
        }
      },
      updateServiceOptions: {
        service: {
          id: "",
          type: "",
          serviceEndpoint: Array.of("", "", "", "")
        }
      },
      removeServiceOptions: {
        id: ""
      }
    };
  }

  static updateOperation(
    updateOperation: DomainUpdateOperation
  ): LedgerUpdateOperation {
    const { type } = updateOperation;
    let ledgerUpdateOperation = this.defaultLedgerUpdateOperation();
    ledgerUpdateOperation.operationType = this.OperationMap[type];

    switch (type) {
      case DIDOperationType.AddVerificationMethod:
        ledgerUpdateOperation.addVerificationMethodOptions = {
          verificationMethod: this.verificationMethod(
            updateOperation.verificationMethod
          )
        };
        return ledgerUpdateOperation;
      case DIDOperationType.UpdateVerificationMethod:
        ledgerUpdateOperation.updateVerificationMethodOptions = {
          verificationMethod: this.verificationMethod(
            updateOperation.verificationMethod
          )
        };
        return ledgerUpdateOperation;
      case DIDOperationType.RemoveVerificationMethod:
        ledgerUpdateOperation.removeVerificationMethodOptions = {
          id: updateOperation.id
        };
        return ledgerUpdateOperation;
      case DIDOperationType.AddVerificationMethodRelation:
        ledgerUpdateOperation.addVerificationMethodRelationOptions = {
          methodId: updateOperation.methodId,
          relation: this.VerificationMethodRelationMap[updateOperation.relation]
        };
        return ledgerUpdateOperation;
      case DIDOperationType.RemoveVerificationMethodRelation:
        ledgerUpdateOperation.removeVerificationMethodRelationOptions = {
          methodId: updateOperation.methodId,
          relation: this.VerificationMethodRelationMap[updateOperation.relation]
        };
        return ledgerUpdateOperation;
      case DIDOperationType.Deactivate:
        return ledgerUpdateOperation;
      case DIDOperationType.AddService: {
        const serviceToAdd = this.service(updateOperation.service);
        ledgerUpdateOperation.addServiceOptions = {
          service: serviceToAdd
        };
        return ledgerUpdateOperation;
      }
      case DIDOperationType.UpdateService: {
        const serviceToUpdate = this.service(updateOperation.service);
        ledgerUpdateOperation.updateServiceOptions = {
          service: serviceToUpdate
        };
        return ledgerUpdateOperation;
      }
      case DIDOperationType.RemoveService:
        ledgerUpdateOperation.removeServiceOptions = {
          id: updateOperation.serviceId
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
      "service type property must be a string or an array with exactly one element"
    );
  }

  static serviceEndpoint(serviceEndpoint: string | string[]): string[] {
    let ledgerServiceEndpoint: string[];

    if (typeof serviceEndpoint === "string") {
      ledgerServiceEndpoint = [serviceEndpoint, "", "", ""];
    } else if (Array.isArray(serviceEndpoint)) {
      if (serviceEndpoint.length > 4)
        throw new Error(
          `serviceEndpoint property must contain at most four elements`
        );

      ledgerServiceEndpoint = [...serviceEndpoint];
      while (ledgerServiceEndpoint.length < 4) {
        ledgerServiceEndpoint.push("");
      }
    } else {
      throw new Error("Invalid type for serviceEndpoint");
    }

    return ledgerServiceEndpoint;
  }

  static updateOperations(
    operations: Array<DomainUpdateOperation>
  ): Array<LedgerUpdateOperation> {
    return operations.map((op) => this.updateOperation(op));
  }
}

/**
 * Helper to validate that a constructed LedgerUpdateOperation (managed type)
 * matches the contract’s expected shapes and enum ranges. This is useful for
 * producing clear, early errors before invoking contract.applyOperations.
 */
export function assertOperationsContractCompatible(
  ops: Array<LedgerUpdateOperation>
): void {
  const isEnumVal = (enm: any, v: unknown) =>
    typeof v === "number" && Object.values(enm).includes(v as any);

  const isBigInt = (v: unknown) => typeof v === "bigint";
  const isString = (v: unknown) => typeof v === "string" && v.length >= 0;

  const fail = (ctx: string, msg: string, val?: unknown) => {
    const tail = val !== undefined ? `\nValue: ${JSON.stringify(val)}` : "";
    throw new Error(
      `Contract operation validation failed at ${ctx}: ${msg}${tail}`
    );
  };

  ops.forEach((op, idx) => {
    const here = (p: string) => `ops[${idx}]${p}`;

    if (!isEnumVal(LedgerOperationType, op.operationType))
      fail(
        here(".operationType"),
        `invalid OperationType: ${op.operationType}`
      );

    const checkVM = (vm: LedgerVerificationMethod, path: string) => {
      if (!isString(vm.id)) fail(path + ".id", "expected non-empty string");
      if (!isEnumVal(LedgerVerificationMethodType, vm.type))
        fail(path + ".type", `invalid VerificationMethodType: ${vm.type}`);
      const pk = vm.publicKeyJwk as LedgerPublicKeyJwk;
      if (!isEnumVal(LedgerKeyType, pk.kty))
        fail(path + ".publicKeyJwk.kty", `invalid KeyType: ${pk.kty}`);
      if (!isEnumVal(LedgerCurveType, pk.crv))
        fail(path + ".publicKeyJwk.crv", `invalid CurveType: ${pk.crv}`);
      if (!isBigInt(pk.x) || !isBigInt(pk.y))
        fail(path + ".publicKeyJwk.(x,y)", "expected bigint for x and y", {
          x: pk.x,
          y: pk.y
        });
    };

    const checkRel = (rel: number, path: string) => {
      if (!isEnumVal(LedgerVerificationMethodRelation, rel))
        fail(path, `invalid VerificationMethodRelation: ${rel}`);
    };

    const checkService = (svc: LedgerService, path: string) => {
      if (!isString(svc.id)) fail(path + ".id", "expected string");
      if (!isString(svc.type)) fail(path + ".type", "expected string");
      if (
        !Array.isArray(svc.serviceEndpoint) ||
        svc.serviceEndpoint.length !== 4
      )
        fail(path + ".serviceEndpoint", "expected string[4]");
      for (let i = 0; i < 4; i++)
        if (!isString(svc.serviceEndpoint[i]))
          fail(path + `.serviceEndpoint[${i}]`, "expected string");
    };

    switch (op.operationType) {
      case LedgerOperationType.AddVerificationMethod:
        checkVM(
          op.addVerificationMethodOptions.verificationMethod,
          here(".addVerificationMethodOptions.verificationMethod")
        );
        break;
      case LedgerOperationType.UpdateVerificationMethod:
        checkVM(
          op.updateVerificationMethodOptions.verificationMethod,
          here(".updateVerificationMethodOptions.verificationMethod")
        );
        break;
      case LedgerOperationType.RemoveVerificationMethod:
        if (!isString(op.removeVerificationMethodOptions.id))
          fail(here(".removeVerificationMethodOptions.id"), "expected string");
        break;
      case LedgerOperationType.AddVerificationMethodRelation:
        checkRel(
          op.addVerificationMethodRelationOptions.relation,
          here(".addVerificationMethodRelationOptions.relation")
        );
        if (!isString(op.addVerificationMethodRelationOptions.methodId))
          fail(
            here(".addVerificationMethodRelationOptions.methodId"),
            "expected string"
          );
        break;
      case LedgerOperationType.RemoveVerificationMethodRelation:
        checkRel(
          op.removeVerificationMethodRelationOptions.relation,
          here(".removeVerificationMethodRelationOptions.relation")
        );
        if (!isString(op.removeVerificationMethodRelationOptions.methodId))
          fail(
            here(".removeVerificationMethodRelationOptions.methodId"),
            "expected string"
          );
        break;
      case LedgerOperationType.AddService:
        checkService(
          op.addServiceOptions.service,
          here(".addServiceOptions.service")
        );
        break;
      case LedgerOperationType.UpdateService:
        checkService(
          op.updateServiceOptions.service,
          here(".updateServiceOptions.service")
        );
        break;
      case LedgerOperationType.RemoveService:
        if (!isString(op.removeServiceOptions.id))
          fail(here(".removeServiceOptions.id"), "expected string");
        break;
      case LedgerOperationType.Deactivate:
        break;
      default:
        fail(
          here(".operationType"),
          `unsupported operation type: ${op.operationType}`
        );
    }
  });
}
