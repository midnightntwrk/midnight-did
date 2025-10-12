import {
  DIDKeyID,
  DIDKeyIDSchema,
  Service,
  ServiceId,
  ServiceIdSchema,
  ServiceSchema,
  VerificationMethod,
  VerificationMethodRelation,
  VerificationMethodRelationTypeSchema,
  VerificationMethodSchema,
} from "@midnight-ntwrk/midnight-did-domain";
import { z } from "zod/v4-mini";

const RFC3986_URI_REGEX = /^[A-Za-z][A-Za-z0-9+.-]*:.+/;

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
  | { type: DIDOperationType.RemoveVerificationMethod; id: DIDKeyID }
  | {
      type: DIDOperationType.AddVerificationMethodRelation;
      relation: VerificationMethodRelation;
      methodId: DIDKeyID;
    }
  | {
      type: DIDOperationType.RemoveVerificationMethodRelation;
      relation: VerificationMethodRelation;
      methodId: DIDKeyID;
    }
  | { type: DIDOperationType.AddService; service: Service }
  | { type: DIDOperationType.UpdateService; service: Service }
  | { type: DIDOperationType.RemoveService; serviceId: ServiceId }
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
    id: DIDKeyIDSchema,
  }),
  z.object({
    type: z.literal(DIDOperationType.AddVerificationMethodRelation),
    relation: VerificationMethodRelationTypeSchema,
    methodId: DIDKeyIDSchema,
  }),
  z.object({
    type: z.literal(DIDOperationType.RemoveVerificationMethodRelation),
    relation: VerificationMethodRelationTypeSchema,
    methodId: DIDKeyIDSchema,
  }),
  z.object({
    type: z.literal(DIDOperationType.AddService),
    service: ServiceSchema,
  }),
  z.object({
    type: z.literal(DIDOperationType.UpdateService),
    service: ServiceSchema,
  }),
  z.object({
    type: z.literal(DIDOperationType.RemoveService),
    serviceId: ServiceIdSchema,
  }),
  z.object({
    type: z.literal(DIDOperationType.AddAlsoKnownAs),
    aliasUri: z
      .string()
      .check(
        z.refine(
          (value) => RFC3986_URI_REGEX.test(value),
          "aliasUri must be a valid RFC3986 URI",
        ),
      ),
  }),
  z.object({
    type: z.literal(DIDOperationType.RemoveAlsoKnownAs),
    aliasUri: z
      .string()
      .check(
        z.refine(
          (value) => RFC3986_URI_REGEX.test(value),
          "aliasUri must be a valid RFC3986 URI",
        ),
      ),
  }),
  z.object({ type: z.literal(DIDOperationType.Deactivate) }),
]);
