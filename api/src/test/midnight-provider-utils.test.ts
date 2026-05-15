import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import * as Rx from "rxjs";
import { describe, expect, it, vi } from "vitest";

import {
  createContractScopedPrivateStateProvider,
  createPrivateStatePasswordProvider,
  isMissingPrivateStateContractAddressError,
  MissingPrivateStateContractAddressError,
  PRIVATE_STATE_PASSWORD_ENV,
  resolvePrivateStatePassword,
  waitForWalletFunds,
  waitForWalletSync,
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

  it("waitForWalletSync exposes observed wallet states to callers", async () => {
    const onState = vi.fn();
    const wallet = {
      state: () => Rx.of({ isSynced: true }),
    } as any;

    const state = await waitForWalletSync(wallet, { onState, throttleMs: 0 });

    expect(state.isSynced).toBe(true);
    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({ isSynced: true }),
    );
  });

  it("waitForWalletFunds exposes observed wallet states and resolves funded balances", async () => {
    const onState = vi.fn();
    const token = unshieldedToken().raw;
    const wallet = {
      state: () =>
        Rx.of({
          isSynced: true,
          unshielded: { balances: { [token]: 42n } },
        }),
    } as any;

    const balance = await waitForWalletFunds(wallet, {
      onState,
      throttleMs: 0,
    });

    expect(balance).toBe(42n);
    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({ isSynced: true }),
    );
  });

  it("wraps private-state get/set with a typed missing-contract-address guard", async () => {
    const provider = {
      setContractAddress: vi.fn(),
      get: vi.fn().mockResolvedValue({ secretKey: new Uint8Array([1]) }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      clear: vi.fn(),
      setSigningKey: vi.fn(),
      getSigningKey: vi.fn(),
      removeSigningKey: vi.fn(),
      clearSigningKeys: vi.fn(),
      exportPrivateStates: vi.fn().mockResolvedValue({
        encryptedPayload: "payload",
        format: "midnight-private-state-export",
        salt: "00",
      }),
      importPrivateStates: vi.fn().mockResolvedValue({
        imported: 1,
        overwritten: 0,
        skipped: 0,
      }),
      exportSigningKeys: vi.fn(),
      importSigningKeys: vi.fn(),
    };
    const wrapped = createContractScopedPrivateStateProvider<
      "state-id",
      { secretKey: Uint8Array }
    >(provider);

    await expect(wrapped.get("state-id")).rejects.toBeInstanceOf(
      MissingPrivateStateContractAddressError,
    );
    await expect(
      wrapped.set("state-id", { secretKey: new Uint8Array([2]) }),
    ).rejects.toMatchObject({
      code: "MIDNIGHT_DID_PRIVATE_STATE_CONTRACT_ADDRESS_NOT_SET",
      operation: "set",
    });
    await expect(wrapped.remove("state-id")).rejects.toMatchObject({
      operation: "remove",
    });
    await expect(wrapped.clear()).rejects.toMatchObject({
      operation: "clear",
    });
    await expect(wrapped.exportPrivateStates()).rejects.toMatchObject({
      operation: "export",
    });
    await expect(
      wrapped.importPrivateStates({
        encryptedPayload: "payload",
        format: "midnight-private-state-export",
        salt: "00",
      }),
    ).rejects.toMatchObject({
      operation: "import",
    });
    expect(provider.get).not.toHaveBeenCalled();
    expect(provider.set).not.toHaveBeenCalled();
    expect(provider.remove).not.toHaveBeenCalled();
    expect(provider.clear).not.toHaveBeenCalled();
    expect(provider.exportPrivateStates).not.toHaveBeenCalled();
    expect(provider.importPrivateStates).not.toHaveBeenCalled();

    wrapped.setContractAddress("a".repeat(64));

    await expect(wrapped.get("state-id")).resolves.toEqual({
      secretKey: new Uint8Array([1]),
    });
    await wrapped.set("state-id", { secretKey: new Uint8Array([3]) });
    await wrapped.remove("state-id");
    await wrapped.clear();
    await expect(wrapped.exportPrivateStates()).resolves.toEqual({
      encryptedPayload: "payload",
      format: "midnight-private-state-export",
      salt: "00",
    });
    await expect(
      wrapped.importPrivateStates({
        encryptedPayload: "payload",
        format: "midnight-private-state-export",
        salt: "00",
      }),
    ).resolves.toEqual({
      imported: 1,
      overwritten: 0,
      skipped: 0,
    });
    expect(provider.setContractAddress).toHaveBeenCalledWith("a".repeat(64));
    expect(provider.setContractAddress).toHaveBeenCalledOnce();
    expect(provider.get).toHaveBeenCalledWith("state-id");
    expect(provider.set).toHaveBeenCalledWith("state-id", {
      secretKey: new Uint8Array([3]),
    });
    expect(provider.remove).toHaveBeenCalledWith("state-id");
    expect(provider.clear).toHaveBeenCalledOnce();
    expect(provider.exportPrivateStates).toHaveBeenCalledOnce();
    expect(provider.importPrivateStates).toHaveBeenCalledWith(
      {
        encryptedPayload: "payload",
        format: "midnight-private-state-export",
        salt: "00",
      },
      undefined,
    );
  });

  it("detects missing-contract-address errors by typed code, not SDK text", () => {
    expect(
      isMissingPrivateStateContractAddressError({
        code: "MIDNIGHT_DID_PRIVATE_STATE_CONTRACT_ADDRESS_NOT_SET",
      }),
    ).toBe(true);
    expect(
      isMissingPrivateStateContractAddressError(
        new Error("Contract address not set"),
      ),
    ).toBe(false);
  });
});
