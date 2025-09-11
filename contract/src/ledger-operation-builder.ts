import {
  AddServiceOptions,
  AddVerificationMethodOptions,
  AddVerificationMethodRelationOptions,
  CurveType,
  DIDUpdateOperation,
  KeyType,
  OperationType,
  PublicKeyJwk,
  RemoveServiceOptions,
  RemoveVerificationMethodOptions,
  RemoveVerificationMethodRelationOptions,
  UpdateServiceOptions,
  UpdateVerificationMethodOptions,
  VerificationMethod,
  VerificationMethodRelation,
  VerificationMethodType
} from "./managed/did/contract/index.cjs";

export class OperationBuilder {
  static defaultPublicKeyJwk: PublicKeyJwk = {
    kty: KeyType.EC,
    crv: CurveType.ed25519,
    x: 0n,
    y: 0n
  };

  static defaultVerificationMethod: VerificationMethod = {
    id: "",
    type: VerificationMethodType.Undefined,
    publicKeyJwk: this.defaultPublicKeyJwk
  };

  static defaultDIDUpdateOperation: DIDUpdateOperation = {
    operationType: OperationType.Undefined,
    addVerificationMethodOptions: {
      verificationMethod: this.defaultVerificationMethod
    },
    updateVerificationMethodOptions: {
      verificationMethod: this.defaultVerificationMethod
    },
    removeVerificationMethodOptions: {
      id: ""
    },
    addVerificationMethodRelationOptions: {
      relation: VerificationMethodRelation.Undefined,
      methodId: ""
    },
    removeVerificationMethodRelationOptions: {
      relation: VerificationMethodRelation.Undefined,
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

  static undefined(): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.Undefined
    };
  }

