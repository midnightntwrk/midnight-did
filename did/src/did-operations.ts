import {
  Service,
  VerificationMethod,
  VerificationMethodRelation,
  VerificationMethodRelationTypeSchema,
  VerificationMethodSchema,
} from "@midnight-ntwrk/midnight-did-domain";
import { z } from "zod/v4-mini";

export enum DIDOperationType {
  AddVerificationMethod = "AddVerificationMethod",
  UpdateVerificationMethod = "UpdateVerificationMethod",
  RemoveVerificationMethod = "RemoveVerificationMethod",
  AddVerificationMethodRelation = "AddVerificationMethodRelation",
  RemoveVerificationMethodRelation = "RemoveVerificationMethodRelation",
  AddService = "AddService",
  UpdateService = "UpdateService",
  RemoveService = "RemoveService",
  AddAlsoKnownAs = "AddAlsoKnownAs",
  RemoveAlsoKnownAs = "RemoveAlsoKnownAs",
  Deactivate = "Deactivate",
}

export type DIDOperation =
  | {
      type: DIDOperationType.AddVerificationMethod;
      verificationMethod: VerificationMethod;
    }
  | {
      type: DIDOperationType.UpdateVerificationMethod;
      verificationMethod: VerificationMethod;
    }
  | { type: DIDOperationType.RemoveVerificationMethod; id: string }
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
  | { type: DIDOperationType.AddService; service: Service }
  | { type: DIDOperationType.UpdateService; service: Service }
  | { type: DIDOperationType.RemoveService; serviceId: string }
  | { type: DIDOperationType.AddAlsoKnownAs; aliasUri: string }
  | { type: DIDOperationType.RemoveAlsoKnownAs; aliasUri: string }
  | { type: DIDOperationType.Deactivate };

export const DIDOperationTypeSchema = z.enum(DIDOperationType);

export const DIDOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(DIDOperationType.AddVerificationMethod),
    verificationMethod: VerificationMethodSchema,
  }),
  z.object({
    type: z.literal(DIDOperationType.UpdateVerificationMethod),
    verificationMethod: VerificationMethodSchema,
  }),
  z.object({
    type: z.literal(DIDOperationType.RemoveVerificationMethod),
    id: z.string(),
  }),
  z.object({
    type: z.literal(DIDOperationType.AddVerificationMethodRelation),
    relation: VerificationMethodRelationTypeSchema,
    methodId: z.string(),
  }),
  z.object({
    type: z.literal(DIDOperationType.RemoveVerificationMethodRelation),
    relation: VerificationMethodRelationTypeSchema,
    methodId: z.string(),
  }),
  z.object({
    type: z.literal(DIDOperationType.AddAlsoKnownAs),
    aliasUri: z.string(),
  }),
  z.object({
    type: z.literal(DIDOperationType.RemoveAlsoKnownAs),
    aliasUri: z.string(),
  }),
  z.object({ type: z.literal(DIDOperationType.Deactivate) }),
]);
