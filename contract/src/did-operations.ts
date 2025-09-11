import { z } from "zod/v4-mini";

import {
  Service,
  VerificationMethod,
  VerificationMethodRelation,
  VerificationMethodRelationTypeSchema,
  VerificationMethodSchema
} from "./did-document";

/**
 * Enum representing each DID Operation type supported by the Midnight DID contract.
 */
export enum DIDOperationType {
  AddVerificationMethod = "AddVerificationMethod",
  UpdateVerificationMethod = "UpdateVerificationMethod",
  RemoveVerificationMethod = "RemoveVerificationMethod",
  AddVerificationMethodRelation = "AddVerificationMethodRelation",
  RemoveVerificationMethodRelation = "RemoveVerificationMethodRelation",
  AddService = "AddService",
  UpdateService = "UpdateService",
  RemoveService = "RemoveService",
  Deactivate = "Deactivate"
}

/**
 * DIDOperation ADT using the DIDOperationType enum.
 */
export type DIDOperation =
  | {
      type: DIDOperationType.AddVerificationMethod;
      verificationMethod: VerificationMethod;
    }
  | {
      type: DIDOperationType.UpdateVerificationMethod;
      verificationMethod: VerificationMethod;
    }
  | {
      type: DIDOperationType.RemoveVerificationMethod;
      id: string; // method id
    }
  | {
      type: DIDOperationType.AddVerificationMethodRelation;
      relation: VerificationMethodRelation;
      methodId: string;
    }
  | {
      type: DIDOperationType.RemoveVerificationMethodRelation;
      relation: VerificationMethodRelation;
      methodId: string;
    }
  | {
      type: DIDOperationType.AddService;
      service: Service;
    }
  | {
      type: DIDOperationType.UpdateService;
      service: Service;
    }
  | {
      type: DIDOperationType.RemoveService;
      serviceId: string;
    }
  | {
      type: DIDOperationType.Deactivate;
    };

/**
 * Zod schema for DIDOperationType enum.
 */
export const DIDOperationTypeSchema = z.enum(DIDOperationType);

/**
 * Zod schema for DIDOperation.
 */
export const DIDOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(DIDOperationType.AddVerificationMethod),
    verificationMethod: VerificationMethodSchema
  }),
  z.object({
    type: z.literal(DIDOperationType.UpdateVerificationMethod),
    verificationMethod: VerificationMethodSchema
  }),
  z.object({
    type: z.literal(DIDOperationType.RemoveVerificationMethod),
    id: z.string()
  }),
  z.object({
    type: z.literal(DIDOperationType.AddVerificationMethodRelation),
    relation: VerificationMethodRelationTypeSchema,
    methodId: z.string()
  }),
  z.object({
    type: z.literal(DIDOperationType.RemoveVerificationMethodRelation),
    relation: VerificationMethodRelationTypeSchema,
    methodId: z.string()
  }),
  z.object({
    type: z.literal(DIDOperationType.Deactivate)
  })
]);
