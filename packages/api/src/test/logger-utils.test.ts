import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BigIntReplacer, createLogger } from "../logger-utils.js";

const readFileEventually = async (
  filePath: string,
  timeoutMs = 1500,
): Promise<string> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  return fs.readFile(filePath, "utf8");
};

describe("logger-utils", () => {
  it("converts bigint values using BigIntReplacer", () => {
    expect(BigIntReplacer("value", 12n)).toBe("12");
    expect(BigIntReplacer("value", 5)).toBe(5);
  });

  it("creates a logger and writes to file using default level", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "midnight-did-api-"));
    const logPath = path.join(dir, "app.log");
    const logger = await createLogger(logPath);

    expect(logger.level).toBe("info");
    logger.info("hello-default-level");
    (logger as { flush?: () => void }).flush?.();

    const contents = await readFileEventually(logPath);
    expect(contents).toContain("hello-default-level");
  });

  it("honors DEBUG_LEVEL env var", async () => {
    const previous = process.env.DEBUG_LEVEL;
    process.env.DEBUG_LEVEL = "debug";
    try {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "midnight-did-api-"));
      const logPath = path.join(dir, "debug.log");
      const logger = await createLogger(logPath);

      expect(logger.level).toBe("debug");
      logger.debug("hello-debug-level");
      (logger as { flush?: () => void }).flush?.();

      const contents = await readFileEventually(logPath);
      expect(contents).toContain("hello-debug-level");
    } finally {
      if (previous === undefined) {
        delete process.env.DEBUG_LEVEL;
      } else {
        process.env.DEBUG_LEVEL = previous;
      }
    }
  });
});
