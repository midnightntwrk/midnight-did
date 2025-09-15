import { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { Buffer } from "buffer";

import {
  createDIDDocument,
  createVerificationMethod,
  CurveType,
  DIDDocument,
  KeyType,
  parseService,
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

export class LedgerToDomain {
  static readonly KeyTypeMap: Record<LedgerKeyType, KeyType> = {
    [LedgerKeyType.EC]: KeyType.EC,
    [LedgerKeyType.RSA]: KeyType.RSA,
    [LedgerKeyType.oct]: KeyType.oct,
    [LedgerKeyType.OKP]: KeyType.OKP
  };

  static readonly CurveTypeMap: Record<LedgerCurveType, CurveType> = {
    [LedgerCurveType.ed25519]: CurveType.ed25519,
    [LedgerCurveType.Jubjub]: CurveType.Jubjub
  };

  static readonly VerificationMethodTypeMap: Record<
    LedgerVerificationMethodType,
    VerificationMethodType
  > = {
    [LedgerVerificationMethodType.Undefined]: VerificationMethodType.Undefined,
    [LedgerVerificationMethodType.JsonWebKey]: VerificationMethodType.JsonWebKey
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
      VerificationMethodRelationType.CapabilityDelegation
  };

  static publicKeyJwk(publicKeyJwk: LedgerPublicKeyJwk): PublicKeyJwk {
    return {
      kty: this.KeyTypeMap[publicKeyJwk.kty],
      crv: this.CurveTypeMap[publicKeyJwk.crv],
      x: publicKeyJwk.x,
      y: publicKeyJwk.y
    };
  }

  static service(service: LedgerService): Service {
    const serviceEndpoint = service.serviceEndpoint.filter(
      (endpoint) => endpoint.trim() !== ""
    );
    return parseService({
      id: service.id,
      type: service.type,
      serviceEndpoint: serviceEndpoint
    });
  }

  static toJSON(ledger: Ledger): object {
    return {
      id: Buffer.from(ledger.id.bytes).toString("hex"),
      version: Number(ledger.version.toString()),
      active: ledger.active,
      operationCount: Number(ledger.operationCount.toString()),
      verificationMethods: Array.from(
        ledger.verificationMethods,
        ([id, method]) => ({
          id,
          type: method.type,
          publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk)
        })
      ),
      authenticationRelation: Array.from(ledger.authenticationRelation),
      assertionMethodRelation: Array.from(ledger.assertionMethodRelation),
      keyAgreementRelation: Array.from(ledger.keyAgreementRelation),
      capabilityInvocationRelation: Array.from(
        ledger.capabilityInvocationRelation
      ),
      capabilityDelegationRelation: Array.from(
        ledger.capabilityDelegationRelation
      ),
      services: Array.from(ledger.services, ([id, service]) =>
        this.service(service)
      )
    };
  }

  /**
   * Converts a Ledger to a DIDDocument for the Midnight DID method.
   * @param did - MidnightDID associated with the ledger
   * @param ledger - Ledger object from the contract state
   * @returns DIDDocument
   */
  static ledgerStateToDIDDocument(
    ledger: Ledger,
    network: MidnightNetwork,
    contractAddress: MidnightContractAddress
  ): DIDDocument {
    //TODO: think about the context for the new key type
    const MidnightDIDDocumentContext = Array.of("https://www.w3.org/ns/did/v1");

    //const contractAddress = parseContractAddress(Buffer.from(ledger.id.bytes).toString("hex"));

    const did = createMidnightDIDString(contractAddress, network);

    const verificationMethod = [];
    for (const [id, method] of ledger.verificationMethods) {
      verificationMethod.push(
        createVerificationMethod({
          id,
          type: LedgerToDomain.VerificationMethodTypeMap[method.type],
          controller: did,
          publicKeyJwk: this.publicKeyJwk(method.publicKeyJwk)
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
      : Array.from(ledger.services, ([id, service]) => this.service(service));

    const didDocument = createDIDDocument({
      id: did,
      context: MidnightDIDDocumentContext,
      alsoKnownAs: undefined,
      controller: did,
      verificationMethod: verificationMethod,
      authentication: authentication,
      assertionMethod: assertionMethod,
      keyAgreement: keyAgreement,
      capabilityInvocation: capabilityInvocation,
      capabilityDelegation: capabilityDelegation,
      service: service
    });

    return didDocument;
  }
}
