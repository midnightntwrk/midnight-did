import { deriveControllerPublicKey } from "@midnight-ntwrk/midnight-did-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../controller-authorization.js", () => ({
  asSchnorrJubjubDigest: vi.fn((digest: unknown) => digest),
  createControllerAuthorization: vi.fn(async () => [
    { announcement: { x: 1n, y: 2n }, response: 3n },
    7n,
  ]),
}));

vi.mock("../ledger-state.js", () => ({
  requireDeployedMidnightDIDLedgerState: vi.fn(),
}));

import { createControllerAuthorization } from "../controller-authorization.js";
import {
  recoverControllerKey,
  rotateControllerKey,
} from "../controller-operations.js";
import { requireDeployedMidnightDIDLedgerState } from "../ledger-state.js";
import { PendingControllerPrivateStateExistsError } from "../private-state.js";
import {
  MidnightDIDPendingControllerPrivateStateId,
  MidnightDIDPrivateStateId,
} from "../types.js";

const mockLedgerForRecovery = (recoverySecretKey: Uint8Array): void => {
  vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue({
    id: { bytes: new Uint8Array(32).fill(1) },
    recoveryAuthorityPublicKey: deriveControllerPublicKey(recoverySecretKey),
    version: 7n,
  } as any);
};

const getPrivateState = (
  activePrivateState: unknown,
  pendingPrivateState: unknown = null,
) =>
  vi.fn(async (privateStateId: string) =>
    privateStateId === MidnightDIDPendingControllerPrivateStateId
      ? pendingPrivateState
      : activePrivateState,
  );

