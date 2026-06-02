import { z } from "zod";

const SEED_HEX_BYTES = 32;
const SEED_HEX_LENGTH = SEED_HEX_BYTES * 2;

const SeedSchema = z
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

export const parseSeed = (value: string): string => SeedSchema.parse(value);