  static addVerificationMethod(
    options: AddVerificationMethodOptions
  ): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.AddVerificationMethod,
      addVerificationMethodOptions: options
    };
  }

  static updateVerificationMethod(
    options: UpdateVerificationMethodOptions
  ): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.UpdateVerificationMethod,
      updateVerificationMethodOptions: options
    };
  }

  static removeVerificationMethod(
    options: RemoveVerificationMethodOptions
  ): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.RemoveVerificationMethod,
      removeVerificationMethodOptions: options
    };
  }

  static addVerificationMethodRelation(
    options: AddVerificationMethodRelationOptions
  ): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.AddVerificationMethodRelation,
      addVerificationMethodRelationOptions: options
    };
  }

  static removeVerificationMethodRelation(
    options: RemoveVerificationMethodRelationOptions
  ): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.RemoveVerificationMethodRelation,
      removeVerificationMethodRelationOptions: options
    };
  }

  static addService(options: AddServiceOptions): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.AddService,
      addServiceOptions: options
    };
  }

  static updateService(options: UpdateServiceOptions): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.UpdateService,
      updateServiceOptions: options
    };
  }

  static removeService(options: RemoveServiceOptions): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.RemoveService,
      removeServiceOptions: options
    };
  }

  static deactivate(): DIDUpdateOperation {
    return {
      ...this.defaultDIDUpdateOperation,
      operationType: OperationType.Deactivate
    };
  }

  static padding(operations: DIDUpdateOperation[]): DIDUpdateOperation[] {
    const MAX_OPERATIONS = 4;
    if (operations.length > MAX_OPERATIONS) {
      throw new Error(`Cannot pad: input exceeds ${MAX_OPERATIONS} operations`);
    }
    const padded = [...operations];
    while (padded.length < MAX_OPERATIONS) {
      padded.push(this.undefined());
    }
    return padded;
  }

  static verifyOperations(
    operations: DIDUpdateOperation[]
  ): DIDUpdateOperation[] {
    // Basic shape check: must be an array of exactly 4 operations
    if (!Array.isArray(operations) || operations.length !== 4) {
      throw new Error(
        "Invalid operations: must be an array of exactly 4 items"
      );
    }

    const isUint8Array32 = (u: any): boolean =>
      u instanceof Uint8Array &&
      u.buffer instanceof ArrayBuffer &&
      u.BYTES_PER_ELEMENT === 1 &&
      u.length === 32;

    const inNumRange = (v: any, min: number, max: number): boolean =>
      typeof v === "number" && v >= min && v <= max;

    operations.forEach((t, idx) => {
      // t must be an object
      if (typeof t !== "object" || t === null) {
        throw new Error(`Invalid operation at index ${idx}: not an object`);
      }

      // operationType: 0..9
      if (!inNumRange((t as any).operationType, 0, 9)) {
        throw new Error(`Invalid operationType at index ${idx}: expected 0..9`);
      }

      // addVerificationMethodOptions.verificationMethod
      const avm = (t as any).addVerificationMethodOptions;
      if (
        typeof avm !== "object" ||
        avm === null ||
        typeof avm.verificationMethod !== "object" ||
        avm.verificationMethod === null
      ) {
        throw new Error(`Invalid addVerificationMethodOptions at index ${idx}`);
      }
      if (!inNumRange(avm.verificationMethod.type, 0, 2)) {
        throw new Error(
          `Invalid verificationMethod.type (add) at index ${idx}: expected 0..2`
        );
      }

      // updateVerificationMethodOptions.verificationMethod
      const uvm = (t as any).updateVerificationMethodOptions;
      if (
        typeof uvm !== "object" ||
        uvm === null ||
        typeof uvm.verificationMethod !== "object" ||
        uvm.verificationMethod === null
      ) {
        throw new Error(
          `Invalid updateVerificationMethodOptions at index ${idx}`
        );
      }
      if (!inNumRange(uvm.verificationMethod.type, 0, 2)) {
        throw new Error(
          `Invalid verificationMethod.type (update) at index ${idx}: expected 0..2`
        );
      }

      // removeVerificationMethodOptions (object presence only as per hint)
      const rvm = (t as any).removeVerificationMethodOptions;
      if (typeof rvm !== "object" || rvm === null) {
        throw new Error(
          `Invalid removeVerificationMethodOptions at index ${idx}`
        );
      }

      // addVerificationMethodRelationOptions.relation: 0..5
      const avmr = (t as any).addVerificationMethodRelationOptions;
      if (
        typeof avmr !== "object" ||
        avmr === null ||
        !inNumRange(avmr.relation, 0, 5)
      ) {
        throw new Error(
          `Invalid addVerificationMethodRelationOptions.relation at index ${idx}: expected 0..5`
        );
      }

      // removeVerificationMethodRelationOptions.relation: 0..5
      const rvml = (t as any).removeVerificationMethodRelationOptions;
      if (
        typeof rvml !== "object" ||
        rvml === null ||
        !inNumRange(rvml.relation, 0, 5)
      ) {
        throw new Error(
          `Invalid removeVerificationMethodRelationOptions.relation at index ${idx}: expected 0..5`
        );
      }

      // addServiceOptions.serviceEndpoint: array length === 4
      const aso = (t as any).addServiceOptions;
      if (
        typeof aso !== "object" ||
        aso === null ||
        !Array.isArray(aso.serviceEndpoint) ||
        aso.serviceEndpoint.length !== 4
      ) {
        throw new Error(
          `Invalid addServiceOptions.serviceEndpoint at index ${idx}: expected array length 4`
        );
      }

      // updateServiceOptions.serviceEndpoint: array length === 4
      const uso = (t as any).updateServiceOptions;
      if (
        typeof uso !== "object" ||
        uso === null ||
        !Array.isArray(uso.serviceEndpoint) ||
        uso.serviceEndpoint.length !== 4
      ) {
        throw new Error(
          `Invalid updateServiceOptions.serviceEndpoint at index ${idx}: expected array length 4`
        );
      }

      // removeServiceOptions (object presence only as per hint)
      const rso = (t as any).removeServiceOptions;
      if (typeof rso !== "object" || rso === null) {
        throw new Error(`Invalid removeServiceOptions at index ${idx}`);
      }
    });

    // If every check passed, return the original array unchanged
    return operations;
  }
}
