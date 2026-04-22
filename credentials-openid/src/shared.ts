import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const JsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  JsonValueSchema,
);

export const UriSchema = z.string().min(1);
export const UrlSchema = z.string().url();
export const NonEmptyStringSchema = z.string().min(1);
export const PositiveIntegerSchema = z.number().int().positive();
export const NonNegativeIntegerSchema = z.number().int().nonnegative();
export const Base64UrlSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, "Expected unpadded base64url text");
export const HexBytesSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, "Expected 0x-prefixed hexadecimal bytes");

export const stringArray = (label: string) =>
  z.array(NonEmptyStringSchema).min(1, `${label} must not be empty`);

export const parseWithSchema = <T>(schema: z.ZodType<T>, input: unknown): T =>
  schema.parse(input);
