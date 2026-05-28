import { deriveControllerPublicKey } from "@midnight-ntwrk/midnight-did-contract";
import { describe, expect, it, vi } from "vitest";

import { rotateControllerKey } from "../controller-operations.js";
import { MidnightDIDPrivateStateId } from "../types.js";

describe("controller operations", () => {
  it("rotates to a locally derived controller public key and stores the new secret", async () => {
    const newSecretKey = new Uint8Array(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
    const rotateControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x123" },
    }));
    const privateStateProvider = {
      set: vi.fn(async () => undefined),
    };

    const result = await rotateControllerKey(
      { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
      { privateStateProvider } as any,
      newSecretKey,
    );

    expect(rotateControllerKeyTx).toHaveBeenCalledWith(
      deriveControllerPublicKey(newSecretKey),
    );
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
      { secretKey: newSecretKey },
    );
    expect(result).toEqual({ txId: "0x123" });
    expect(rotateControllerKeyTx.mock.invocationCallOrder[0]).toBeLessThan(
      privateStateProvider.set.mock.invocationCallOrder[0],
    );
  });

  it("rejects invalid replacement secrets before submitting a transaction", async () => {
    const rotateControllerKeyTx = vi.fn();

    await expect(
      rotateControllerKey(
        { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
        { privateStateProvider: { set: vi.fn() } } as any,
        new Uint8Array(31),
      ),
    ).rejects.toThrow(/32 bytes/);

    expect(rotateControllerKeyTx).not.toHaveBeenCalled();
  });
});
