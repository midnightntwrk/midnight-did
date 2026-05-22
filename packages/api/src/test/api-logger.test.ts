import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLogger, setLogger } from "../api-logger.js";

describe("api logger registry", () => {
  let previousLogger: ReturnType<typeof getLogger>;

  beforeEach(() => {
    previousLogger = getLogger();
  });

  afterEach(() => {
    setLogger(previousLogger);
  });

  it("exposes a complete no-op logger before an embedder configures logging", () => {
    expect(() => getLogger().info("pre-configured log")).not.toThrow();
    expect(() => getLogger().warn("pre-configured warning")).not.toThrow();
    expect(() =>
      getLogger().child({ component: "test" }).debug("child log"),
    ).not.toThrow();
  });

  it("returns the configured logger after setLogger", () => {
    const logger = { info: vi.fn() } as any;

    setLogger(logger);

    expect(getLogger()).toBe(logger);
  });
});
