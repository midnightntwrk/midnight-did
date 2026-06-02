import { describe, expect, it, vi } from "vitest";

const providerMocks = vi.hoisted(() => ({
  levelPrivateStateProvider: vi.fn((options: unknown) => ({
    kind: "private-state-provider",
    options,
  })),
}));

vi.mock("@midnight-ntwrk/midnight-js-level-private-state-provider", () => ({
  levelPrivateStateProvider: providerMocks.levelPrivateStateProvider,
}));

import {
  createDIDPrivateStateProvider,
  createPrivateStateProviderOptions,
  derivePrivateStoragePassword,
} from "../private-state-storage.js";
import { type MidnightDIDWalletContext } from "../types.js";

const makeWalletContext = (
  secretKey: Uint8Array,
): Pick<MidnightDIDWalletContext, "unshieldedKeystore"> => ({
  unshieldedKeystore: {
    getSecretKey: vi.fn(() => secretKey),
  } as unknown as MidnightDIDWalletContext["unshieldedKeystore"],
});

describe("private-state storage wiring", () => {
  it("derives the level private-state password from the wallet secret key", () => {
    expect(derivePrivateStoragePassword(new Uint8Array([0xab, 0xcd]))).toBe(
      "abcd!A",
    );
  });

  it("builds deterministic private-state provider options", () => {
    const ctx = makeWalletContext(new Uint8Array([1, 2, 3]));

    const options = createPrivateStateProviderOptions(
      ctx,
      { midnightDbName: "did-db" },
      "account-1",
    );

    expect(options).toMatchObject({
      midnightDbName: "did-db",
      privateStateStoreName: "did-private-state",
      accountId: "account-1",
    });
    expect(options.privateStoragePasswordProvider()).toBe("010203!A");
    expect(options.privateStoragePasswordProvider()).toBe("010203!A");
    expect(ctx.unshieldedKeystore.getSecretKey).toHaveBeenCalledTimes(1);
  });

  it("allows the SDK default database when no db name is configured", () => {
    const ctx = makeWalletContext(new Uint8Array([7, 8, 9]));

    const options = createPrivateStateProviderOptions(ctx, {}, "account-3");

    expect(options.midnightDbName).toBeUndefined();
    expect(options.privateStoragePasswordProvider()).toBe("070809!A");
  });

  it("creates the runtime provider through the isolated options builder", () => {
    const ctx = makeWalletContext(new Uint8Array([4, 5, 6]));

    const provider = createDIDPrivateStateProvider(
      ctx,
      { midnightDbName: "runtime-db" },
      "account-2",
    );

    expect(provider).toEqual({
      kind: "private-state-provider",
      options: expect.objectContaining({
        midnightDbName: "runtime-db",
        privateStateStoreName: "did-private-state",
        accountId: "account-2",
      }),
    });
    expect(providerMocks.levelPrivateStateProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        midnightDbName: "runtime-db",
        privateStateStoreName: "did-private-state",
        accountId: "account-2",
      }),
    );
  });
});
