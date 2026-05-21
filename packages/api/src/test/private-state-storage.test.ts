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
} from "../private-state-storage";

describe("private-state storage wiring", () => {
  it("derives the level private-state password from the wallet secret key", () => {
    expect(derivePrivateStoragePassword(new Uint8Array([0xab, 0xcd]))).toBe(
      "abcd!A",
    );
  });

  it("builds deterministic private-state provider options", () => {
    const ctx = {
      unshieldedKeystore: {
        getSecretKey: vi.fn(() => new Uint8Array([1, 2, 3])),
      },
    } as any;

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
    expect(ctx.unshieldedKeystore.getSecretKey).toHaveBeenCalledTimes(1);
  });

  it("creates the runtime provider through the isolated options builder", () => {
    const ctx = {
      unshieldedKeystore: {
        getSecretKey: vi.fn(() => new Uint8Array([4, 5, 6])),
      },
    } as any;

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
