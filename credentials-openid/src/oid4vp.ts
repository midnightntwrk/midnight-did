import { z } from "zod";

import { MidnightPresentationRequestExtensionSchema } from "./midnight.js";
import {
  JsonObjectSchema,
  JsonValueSchema,
  NonEmptyStringSchema,
  UriSchema,
  UrlSchema,
} from "./shared.js";

export const ClaimFormatDesignationSchema = z.object({
  alg: z.array(NonEmptyStringSchema).optional(),
  proof_type: z.array(NonEmptyStringSchema).optional(),
});
export type ClaimFormatDesignation = z.infer<
  typeof ClaimFormatDesignationSchema
>;

export const PresentationDefinitionFieldSchema = z.object({
  id: NonEmptyStringSchema.optional(),
  path: z.array(NonEmptyStringSchema).min(1),
  purpose: NonEmptyStringSchema.optional(),
  filter: JsonObjectSchema.optional(),
});
export type PresentationDefinitionField = z.infer<
  typeof PresentationDefinitionFieldSchema
>;

export const PresentationDefinitionConstraintsSchema = z.object({
  limit_disclosure: z.enum(["required", "preferred"]).optional(),
  fields: z.array(PresentationDefinitionFieldSchema).default([]),
});
export type PresentationDefinitionConstraints = z.infer<
  typeof PresentationDefinitionConstraintsSchema
>;

export const InputDescriptorSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema.optional(),
  purpose: NonEmptyStringSchema.optional(),
  format: z.record(NonEmptyStringSchema, ClaimFormatDesignationSchema).optional(),
  constraints: PresentationDefinitionConstraintsSchema.default({ fields: [] }),
});
export type InputDescriptor = z.infer<typeof InputDescriptorSchema>;

export const PresentationDefinitionSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema.optional(),
  purpose: NonEmptyStringSchema.optional(),
  format: z.record(NonEmptyStringSchema, ClaimFormatDesignationSchema).optional(),
  input_descriptors: z.array(InputDescriptorSchema).min(1),
});
export type PresentationDefinition = z.infer<
  typeof PresentationDefinitionSchema
>;

export const VpAuthorizationRequestSchema = z.object({
  response_type: z.literal("vp_token"),
  client_id: NonEmptyStringSchema,
  redirect_uri: UrlSchema.optional(),
  response_mode: z.enum(["direct_post", "direct_post.jwt", "fragment"]).optional(),
  state: NonEmptyStringSchema.optional(),
  nonce: NonEmptyStringSchema,
  presentation_definition: PresentationDefinitionSchema,
  client_metadata: JsonObjectSchema.optional(),
  midnight: MidnightPresentationRequestExtensionSchema.optional(),
});
export type VpAuthorizationRequest = z.infer<
  typeof VpAuthorizationRequestSchema
>;

export type DescriptorMap = {
  readonly id: string;
  readonly format: string;
  readonly path: string;
  readonly path_nested?: DescriptorMap;
};

export const DescriptorMapSchema: z.ZodType<DescriptorMap> = z.object({
  id: NonEmptyStringSchema,
  format: NonEmptyStringSchema,
  path: NonEmptyStringSchema,
  path_nested: z.lazy(() => DescriptorMapSchema).optional(),
});

export const PresentationSubmissionSchema = z.object({
  id: NonEmptyStringSchema,
  definition_id: NonEmptyStringSchema,
  descriptor_map: z.array(DescriptorMapSchema).min(1),
});
export type PresentationSubmission = z.infer<
  typeof PresentationSubmissionSchema
>;

export const VpAuthorizationResponseSchema = z.object({
  state: NonEmptyStringSchema.optional(),
  vp_token: JsonValueSchema,
  presentation_submission: PresentationSubmissionSchema,
});
export type VpAuthorizationResponse = z.infer<
  typeof VpAuthorizationResponseSchema
>;

export const createPresentationDefinition = (
  input: PresentationDefinition,
): PresentationDefinition => PresentationDefinitionSchema.parse(input);

export const createVpAuthorizationRequest = (
  input: VpAuthorizationRequest,
): VpAuthorizationRequest => VpAuthorizationRequestSchema.parse(input);

export const createVpAuthorizationResponse = (
  input: VpAuthorizationResponse,
): VpAuthorizationResponse => VpAuthorizationResponseSchema.parse(input);

export const presentationRequestUri = (input: {
  readonly requestUri: string;
  readonly clientId?: string;
}): string => {
  const url = new URL("openid4vp://authorize");
  url.searchParams.set("request_uri", input.requestUri);
  if (input.clientId) {
    url.searchParams.set("client_id", input.clientId);
  }
  return url.toString();
};

export const parseVpAuthorizationRequest = (
  input: unknown,
): VpAuthorizationRequest => VpAuthorizationRequestSchema.parse(input);

export const assertPresentationSubmissionMatchesDefinition = (input: {
  readonly definition: PresentationDefinition;
  readonly submission: PresentationSubmission;
}): void => {
  const descriptorIds = new Set(
    input.definition.input_descriptors.map((descriptor) => descriptor.id),
  );
  for (const descriptor of input.submission.descriptor_map) {
    if (!descriptorIds.has(descriptor.id)) {
      throw new Error(
        `Presentation submission references unknown input descriptor "${descriptor.id}"`,
      );
    }
  }
};

export const createMidnightCompactDescriptor = (input: {
  readonly id: string;
  readonly path: string;
}): DescriptorMap =>
  DescriptorMapSchema.parse({
    id: input.id,
    format: "midnight_compact_vp",
    path: input.path,
  });

export const createFieldPath = (path: string): string =>
  path.startsWith("$.") ? path : `$.${path}`;
