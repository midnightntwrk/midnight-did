import { describe, expect, it, vi } from "vitest";

import { getLogger, setLogger } from "../api-logger.js";

describe("api logger registry", () => {
  it("exposes a no-op logger before an embedder configures logging", () => {
    expect(() => getLogger().info("pre-configured log")).not.toThrow();
  });

  it("returns the configured logger after setLogger", () => {
    const logger = { info: vi.fn() } as any;

    setLogger(logger);

    expect(getLogger()).toBe(logger);
  });
});
