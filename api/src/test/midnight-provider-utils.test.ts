import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it, vi } from "vitest";

import {
  createPrivateStatePasswordProvider,
  PRIVATE_STATE_PASSWORD_ENV,
  resolvePrivateStatePassword,
} from "../midnight-provider-utils";

describe("midnight provider utility helpers", () => {
  it("resolves private state password from the configured environment", () => {
    expect(
      resolvePrivateStatePassword({
        env: {
          [PRIVATE_STATE_PASSWORD_ENV]: "configured-secret",
        },
        networkId: "undeployed",
      }),
    ).toBe("configured-secret");
  });

  it("uses the standalone fallback and invokes the fallback hook on undeployed", () => {
    const onStandaloneFallback = vi.fn();

    const password = resolvePrivateStatePassword({
      env: {},
      networkId: "undeployed",
      onStandaloneFallback,
    });

    expect(password).toBeTypeOf("string");
    expect(password.length).toBeGreaterThan(0);
    expect(onStandaloneFallback).toHaveBeenCalledOnce();
  });

  it("requires an explicit password outside undeployed networks", () => {
    expect(() =>
      resolvePrivateStatePassword({
        env: {},
        networkId: "preprod",
      }),
    ).toThrow(
      `${PRIVATE_STATE_PASSWORD_ENV} must be set before configuring Midnight DID private state for network preprod.`,
    );
  });

  it("emits the standalone fallback warning only once per password provider", () => {
    let previousNetworkId: string | undefined;
    try {
      previousNetworkId = getNetworkId();
    } catch {
      previousNetworkId = undefined;
    }

    setNetworkId("undeployed");
    const emitWarning = vi.fn() as unknown as typeof process.emitWarning;

    try {
      const getPassword = createPrivateStatePasswordProvider({ emitWarning });

      const firstPassword = getPassword();
      const secondPassword = getPassword();

      expect(firstPassword).toBe(secondPassword);
      expect(emitWarning).toHaveBeenCalledOnce();
      expect(emitWarning).toHaveBeenCalledWith(
        `${PRIVATE_STATE_PASSWORD_ENV} is not set; using the local standalone-only private state password fallback.`,
        {
          code: "MIDNIGHT_DID_PRIVATE_STATE_PASSWORD_MISSING",
        },
      );
    } finally {
      if (previousNetworkId !== undefined) {
        setNetworkId(previousNetworkId);
      }
    }
  });
});
