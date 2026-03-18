import { z } from "zod";

export const SEED_HEX_BYTES = 32;
export const SEED_HEX_LENGTH = SEED_HEX_BYTES * 2;

export const SeedSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(
    z
      .string()
      .regex(/^[0-9a-f]+$/u, "Seed must contain only hexadecimal characters")
      .length(
        SEED_HEX_LENGTH,
        `Seed must be exactly ${SEED_HEX_LENGTH} hex characters (${SEED_HEX_BYTES} bytes)`,
      ),
  );

export type Seed = z.infer<typeof SeedSchema>;

export const parseSeed = (value: string): Seed => SeedSchema.parse(value);

export const seedToBuffer = (value: string): Buffer =>
  Buffer.from(parseSeed(value), "hex");
