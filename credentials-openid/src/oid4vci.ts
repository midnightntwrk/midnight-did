import { z } from "zod";

import { MidnightCredentialRequestExtensionSchema } from "./midnight.js";
import {
  JsonObjectSchema,
  JsonValueSchema,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  UriSchema,
  UrlSchema,
} from "./shared.js";

export const PreAuthorizedCodeGrantType =
  "urn:ietf:params:oauth:grant-type:pre-authorized_code" as const;

export const CredentialFormatSchema = z.enum([
  "jwt_vc_json",
  "jwt_vc_json-ld",
  "ldp_vc",
  "mso_mdoc",
  "midnight_compact_vc",
]);
export type CredentialFormat = z.infer<typeof CredentialFormatSchema>;

export const ProofTypeSchema = z.enum(["jwt", "ldp_vp", "attestation"]);
export type ProofType = z.infer<typeof ProofTypeSchema>;

export const ProofTypeMetadataSchema = z.object({
  proof_signing_alg_values_supported: z.array(NonEmptyStringSchema).optional(),
});
export type ProofTypeMetadata = z.infer<typeof ProofTypeMetadataSchema>;

export const CredentialDisplaySchema = z.object({
  name: NonEmptyStringSchema,
  locale: NonEmptyStringSchema.optional(),
  logo: z
    .object({
      uri: UrlSchema,
      alt_text: NonEmptyStringSchema.optional(),
    })
    .optional(),
});
export type CredentialDisplay = z.infer<typeof CredentialDisplaySchema>;

export const CredentialConfigurationSchema = z.object({
  format: CredentialFormatSchema,
  scope: NonEmptyStringSchema.optional(),
  cryptographic_binding_methods_supported: z
    .array(NonEmptyStringSchema)
    .optional(),
  credential_signing_alg_values_supported: z
    .array(NonEmptyStringSchema)
    .optional(),
  proof_types_supported: z.partialRecord(
    ProofTypeSchema,
    ProofTypeMetadataSchema,
  ).optional(),
  credential_definition: JsonObjectSchema.optional(),
  display: z.array(CredentialDisplaySchema).optional(),
});
export type CredentialConfiguration = z.infer<
  typeof CredentialConfigurationSchema
>;

export const CredentialIssuerMetadataSchema = z.object({
  credential_issuer: UrlSchema,
  credential_endpoint: UrlSchema,
  token_endpoint: UrlSchema.optional(),
  authorization_servers: z.array(UrlSchema).optional(),
  credential_configurations_supported: z.record(
    NonEmptyStringSchema,
    CredentialConfigurationSchema,
  ),
});
export type CredentialIssuerMetadata = z.infer<
  typeof CredentialIssuerMetadataSchema
>;

export const TransactionCodeSchema = z.object({
  input_mode: z.enum(["numeric", "text"]).optional(),
  length: PositiveIntegerSchema.optional(),
  description: NonEmptyStringSchema.optional(),
});
export type TransactionCode = z.infer<typeof TransactionCodeSchema>;

export const PreAuthorizedCodeGrantSchema = z.object({
  "pre-authorized_code": NonEmptyStringSchema,
  tx_code: TransactionCodeSchema.optional(),
  authorization_server: UrlSchema.optional(),
});
export type PreAuthorizedCodeGrant = z.infer<
  typeof PreAuthorizedCodeGrantSchema
>;

export const AuthorizationCodeGrantSchema = z.object({
  issuer_state: NonEmptyStringSchema.optional(),
  authorization_server: UrlSchema.optional(),
});
export type AuthorizationCodeGrant = z.infer<
  typeof AuthorizationCodeGrantSchema
>;

export const CredentialOfferGrantsSchema = z.object({
  [PreAuthorizedCodeGrantType]: PreAuthorizedCodeGrantSchema.optional(),
  authorization_code: AuthorizationCodeGrantSchema.optional(),
});
export type CredentialOfferGrants = z.infer<typeof CredentialOfferGrantsSchema>;

export const CredentialOfferSchema = z.object({
  credential_issuer: UrlSchema,
  credential_configuration_ids: z.array(NonEmptyStringSchema).min(1),
  grants: CredentialOfferGrantsSchema.optional(),
});
export type CredentialOffer = z.infer<typeof CredentialOfferSchema>;