describe("controller operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("rotates to a locally derived controller public key and stores the new secret", async () => {
    const newSecretKey = new Uint8Array(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
    const rotateControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x123" },
    }));
    const recoverySecretKey = new Uint8Array(32).fill(99);
    const privateStateProvider = {
      get: getPrivateState({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(98),
      }),
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

  it("rotates with only controller private state available", async () => {
    const newSecretKey = new Uint8Array(32).fill(6);
    const rotateControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x234" },
    }));
    const privateStateProvider = {
      get: getPrivateState({ secretKey: new Uint8Array(32).fill(4) }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
        { privateStateProvider } as any,
        newSecretKey,
      ),
    ).resolves.toEqual({ txId: "0x234" });

    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      2,
      MidnightDIDPrivateStateId,
      { secretKey: newSecretKey },
    );
  });

  it("recovers to a locally derived controller public key with recovery private state", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(9);
    const newSecretKey = new Uint8Array(32).fill(10);
    mockLedgerForRecovery(recoverySecretKey);
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x456" },
    }));
    const privateStateProvider = {
      get: getPrivateState({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(8),
      }),
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
    mockLedgerForRecovery(recoverySecretKey);
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0xabc" },
    }));
    const privateStateProvider = {
      get: getPrivateState({ recoverySecretKey }),
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
    mockLedgerForRecovery(recoverySecretKey);
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0xdef" },
    }));
    const privateStateProvider = {
      get: getPrivateState(null),
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

    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
    );
    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      1,
      MidnightDIDPendingControllerPrivateStateId,
      { secretKey: newSecretKey },
    );
    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      2,
      MidnightDIDPrivateStateId,
      { secretKey: newSecretKey },
    );
  });

  it("preserves an already stored recovery secret when one is explicitly supplied", async () => {
    const storedRecoverySecretKey = new Uint8Array(32).fill(17);
    const explicitRecoverySecretKey = storedRecoverySecretKey;
    const newSecretKey = new Uint8Array(32).fill(19);
    mockLedgerForRecovery(explicitRecoverySecretKey);
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0xfed" },
    }));
    const privateStateProvider = {
      get: getPrivateState({ recoverySecretKey: storedRecoverySecretKey }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        newSecretKey,
        explicitRecoverySecretKey,
      ),
    ).resolves.toEqual({ txId: "0xfed" });

    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      2,
      MidnightDIDPrivateStateId,
      { recoverySecretKey: storedRecoverySecretKey, secretKey: newSecretKey },
    );
  });

  it("rejects invalid explicit recovery secrets before querying ledger state", async () => {
    const recoverControllerKeyTx = vi.fn();
    const privateStateProvider = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(22),
        new Uint8Array(31),
      ),
    ).rejects.toThrow(/recovery secret key must be 32 bytes/);

    expect(requireDeployedMidnightDIDLedgerState).not.toHaveBeenCalled();
    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(recoverControllerKeyTx).not.toHaveBeenCalled();
  });

  it("rejects contracts without recovery authority before saving pending state", async () => {
    vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue({
      id: { bytes: new Uint8Array(32).fill(1) },
      version: 7n,
    } as any);
    const recoverControllerKeyTx = vi.fn();
    const privateStateProvider = {
      get: getPrivateState({
        recoverySecretKey: new Uint8Array(32).fill(20),
      }),
      set: vi.fn(),
      remove: vi.fn(),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(22),
      ),
    ).rejects.toThrow(/does not expose a recovery authority/);

    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(recoverControllerKeyTx).not.toHaveBeenCalled();
  });

  it("rejects mismatched recovery secrets before saving pending state", async () => {
    const storedRecoverySecretKey = new Uint8Array(32).fill(20);
    const ledgerRecoverySecretKey = new Uint8Array(32).fill(21);
    mockLedgerForRecovery(ledgerRecoverySecretKey);
    const recoverControllerKeyTx = vi.fn();
    const privateStateProvider = {
      get: getPrivateState({ recoverySecretKey: storedRecoverySecretKey }),
      set: vi.fn(),
      remove: vi.fn(),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(22),
      ),
    ).rejects.toThrow(/does not match/);

    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(recoverControllerKeyTx).not.toHaveBeenCalled();
  });

  it("rejects recovery before submitting a transaction if pending state cannot be saved", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(9);
    mockLedgerForRecovery(recoverySecretKey);
    const recoverControllerKeyTx = vi.fn();
    const privateStateProvider = {
      get: getPrivateState({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(8),
      }),
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

  it("rejects recovery before submission when a pending candidate exists", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(9);
    const pendingSecretKey = new Uint8Array(32).fill(31);
    mockLedgerForRecovery(recoverySecretKey);
    const recoverControllerKeyTx = vi.fn();
    const privateStateProvider = {
      get: getPrivateState(
        {
          recoverySecretKey,
          secretKey: new Uint8Array(32).fill(8),
        },
        { recoverySecretKey, secretKey: pendingSecretKey },
      ),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(12),
      ),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateExistsError);

    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
    expect(recoverControllerKeyTx).not.toHaveBeenCalled();
  });

  it("keeps pending recovery state when transaction outcome is unknown", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(9);
    mockLedgerForRecovery(recoverySecretKey);
    const recoverControllerKeyTx = vi.fn(async () => {
      throw new Error("recovery transaction rejected");
    });
    const privateStateProvider = {
      get: getPrivateState({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(8),
      }),
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

    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("keeps pending recovery state when active promotion fails after finalization", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(9);
    mockLedgerForRecovery(recoverySecretKey);
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x789" },
    }));
    const privateStateProvider = {
      get: getPrivateState({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(8),
      }),
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
            get: getPrivateState({
              recoverySecretKey: new Uint8Array(32).fill(5),
              secretKey: new Uint8Array(32).fill(4),
            }),
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
      get: getPrivateState({
        recoverySecretKey: new Uint8Array(32).fill(5),
        secretKey: new Uint8Array(32).fill(4),
      }),
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

  it("rejects rotation before authorization when a pending candidate exists", async () => {
    const activeSecretKey = new Uint8Array(32).fill(4);
    const pendingSecretKey = new Uint8Array(32).fill(27);
    const rotateControllerKeyTx = vi.fn();
    const privateStateProvider = {
      get: getPrivateState(
        { secretKey: activeSecretKey },
        { secretKey: pendingSecretKey },
      ),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(28),
      ),
    ).rejects.toMatchObject({
      code: "pendingControllerPrivateStateExists",
      name: "PendingControllerPrivateStateExistsError",
    });

    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
    expect(createControllerAuthorization).not.toHaveBeenCalled();
    expect(rotateControllerKeyTx).not.toHaveBeenCalled();
  });

  it("serializes the pending-slot absence check for overlapping rotations", async () => {
    const activeSecretKey = new Uint8Array(32).fill(4);
    const candidateA = new Uint8Array(32).fill(29);
    const candidateB = new Uint8Array(32).fill(30);
    let pendingPrivateState: { readonly secretKey: Uint8Array } | null = null;
    let releasePendingRead!: () => void;
    const pendingReadGate = new Promise<void>((resolve) => {
      releasePendingRead = resolve;
    });
    let pendingReadStarted!: () => void;
    const pendingReadStart = new Promise<void>((resolve) => {
      pendingReadStarted = resolve;
    });
    let pendingReads = 0;
    const privateStateProvider = {
      get: vi.fn(async (privateStateId: string) => {
        if (privateStateId !== MidnightDIDPendingControllerPrivateStateId) {
          return { secretKey: activeSecretKey };
        }
        pendingReads += 1;
        if (pendingReads === 1) {
          pendingReadStarted();
          await pendingReadGate;
        }
        return pendingPrivateState;
      }),
      set: vi.fn(async (privateStateId: string, privateState: unknown) => {
        if (privateStateId === MidnightDIDPendingControllerPrivateStateId) {
          pendingPrivateState = privateState as {
            readonly secretKey: Uint8Array;
          };
        }
      }),
      remove: vi.fn(async () => undefined),
    };
    const rotateControllerKeyTx = vi.fn(async () => {
      throw new Error("candidate A outcome unknown");
    });
    const didContract = {
      callTx: { rotateControllerKey: rotateControllerKeyTx },
    } as any;
    const providers = { privateStateProvider } as any;

    const operationA = rotateControllerKey(didContract, providers, candidateA);
    await pendingReadStart;
    const operationB = rotateControllerKey(didContract, providers, candidateB);

    await expect(operationB).rejects.toBeInstanceOf(
      PendingControllerPrivateStateExistsError,
    );
    releasePendingRead();
    await expect(operationA).rejects.toThrow(/candidate A outcome unknown/);

    expect(createControllerAuthorization).toHaveBeenCalledTimes(1);
    expect(rotateControllerKeyTx).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(pendingPrivateState).toEqual({ secretKey: candidateA });
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("keeps pending state when transaction outcome is unknown", async () => {
    const rotateControllerKeyTx = vi.fn(async () => {
      throw new Error("transaction rejected");
    });
    const privateStateProvider = {
      get: getPrivateState({
        recoverySecretKey: new Uint8Array(32).fill(5),
        secretKey: new Uint8Array(32).fill(4),
      }),
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

    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("keeps the replacement secret when rotation finalizes but its receipt is lost", async () => {
    const oldSecretKey = new Uint8Array(32).fill(4);
    const newSecretKey = new Uint8Array(32).fill(23);
    let ledgerControllerPublicKey = deriveControllerPublicKey(oldSecretKey);
    const rotateControllerKeyTx = vi.fn(
      async (nextControllerPublicKey: typeof ledgerControllerPublicKey) => {
        ledgerControllerPublicKey = nextControllerPublicKey;
        throw new Error("finality receipt stream disconnected");
      },
    );
    const privateStateProvider = {
      get: getPrivateState({ secretKey: oldSecretKey }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        { callTx: { rotateControllerKey: rotateControllerKeyTx } } as any,
        { privateStateProvider } as any,
        newSecretKey,
      ),
    ).rejects.toThrow(/receipt stream disconnected/);

    expect(ledgerControllerPublicKey).toEqual(
      deriveControllerPublicKey(newSecretKey),
    );
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
      { secretKey: newSecretKey },
    );
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("keeps the replacement secret when recovery finalizes but its receipt is lost", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(24);
    const oldSecretKey = new Uint8Array(32).fill(25);
    const newSecretKey = new Uint8Array(32).fill(26);
    mockLedgerForRecovery(recoverySecretKey);
    let ledgerControllerPublicKey = deriveControllerPublicKey(oldSecretKey);
    const recoverControllerKeyTx = vi.fn(
      async (nextControllerPublicKey: typeof ledgerControllerPublicKey) => {
        ledgerControllerPublicKey = nextControllerPublicKey;
        throw new Error("finality receipt stream disconnected");
      },
    );
    const privateStateProvider = {
      get: getPrivateState({ recoverySecretKey, secretKey: oldSecretKey }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        { callTx: { recoverControllerKey: recoverControllerKeyTx } } as any,
        { privateStateProvider } as any,
        newSecretKey,
      ),
    ).rejects.toThrow(/receipt stream disconnected/);

    expect(ledgerControllerPublicKey).toEqual(
      deriveControllerPublicKey(newSecretKey),
    );
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
      { recoverySecretKey, secretKey: newSecretKey },
    );
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("keeps pending state when active promotion fails after finalization", async () => {
    const rotateControllerKeyTx = vi.fn(async () => ({
      public: { txId: "0x123" },
    }));
    const privateStateProvider = {
      get: getPrivateState({
        recoverySecretKey: new Uint8Array(32).fill(5),
        secretKey: new Uint8Array(32).fill(4),
      }),
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
