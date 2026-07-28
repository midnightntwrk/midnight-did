import { deriveControllerPublicKey } from "@midnight-ntwrk/midnight-did-contract";
import { describe, expect, it, vi } from "vitest";

vi.mock("../controller-authorization.js", () => ({
  asSchnorrJubjubDigest: vi.fn((digest: unknown) => digest),
  createControllerAuthorization: vi.fn(async () => [
    { announcement: { x: 1n, y: 2n }, response: 3n },
    7n,
  ]),
}));

vi.mock("../ledger-state.js", () => ({
  requireDeployedMidnightDIDLedgerState: vi.fn(async () => ({
    id: { bytes: new Uint8Array(32).fill(1) },
    version: 7n,
  })),
}));

import {
  recoverControllerKey,
  rotateControllerKey,
} from "../controller-operations.js";
import {
  MidnightDIDPendingControllerPrivateStateId,
  MidnightDIDPrivateStateId,
} from "../types.js";

describe("controller operations", () => {
  it("rotates to a locally derived controller public key and stores the new secret", async () => {
    const newSecretKey = new Uint8Array(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
    const rotateControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x123" },
    }));
    const recoverySecretKey = new Uint8Array(32).fill(99);
    const privateStateProvider = {
      get: vi.fn(async () => ({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(98),
      })),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    const result = await rotateControllerKey(
      { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
      { privateStateProvider } as any,
      newSecretKey,
    );

    expect(rotateControllerKeyTx).toHaveBeenCalledWith(
      deriveControllerPublicKey(newSecretKey),
      { announcement: { x: 1n, y: 2n }, response: 3n },
      7n,
    );
    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      1,
      MidnightDIDPendingControllerPrivateStateId,
      { recoverySecretKey, secretKey: newSecretKey },
    );
    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      2,
      MidnightDIDPrivateStateId,
      { recoverySecretKey, secretKey: newSecretKey },
    );
    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
    expect(result).toEqual({ txId: "0x123" });
    expect(privateStateProvider.set.mock.invocationCallOrder[0]).toBeLessThan(
      rotateControllerKeyTx.mock.invocationCallOrder[0],
    );
    expect(rotateControllerKeyTx.mock.invocationCallOrder[0]).toBeLessThan(
      privateStateProvider.set.mock.invocationCallOrder[1],
    );
  });

  it("recovers to a locally derived controller public key with recovery private state", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(9);
    const newSecretKey = new Uint8Array(32).fill(10);
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x456" },
    }));
    const privateStateProvider = {
      get: vi.fn(async () => ({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(8),
      })),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    const result = await recoverControllerKey(
      { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
      { privateStateProvider } as any,
      newSecretKey,
    );

    expect(recoverControllerKeyTx).toHaveBeenCalledWith(
      deriveControllerPublicKey(newSecretKey),
      expect.objectContaining({
        announcement: expect.objectContaining({ x: expect.anything() }),
      }),
      7n,
    );
    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      1,
      MidnightDIDPendingControllerPrivateStateId,
      { recoverySecretKey, secretKey: newSecretKey },
    );
    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      2,
      MidnightDIDPrivateStateId,
      { recoverySecretKey, secretKey: newSecretKey },
    );
    expect(result).toEqual({ txId: "0x456" });
  });

  it("recovers with only recovery private state available", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(9);
    const newSecretKey = new Uint8Array(32).fill(14);
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0xabc" },
    }));
    const privateStateProvider = {
      get: vi.fn(async () => ({ recoverySecretKey })),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        newSecretKey,
      ),
    ).resolves.toEqual({ txId: "0xabc" });

    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      2,
      MidnightDIDPrivateStateId,
      { recoverySecretKey, secretKey: newSecretKey },
    );
  });

  it("recovers with an explicitly supplied recovery secret", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(15);
    const newSecretKey = new Uint8Array(32).fill(16);
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0xdef" },
    }));
    const privateStateProvider = {
      get: vi.fn(),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        newSecretKey,
        recoverySecretKey,
      ),
    ).resolves.toEqual({ txId: "0xdef" });

    expect(privateStateProvider.get).not.toHaveBeenCalled();
  });

  it("rejects recovery before submitting a transaction if pending state cannot be saved", async () => {
    const recoverControllerKeyTx = vi.fn();
    const privateStateProvider = {
      get: vi.fn(async () => ({
        recoverySecretKey: new Uint8Array(32).fill(9),
        secretKey: new Uint8Array(32).fill(8),
      })),
      set: vi.fn(async () => {
        throw new Error("recovery storage offline");
      }),
      remove: vi.fn(),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(11),
      ),
    ).rejects.toThrow(/recovery storage offline/);

    expect(recoverControllerKeyTx).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("clears pending recovery state when the transaction fails before finalization", async () => {
    const recoverControllerKeyTx = vi.fn(async () => {
      throw new Error("recovery transaction rejected");
    });
    const privateStateProvider = {
      get: vi.fn(async () => ({
        recoverySecretKey: new Uint8Array(32).fill(9),
        secretKey: new Uint8Array(32).fill(8),
      })),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(12),
      ),
    ).rejects.toThrow(/recovery transaction rejected/);

    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
  });

  it("keeps pending recovery state when active promotion fails after finalization", async () => {
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x789" },
    }));
    const privateStateProvider = {
      get: vi.fn(async () => ({
        recoverySecretKey: new Uint8Array(32).fill(9),
        secretKey: new Uint8Array(32).fill(8),
      })),
      set: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("recovery active write failed")),
      remove: vi.fn(),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(13),
      ),
    ).rejects.toThrow(/recovery active write failed/);

    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("rejects invalid replacement secrets before submitting a transaction", async () => {
    const rotateControllerKeyTx = vi.fn();

    await expect(
      rotateControllerKey(
        { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
        {
          privateStateProvider: {
            get: vi.fn(async () => ({
              recoverySecretKey: new Uint8Array(32).fill(5),
              secretKey: new Uint8Array(32).fill(4),
            })),
            set: vi.fn(),
            remove: vi.fn(),
          },
        } as any,
        new Uint8Array(31),
      ),
    ).rejects.toThrow(/32 bytes/);

    expect(rotateControllerKeyTx).not.toHaveBeenCalled();
  });

  it("rejects before submitting a transaction if pending state cannot be saved", async () => {
    const rotateControllerKeyTx = vi.fn();
    const privateStateProvider = {
      get: vi.fn(async () => ({
        recoverySecretKey: new Uint8Array(32).fill(5),
        secretKey: new Uint8Array(32).fill(4),
      })),
      set: vi.fn(async () => {
        throw new Error("storage offline");
      }),
      remove: vi.fn(),
    };

    await expect(
      rotateControllerKey(
        { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(1),
      ),
    ).rejects.toThrow(/storage offline/);

    expect(rotateControllerKeyTx).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("clears pending state when the transaction fails before finalization", async () => {
    const rotateControllerKeyTx = vi.fn(async () => {
      throw new Error("transaction rejected");
    });
    const privateStateProvider = {
      get: vi.fn(async () => ({
        recoverySecretKey: new Uint8Array(32).fill(5),
        secretKey: new Uint8Array(32).fill(4),
      })),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(2),
      ),
    ).rejects.toThrow(/transaction rejected/);

    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
  });

  it("keeps pending state when active promotion fails after finalization", async () => {
    const rotateControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x123" },
    }));
    const privateStateProvider = {
      get: vi.fn(async () => ({
        recoverySecretKey: new Uint8Array(32).fill(5),
        secretKey: new Uint8Array(32).fill(4),
      })),
      set: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("active write failed")),
      remove: vi.fn(),
    };

    await expect(
      rotateControllerKey(
        { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(3),
      ),
    ).rejects.toThrow(/active write failed/);

    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });
});