export const TokenRequestSchema = z.object({
  grant_type: z.literal(PreAuthorizedCodeGrantType),
  "pre-authorized_code": NonEmptyStringSchema,
  tx_code: NonEmptyStringSchema.optional(),
});
export type TokenRequest = z.infer<typeof TokenRequestSchema>;

export const TokenResponseSchema = z.object({
  access_token: NonEmptyStringSchema,
  token_type: z.literal("Bearer"),
  expires_in: PositiveIntegerSchema.optional(),
  c_nonce: NonEmptyStringSchema.optional(),
  c_nonce_expires_in: PositiveIntegerSchema.optional(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const CredentialProofSchema = z.object({
  proof_type: ProofTypeSchema,
  jwt: NonEmptyStringSchema.optional(),
  ldp_vp: JsonObjectSchema.optional(),
  attestation: NonEmptyStringSchema.optional(),
});
export type CredentialProof = z.infer<typeof CredentialProofSchema>;

export const CredentialRequestSchema = z.object({
  credential_configuration_id: NonEmptyStringSchema,
  format: CredentialFormatSchema.optional(),
  proof: CredentialProofSchema.optional(),
  proofs: z.partialRecord(
    ProofTypeSchema,
    z.array(CredentialProofSchema),
  ).optional(),
  midnight: MidnightCredentialRequestExtensionSchema.optional(),
});
export type CredentialRequest = z.infer<typeof CredentialRequestSchema>;

export const CredentialResponseSchema = z.object({
  credential: JsonValueSchema.optional(),
  credentials: z.array(JsonValueSchema).optional(),
  transaction_id: NonEmptyStringSchema.optional(),
  notification_id: NonEmptyStringSchema.optional(),
  c_nonce: NonEmptyStringSchema.optional(),
  c_nonce_expires_in: NonNegativeIntegerSchema.optional(),
});
export type CredentialResponse = z.infer<typeof CredentialResponseSchema>;

export const createPreAuthorizedCredentialOffer = (input: {
  readonly credentialIssuer: string;
  readonly credentialConfigurationIds: readonly string[];
  readonly preAuthorizedCode: string;
  readonly txCode?: TransactionCode;
}): CredentialOffer =>
  CredentialOfferSchema.parse({
    credential_issuer: input.credentialIssuer,
    credential_configuration_ids: input.credentialConfigurationIds,
    grants: {
      [PreAuthorizedCodeGrantType]: {
        "pre-authorized_code": input.preAuthorizedCode,
        tx_code: input.txCode,
      },
    },
  });

export const createPreAuthorizedTokenRequest = (input: {
  readonly offer: CredentialOffer;
  readonly txCode?: string;
}): TokenRequest => {
  const grant = input.offer.grants?.[PreAuthorizedCodeGrantType];
  if (!grant) {
    throw new Error("Credential offer does not include a pre-authorized grant");
  }
  return TokenRequestSchema.parse({
    grant_type: PreAuthorizedCodeGrantType,
    "pre-authorized_code": grant["pre-authorized_code"],
    tx_code: input.txCode,
  });
};

export const createCredentialIssuerMetadata = (
  input: CredentialIssuerMetadata,
): CredentialIssuerMetadata => CredentialIssuerMetadataSchema.parse(input);

export const createCredentialRequest = (
  input: CredentialRequest,
): CredentialRequest => CredentialRequestSchema.parse(input);

export const createCredentialResponse = (
  input: CredentialResponse,
): CredentialResponse => CredentialResponseSchema.parse(input);

export const credentialOfferUri = (input: {
  readonly issuerOrigin: string;
  readonly offer: CredentialOffer;
}): string => {
  const url = new URL("openid-credential-offer://");
  url.searchParams.set("credential_offer", JSON.stringify(input.offer));
  url.searchParams.set("issuer_origin", input.issuerOrigin);
  return url.toString();
};

export const parseCredentialOffer = (input: unknown): CredentialOffer =>
  CredentialOfferSchema.parse(input);

export const parseCredentialOfferUri = (uri: string): CredentialOffer => {
  const parsed = new URL(uri);
  const offer = parsed.searchParams.get("credential_offer");
  if (!offer) {
    throw new Error("Credential offer URI is missing credential_offer");
  }
  return CredentialOfferSchema.parse(JSON.parse(offer) as unknown);
};
