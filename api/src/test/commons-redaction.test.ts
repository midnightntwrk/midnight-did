import { createHash } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { parseArgs } from "./commons";

const ORIGINAL_ENV = { ...process.env };

const fingerprintPrefix = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, 8);

describe("api test commons redaction", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses a seed fingerprint instead of raw seed characters in cache filenames", () => {
    const seed = "not-a-real-secret-seed-for-api-cache-tests";
    process.env.TEST_WALLET_SEED = seed;
    process.env.TEST_ENV = "testnet";

    const config = parseArgs(["seed", "env"]);

    expect(config.cacheFileName).toBe(
      `${fingerprintPrefix(seed)}-testnet.state`,
    );
    expect(config.cacheFileName).not.toContain(seed.slice(0, 7));
  });
});
