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

import { setLogger } from "../api-logger.js";
import { createControllerAuthorization } from "../controller-authorization.js";
import {
  recoverControllerKey,
  rotateControllerKey,
} from "../controller-operations.js";
import { requireDeployedMidnightDIDLedgerState } from "../ledger-state.js";
import {
  bindPrivateStateProvider,
  discardPendingControllerPrivateState,
  PendingControllerPrivateStateBusyError,
  PendingControllerPrivateStateExistsError,
  PendingControllerPrivateStateUnavailableError,
  recoverPendingControllerPrivateState,
} from "../private-state.js";
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

const makeLogger = () =>
  ({
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  }) as any;

describe("controller operations", () => {
  const contractAddress = "A".repeat(64);
  beforeEach(() => {
    vi.clearAllMocks();
    setLogger(makeLogger());
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
      setContractAddress: vi.fn(),
      get: getPrivateState({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(98),
      }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    const result = await rotateControllerKey(
      {
        deployTxData: { public: { contractAddress } },
        callTx: { rotateControllerKey: rotateControllerKeyTx },
      } as any,
      { privateStateProvider } as any,
      newSecretKey,
    );

    expect(rotateControllerKeyTx).toHaveBeenCalledWith(
      deriveControllerPublicKey(newSecretKey),
      { announcement: { x: 1n, y: 2n }, response: 3n },
      7n,
    );
    expect(vi.mocked(createControllerAuthorization).mock.calls[0]?.[4]).toEqual(
      {
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(98),
      },
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
      setContractAddress: vi.fn(),
      get: getPrivateState({ secretKey: new Uint8Array(32).fill(4) }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(8),
      }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    const result = await recoverControllerKey(
      {
        deployTxData: { public: { contractAddress } },
        callTx: { recoverControllerKey: recoverControllerKeyTx },
      } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState({ recoverySecretKey }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState(null),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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

  it("snapshots inputs once and runs independent recovery preflight reads in parallel under the lease", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(64);
    const expectedRecoverySecretKey = new Uint8Array(recoverySecretKey);
    const newSecretKey = new Uint8Array(32).fill(65);
    const expectedNewSecretKey = new Uint8Array(newSecretKey);
    let releasePrivateStateRead!: (privateState: unknown) => void;
    const privateStateReadGate = new Promise<unknown>((resolve) => {
      releasePrivateStateRead = resolve;
    });
    let privateStateReadStarted = false;
    let releaseLedgerRead!: (ledgerState: unknown) => void;
    const ledgerReadGate = new Promise<unknown>((resolve) => {
      releaseLedgerRead = resolve;
    });
    let ledgerReadStarted = false;
    vi.mocked(requireDeployedMidnightDIDLedgerState).mockImplementationOnce(
      async () => {
        ledgerReadStarted = true;
        return (await ledgerReadGate) as any;
      },
    );
    const recoverControllerKeyTx = vi.fn(async () => ({
      public: { txId: "parallel-preflight" },
    }));
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async (privateStateId: string) => {
        if (privateStateId === MidnightDIDPrivateStateId) {
          privateStateReadStarted = true;
          return privateStateReadGate;
        }
        return null;
      }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };
    const providers = { privateStateProvider } as any;
    const didContract = {
      deployTxData: { public: { contractAddress } },
      callTx: { recoverControllerKey: recoverControllerKeyTx },
    } as any;

    const recovery = recoverControllerKey(
      didContract,
      providers,
      newSecretKey,
      recoverySecretKey,
    );

    await vi.waitFor(() => {
      expect(privateStateReadStarted).toBe(true);
      expect(ledgerReadStarted).toBe(true);
    });
    await expect(
      discardPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: false,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);

    newSecretKey.fill(1);
    recoverySecretKey.fill(2);
    releasePrivateStateRead(null);
    releaseLedgerRead({
      id: { bytes: new Uint8Array(32).fill(1) },
      recoveryAuthorityPublicKey: deriveControllerPublicKey(
        expectedRecoverySecretKey,
      ),
      version: 7n,
    });
    await expect(recovery).resolves.toEqual({ txId: "parallel-preflight" });
    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      1,
      MidnightDIDPendingControllerPrivateStateId,
      { secretKey: expectedNewSecretKey },
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
      setContractAddress: vi.fn(),
      get: getPrivateState({ recoverySecretKey: storedRecoverySecretKey }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };

    await expect(
      recoverControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState({
        recoverySecretKey: new Uint8Array(32).fill(20),
      }),
      set: vi.fn(),
      remove: vi.fn(),
    };

    await expect(
      recoverControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState({ recoverySecretKey: storedRecoverySecretKey }),
      set: vi.fn(),
      remove: vi.fn(),
    };

    await expect(
      recoverControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
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
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
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
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState({
        recoverySecretKey,
        secretKey: new Uint8Array(32).fill(8),
      }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
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
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
        {
          privateStateProvider: {
            setContractAddress: vi.fn(),
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

  it.each(["rotation", "recovery"] as const)(
    "rejects %s for a known provider contract mismatch before reads or calls",
    async (operation) => {
      const boundContractAddress = "B".repeat(64);
      const privateStateProvider = {
        setContractAddress: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      };
      const providers = { privateStateProvider } as any;
      bindPrivateStateProvider(providers, boundContractAddress);
      vi.clearAllMocks();
      const rotateControllerKeyTx = vi.fn();
      const recoverControllerKeyTx = vi.fn();
      const didContract = {
        deployTxData: { public: { contractAddress } },
        callTx: {
          recoverControllerKey: recoverControllerKeyTx,
          rotateControllerKey: rotateControllerKeyTx,
        },
      } as any;

      const result =
        operation === "rotation"
          ? rotateControllerKey(didContract, providers, new Uint8Array(32))
          : recoverControllerKey(
              didContract,
              providers,
              new Uint8Array(32),
              new Uint8Array(32),
            );

      await expect(result).rejects.toMatchObject({
        code: "private_state_provider_contract_mismatch",
        expectedContractAddress: contractAddress.toLowerCase(),
        actualContractAddress: boundContractAddress.toLowerCase(),
      });
      expect(privateStateProvider.setContractAddress).not.toHaveBeenCalled();
      expect(privateStateProvider.get).not.toHaveBeenCalled();
      expect(privateStateProvider.set).not.toHaveBeenCalled();
      expect(privateStateProvider.remove).not.toHaveBeenCalled();
      expect(requireDeployedMidnightDIDLedgerState).not.toHaveBeenCalled();
      expect(createControllerAuthorization).not.toHaveBeenCalled();
      expect(rotateControllerKeyTx).not.toHaveBeenCalled();
      expect(recoverControllerKeyTx).not.toHaveBeenCalled();
    },
  );

  it("rejects before submitting a transaction if pending state cannot be saved", async () => {
    const rotateControllerKeyTx = vi.fn();
    const privateStateProvider = {
      setContractAddress: vi.fn(),
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
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState(
        { secretKey: activeSecretKey },
        { secretKey: pendingSecretKey },
      ),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(28),
      ),
    ).rejects.toMatchObject({
      code: "pending_controller_private_state_exists",
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
      setContractAddress: vi.fn(),
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
      deployTxData: { public: { contractAddress } },
      callTx: { rotateControllerKey: rotateControllerKeyTx },
    } as any;
    const providers = { privateStateProvider } as any;

    const operationA = rotateControllerKey(didContract, providers, candidateA);
    await pendingReadStart;
    const operationB = rotateControllerKey(didContract, providers, candidateB);

    await expect(operationB).rejects.toBeInstanceOf(
      PendingControllerPrivateStateBusyError,
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
      setContractAddress: vi.fn(),
      get: getPrivateState({
        recoverySecretKey: new Uint8Array(32).fill(5),
        secretKey: new Uint8Array(32).fill(4),
      }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState({ secretKey: oldSecretKey }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
      get: getPrivateState({ recoverySecretKey, secretKey: oldSecretKey }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      recoverControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { recoverControllerKey: recoverControllerKeyTx },
        } as any,
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
      setContractAddress: vi.fn(),
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
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(3),
      ),
    ).rejects.toThrow(/active write failed/);

    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("discards a malformed pending record after explicit non-finalization confirmation", async () => {
    const malformedPendingPrivateState = { secretKey: new Uint8Array(31) };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: getPrivateState(null, malformedPendingPrivateState),
      set: vi.fn(),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      discardPendingControllerPrivateState({ privateStateProvider } as any, {
        contractAddress,
        rotationFinalized: false,
      }),
    ).resolves.toBeUndefined();

    expect(privateStateProvider.get).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
  });

  it("rejects absent pending discard with the typed unavailable error without mutation", async () => {
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: getPrivateState(null),
      set: vi.fn(),
      remove: vi.fn(),
    };

    await expect(
      discardPendingControllerPrivateState({ privateStateProvider } as any, {
        contractAddress,
        rotationFinalized: false,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateUnavailableError);

    expect(privateStateProvider.get).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["malformed", { secretKey: new Uint8Array(31) }],
  ])(
    "rejects %s pending recovery with the typed unavailable error without mutation",
    async (_description, pendingPrivateState) => {
      const privateStateProvider = {
        setContractAddress: vi.fn(),
        get: getPrivateState(null, pendingPrivateState),
        set: vi.fn(),
        remove: vi.fn(),
      };

      await expect(
        recoverPendingControllerPrivateState({ privateStateProvider } as any, {
          contractAddress,
          rotationFinalized: true,
        }),
      ).rejects.toBeInstanceOf(PendingControllerPrivateStateUnavailableError);

      expect(privateStateProvider.get).toHaveBeenCalledTimes(1);
      expect(privateStateProvider.set).not.toHaveBeenCalled();
      expect(privateStateProvider.remove).not.toHaveBeenCalled();
    },
  );

  it("returns promoted pending state when failed cleanup retains it", async () => {
    const logger = makeLogger();
    setLogger(logger);
    const pendingPrivateState = {
      recoverySecretKey: new Uint8Array(32).fill(54),
      secretKey: new Uint8Array(32).fill(55),
    };
    const cleanupError = new Error("pending cleanup offline");
    let activePrivateState: unknown = null;
    let retainedPendingPrivateState: unknown = pendingPrivateState;
    let removeAttempts = 0;
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async (privateStateId: string) =>
        privateStateId === MidnightDIDPendingControllerPrivateStateId
          ? retainedPendingPrivateState
          : activePrivateState,
      ),
      set: vi.fn(async (privateStateId: string, privateState: unknown) => {
        if (privateStateId === MidnightDIDPrivateStateId) {
          activePrivateState = privateState;
        }
      }),
      remove: vi.fn(async () => {
        removeAttempts += 1;
        if (removeAttempts === 1) throw cleanupError;
        retainedPendingPrivateState = null;
      }),
    };
    const providers = { privateStateProvider } as any;

    await expect(
      recoverPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: true,
      }),
    ).resolves.toBe(pendingPrivateState);

    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
      pendingPrivateState,
    );
    expect(privateStateProvider.remove).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { error: cleanupError },
      "Pending controller private state was promoted, but cleanup disposition could not be confirmed; the pending record may remain or may already have been removed.",
    );
    expect(activePrivateState).toBe(pendingPrivateState);
    expect(retainedPendingPrivateState).toBe(pendingPrivateState);

    await expect(
      recoverPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: true,
      }),
    ).resolves.toBe(pendingPrivateState);

    expect(privateStateProvider.set).toHaveBeenCalledTimes(2);
    expect(privateStateProvider.set).toHaveBeenNthCalledWith(
      2,
      MidnightDIDPrivateStateId,
      pendingPrivateState,
    );
    expect(privateStateProvider.remove).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(activePrivateState).toBe(pendingPrivateState);
    expect(retainedPendingPrivateState).toBeNull();
  });

  it("returns promoted state when failed manual cleanup deleted the pending record", async () => {
    const logger = makeLogger();
    setLogger(logger);
    const pendingPrivateState = {
      recoverySecretKey: new Uint8Array(32).fill(60),
      secretKey: new Uint8Array(32).fill(61),
    };
    let activePrivateState: unknown = null;
    let pending: unknown = pendingPrivateState;
    const cleanupError = new Error(
      "delete committed before acknowledgement failed",
    );
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async (privateStateId: string) =>
        privateStateId === MidnightDIDPendingControllerPrivateStateId
          ? pending
          : activePrivateState,
      ),
      set: vi.fn(async (privateStateId: string, privateState: unknown) => {
        if (privateStateId === MidnightDIDPrivateStateId) {
          activePrivateState = privateState;
        }
      }),
      remove: vi.fn(async () => {
        pending = null;
        throw cleanupError;
      }),
    };
    const providers = { privateStateProvider } as any;

    await expect(
      recoverPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: true,
      }),
    ).resolves.toBe(pendingPrivateState);

    expect(activePrivateState).toBe(pendingPrivateState);
    expect(logger.warn).toHaveBeenCalledWith(
      { error: cleanupError },
      expect.stringMatching(/may remain or may already have been removed/),
    );
    await expect(
      recoverPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: true,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateUnavailableError);
  });

  it.each([
    ["retained", false],
    ["deleted", true],
  ] as const)(
    "succeeds after finalized rotation when failed cleanup leaves state %s",
    async (_outcome, deleteBeforeReject) => {
      const logger = makeLogger();
      setLogger(logger);
      const oldPrivateState = { secretKey: new Uint8Array(32).fill(62) };
      const nextSecretKey = new Uint8Array(32).fill(63);
      let activePrivateState: unknown = oldPrivateState;
      let pendingPrivateState: unknown = null;
      let removeAttempts = 0;
      const cleanupError = new Error("cleanup acknowledgement unavailable");
      const privateStateProvider = {
        setContractAddress: vi.fn(),
        get: vi.fn(async (privateStateId: string) =>
          privateStateId === MidnightDIDPendingControllerPrivateStateId
            ? pendingPrivateState
            : activePrivateState,
        ),
        set: vi.fn(async (privateStateId: string, privateState: unknown) => {
          if (privateStateId === MidnightDIDPendingControllerPrivateStateId) {
            pendingPrivateState = privateState;
          } else {
            activePrivateState = privateState;
          }
        }),
        remove: vi.fn(async () => {
          removeAttempts += 1;
          if (removeAttempts === 1) {
            if (deleteBeforeReject) pendingPrivateState = null;
            throw cleanupError;
          }
          pendingPrivateState = null;
        }),
      };
      const providers = { privateStateProvider } as any;
      const rotateControllerKeyTx = vi.fn(async () => ({
        public: { txId: "cleanup-uncertain" },
      }));
      const didContract = {
        deployTxData: { public: { contractAddress } },
        callTx: { rotateControllerKey: rotateControllerKeyTx },
      } as any;

      await expect(
        rotateControllerKey(didContract, providers, nextSecretKey),
      ).resolves.toEqual({ txId: "cleanup-uncertain" });

      expect(activePrivateState).toEqual({ secretKey: nextSecretKey });
      expect(logger.warn).toHaveBeenCalledWith(
        { error: cleanupError },
        expect.stringMatching(/may remain or may already have been removed/),
      );
      const reconciliation = recoverPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: true,
      });
      if (deleteBeforeReject) {
        await expect(reconciliation).rejects.toBeInstanceOf(
          PendingControllerPrivateStateUnavailableError,
        );
      } else {
        await expect(reconciliation).resolves.toEqual({
          secretKey: nextSecretKey,
        });
      }
    },
  );

  it("categorizes authorization failure as pre-call and removes the unsubmitted candidate", async () => {
    const logger = makeLogger();
    setLogger(logger);
    const authorizationError = new Error("authorization unavailable");
    vi.mocked(createControllerAuthorization).mockRejectedValueOnce(
      authorizationError,
    );
    const rotateControllerKeyTx = vi.fn();
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: getPrivateState({ secretKey: new Uint8Array(32).fill(4) }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(40),
      ),
    ).rejects.toBe(authorizationError);

    expect(logger.warn).toHaveBeenCalledWith(
      { callAttempted: false, error: authorizationError },
      expect.stringMatching(/before the transaction call was attempted/),
    );
    expect(rotateControllerKeyTx).not.toHaveBeenCalled();
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
  });

  it.each([
    ["retained", false],
    ["deleted", true],
  ] as const)(
    "keeps truthful pre-call cleanup guidance when the candidate was %s before remove rejected",
    async (_outcome, deleteBeforeReject) => {
      const logger = makeLogger();
      setLogger(logger);
      const authorizationError = new Error("authorization unavailable");
      const cleanupError = new Error("remove acknowledgement unavailable");
      const candidate = new Uint8Array(32).fill(42);
      let pending: unknown = null;
      vi.mocked(createControllerAuthorization).mockRejectedValueOnce(
        authorizationError,
      );
      const rotateControllerKeyTx = vi.fn();
      const privateStateProvider = {
        setContractAddress: vi.fn(),
        get: vi.fn(async (privateStateId: string) =>
          privateStateId === MidnightDIDPendingControllerPrivateStateId
            ? pending
            : { secretKey: new Uint8Array(32).fill(4) },
        ),
        set: vi.fn(async (privateStateId: string, privateState: unknown) => {
          if (privateStateId === MidnightDIDPendingControllerPrivateStateId) {
            pending = privateState;
          }
        }),
        remove: vi.fn(async () => {
          if (deleteBeforeReject) pending = null;
          throw cleanupError;
        }),
      };

      await expect(
        rotateControllerKey(
          {
            deployTxData: { public: { contractAddress } },
            callTx: { rotateControllerKey: rotateControllerKeyTx },
          } as any,
          { privateStateProvider } as any,
          candidate,
        ),
      ).rejects.toBe(authorizationError);

      expect(rotateControllerKeyTx).not.toHaveBeenCalled();
      expect(privateStateProvider.remove).toHaveBeenCalledWith(
        MidnightDIDPendingControllerPrivateStateId,
      );
      expect(pending).toEqual(
        deleteBeforeReject ? null : { secretKey: candidate },
      );
      expect(logger.warn).toHaveBeenCalledWith(
        { callAttempted: false, cleanupError, error: authorizationError },
        expect.stringMatching(
          /cleanup disposition could not be confirmed.*discard it with discardPendingControllerPrivateState/,
        ),
      );
    },
  );

  it("categorizes a synchronous callTx throw as an attempted call and retains the candidate", async () => {
    const logger = makeLogger();
    setLogger(logger);
    const callError = new Error("synchronous call failure");
    const rotateControllerKeyTx = vi.fn(() => {
      throw callError;
    });
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: getPrivateState({ secretKey: new Uint8Array(32).fill(4) }),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      rotateControllerKey(
        {
          deployTxData: { public: { contractAddress } },
          callTx: { rotateControllerKey: rotateControllerKeyTx },
        } as any,
        { privateStateProvider } as any,
        new Uint8Array(32).fill(41),
      ),
    ).rejects.toBe(callError);

    expect(logger.warn).toHaveBeenCalledWith(
      { callAttempted: true, error: callError },
      expect.stringMatching(/call was attempted/),
    );
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("rejects competing rotate, recover, and discard immediately while the owner remains unresolved", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(66);
    const activePrivateState = {
      recoverySecretKey,
      secretKey: new Uint8Array(32).fill(67),
    };
    const ownerCandidate = new Uint8Array(32).fill(68);
    let pending: unknown = null;
    let ownerCallStarted!: () => void;
    const ownerCallStart = new Promise<void>((resolve) => {
      ownerCallStarted = resolve;
    });
    let releaseOwnerCall!: () => void;
    const ownerCallGate = new Promise<void>((resolve) => {
      releaseOwnerCall = resolve;
    });
    let ownerSettled = false;
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async (privateStateId: string) =>
        privateStateId === MidnightDIDPendingControllerPrivateStateId
          ? pending
          : activePrivateState,
      ),
      set: vi.fn(async (privateStateId: string, privateState: unknown) => {
        if (privateStateId === MidnightDIDPendingControllerPrivateStateId) {
          pending = privateState;
        }
      }),
      remove: vi.fn(async () => {
        pending = null;
      }),
    };
    const rotateControllerKeyTx = vi.fn(async () => {
      ownerCallStarted();
      await ownerCallGate;
      throw new Error("owner outcome unknown");
    });
    const didContract = {
      deployTxData: { public: { contractAddress } },
      callTx: {
        recoverControllerKey: vi.fn(),
        rotateControllerKey: rotateControllerKeyTx,
      },
    } as any;
    const providers = { privateStateProvider } as any;
    const owner = rotateControllerKey(
      didContract,
      providers,
      ownerCandidate,
    ).finally(() => {
      ownerSettled = true;
    });
    await ownerCallStart;
    const readsBeforeCompetition = privateStateProvider.get.mock.calls.length;
    const writesBeforeCompetition = privateStateProvider.set.mock.calls.length;

    const competitors = [
      rotateControllerKey(didContract, providers, new Uint8Array(32).fill(69)),
      recoverControllerKey(
        didContract,
        providers,
        new Uint8Array(32).fill(70),
        recoverySecretKey,
      ),
      discardPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: false,
      }),
    ];
    await Promise.all(
      competitors.map((competitor) =>
        expect(competitor).rejects.toBeInstanceOf(
          PendingControllerPrivateStateBusyError,
        ),
      ),
    );

    expect(ownerSettled).toBe(false);
    expect(privateStateProvider.get).toHaveBeenCalledTimes(
      readsBeforeCompetition,
    );
    expect(privateStateProvider.set).toHaveBeenCalledTimes(
      writesBeforeCompetition,
    );
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
    expect(pending).toEqual({
      recoverySecretKey,
      secretKey: ownerCandidate,
    });

    releaseOwnerCall();
    await expect(owner).rejects.toThrow("owner outcome unknown");
    await expect(
      discardPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: false,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects concurrent discard while rotation is in flight without changing candidate A", async () => {
    const activePrivateState = { secretKey: new Uint8Array(32).fill(42) };
    const candidateA = new Uint8Array(32).fill(43);
    let active: unknown = activePrivateState;
    let pending: unknown = null;
    let callStarted!: () => void;
    const callStart = new Promise<void>((resolve) => {
      callStarted = resolve;
    });
    let releaseCall!: () => void;
    const callGate = new Promise<void>((resolve) => {
      releaseCall = resolve;
    });
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async (privateStateId: string) =>
        privateStateId === MidnightDIDPendingControllerPrivateStateId
          ? pending
          : active,
      ),
      set: vi.fn(async (privateStateId: string, privateState: unknown) => {
        if (privateStateId === MidnightDIDPendingControllerPrivateStateId) {
          pending = privateState;
        } else {
          active = privateState;
        }
      }),
      remove: vi.fn(async () => {
        pending = null;
      }),
    };
    const rotateControllerKeyTx = vi.fn(async () => {
      callStarted();
      await callGate;
      throw new Error("rotation outcome unknown");
    });
    const providers = { privateStateProvider } as any;

    const rotation = rotateControllerKey(
      {
        deployTxData: { public: { contractAddress } },
        callTx: { rotateControllerKey: rotateControllerKeyTx },
      } as any,
      providers,
      candidateA,
    );
    await callStart;

    await expect(
      discardPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: false,
      }),
    ).rejects.toMatchObject({
      code: "pending_controller_private_state_busy",
      name: "PendingControllerPrivateStateBusyError",
    });
    expect(pending).toEqual({ secretKey: candidateA });
    expect(active).toBe(activePrivateState);
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.remove).not.toHaveBeenCalled();

    releaseCall();
    await expect(rotation).rejects.toThrow(/rotation outcome unknown/);
    expect(pending).toEqual({ secretKey: candidateA });
    expect(active).toBe(activePrivateState);
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("rejects concurrent pending recovery while controller recovery is in flight without promoting candidate A", async () => {
    const recoverySecretKey = new Uint8Array(32).fill(44);
    const activePrivateState = {
      recoverySecretKey,
      secretKey: new Uint8Array(32).fill(45),
    };
    const candidateA = new Uint8Array(32).fill(46);
    mockLedgerForRecovery(recoverySecretKey);
    let active: unknown = activePrivateState;
    let pending: unknown = null;
    let callStarted!: () => void;
    const callStart = new Promise<void>((resolve) => {
      callStarted = resolve;
    });
    let releaseCall!: () => void;
    const callGate = new Promise<void>((resolve) => {
      releaseCall = resolve;
    });
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async (privateStateId: string) =>
        privateStateId === MidnightDIDPendingControllerPrivateStateId
          ? pending
          : active,
      ),
      set: vi.fn(async (privateStateId: string, privateState: unknown) => {
        if (privateStateId === MidnightDIDPendingControllerPrivateStateId) {
          pending = privateState;
        } else {
          active = privateState;
        }
      }),
      remove: vi.fn(async () => {
        pending = null;
      }),
    };
    const recoverControllerKeyTx = vi.fn(async () => {
      callStarted();
      await callGate;
      throw new Error("recovery outcome unknown");
    });
    const providers = { privateStateProvider } as any;

    const recovery = recoverControllerKey(
      {
        deployTxData: { public: { contractAddress } },
        callTx: { recoverControllerKey: recoverControllerKeyTx },
      } as any,
      providers,
      candidateA,
    );
    await callStart;

    await expect(
      recoverPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: true,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    expect(pending).toEqual({ recoverySecretKey, secretKey: candidateA });
    expect(active).toBe(activePrivateState);
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.remove).not.toHaveBeenCalled();

    releaseCall();
    await expect(recovery).rejects.toThrow(/recovery outcome unknown/);
    expect(pending).toEqual({ recoverySecretKey, secretKey: candidateA });
    expect(active).toBe(activePrivateState);
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("reserves the provider before rotation active-state preflight and releases it on failure", async () => {
    const contractAddressA = "a".repeat(64);
    const contractAddressB = "b".repeat(64);
    const preflightError = new Error("active state unavailable");
    let activeReadStarted!: () => void;
    const activeReadStart = new Promise<void>((resolve) => {
      activeReadStarted = resolve;
    });
    let releaseActiveRead!: () => void;
    const activeReadGate = new Promise<void>((resolve) => {
      releaseActiveRead = resolve;
    });
    const makeWrapper = (deferActiveRead = false) => {
      let contractAddress: string | undefined;
      return {
        get contractAddress() {
          return contractAddress;
        },
        get: vi.fn(async (privateStateId: string) => {
          if (deferActiveRead && privateStateId === MidnightDIDPrivateStateId) {
            activeReadStarted();
            await activeReadGate;
            throw preflightError;
          }
          return null;
        }),
        remove: vi.fn(),
        set: vi.fn(),
        setContractAddress: vi.fn((nextContractAddress: string) => {
          contractAddress = nextContractAddress;
        }),
      };
    };
    const wrapperA = makeWrapper(true);
    const wrapperB = makeWrapper();
    const providersA = { privateStateProvider: wrapperA } as any;
    const providersB = { privateStateProvider: wrapperB } as any;
    bindPrivateStateProvider(providersA, contractAddressA);
    bindPrivateStateProvider(providersB, contractAddressB);
    const rotateControllerKeyTx = vi.fn();

    const rotation = rotateControllerKey(
      {
        deployTxData: { public: { contractAddress: contractAddressA } },
        callTx: { rotateControllerKey: rotateControllerKeyTx },
      } as any,
      providersA,
      new Uint8Array(32).fill(56),
    );
    await activeReadStart;

    expect(() =>
      bindPrivateStateProvider(providersA, contractAddressB),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(() =>
      bindPrivateStateProvider(providersB, contractAddressA),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(wrapperA.contractAddress).toBe(contractAddressA);
    expect(wrapperB.contractAddress).toBe(contractAddressB);
    expect(wrapperA.setContractAddress).toHaveBeenCalledTimes(1);
    expect(wrapperB.setContractAddress).toHaveBeenCalledTimes(1);
    expect(wrapperA.set).not.toHaveBeenCalled();
    expect(wrapperA.remove).not.toHaveBeenCalled();
    expect(createControllerAuthorization).not.toHaveBeenCalled();
    expect(rotateControllerKeyTx).not.toHaveBeenCalled();

    releaseActiveRead();
    await expect(rotation).rejects.toBe(preflightError);

    expect(() =>
      bindPrivateStateProvider(providersA, contractAddressB),
    ).not.toThrow();
    expect(() =>
      bindPrivateStateProvider(providersB, contractAddressA),
    ).not.toThrow();
    expect(wrapperA.contractAddress).toBe(contractAddressB);
    expect(wrapperB.contractAddress).toBe(contractAddressA);
  });

  it("reserves the provider during recovery ledger preflight and releases it on failure", async () => {
    const contractAddressA = "c".repeat(64);
    const contractAddressB = "d".repeat(64);
    const recoverySecretKey = new Uint8Array(32).fill(57);
    const preflightError = new Error("ledger state unavailable");
    let ledgerReadStarted!: () => void;
    const ledgerReadStart = new Promise<void>((resolve) => {
      ledgerReadStarted = resolve;
    });
    let releaseLedgerRead!: () => void;
    const ledgerReadGate = new Promise<void>((resolve) => {
      releaseLedgerRead = resolve;
    });
    vi.mocked(requireDeployedMidnightDIDLedgerState).mockImplementationOnce(
      async () => {
        ledgerReadStarted();
        await ledgerReadGate;
        throw preflightError;
      },
    );
    const makeWrapper = (activePrivateState: unknown = null) => {
      let contractAddress: string | undefined;
      return {
        get contractAddress() {
          return contractAddress;
        },
        get: vi.fn(async (privateStateId: string) =>
          privateStateId === MidnightDIDPrivateStateId
            ? activePrivateState
            : null,
        ),
        remove: vi.fn(),
        set: vi.fn(),
        setContractAddress: vi.fn((nextContractAddress: string) => {
          contractAddress = nextContractAddress;
        }),
      };
    };
    const wrapperA = makeWrapper({ recoverySecretKey });
    const wrapperB = makeWrapper();
    const providersA = { privateStateProvider: wrapperA } as any;
    const providersB = { privateStateProvider: wrapperB } as any;
    bindPrivateStateProvider(providersA, contractAddressA);
    bindPrivateStateProvider(providersB, contractAddressB);
    const recoverControllerKeyTx = vi.fn();

    const recovery = recoverControllerKey(
      {
        deployTxData: { public: { contractAddress: contractAddressA } },
        callTx: { recoverControllerKey: recoverControllerKeyTx },
      } as any,
      providersA,
      new Uint8Array(32).fill(58),
    );
    await ledgerReadStart;

    expect(() =>
      bindPrivateStateProvider(providersA, contractAddressB),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(() =>
      bindPrivateStateProvider(providersB, contractAddressA),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(wrapperA.contractAddress).toBe(contractAddressA);
    expect(wrapperB.contractAddress).toBe(contractAddressB);
    expect(wrapperA.setContractAddress).toHaveBeenCalledTimes(1);
    expect(wrapperB.setContractAddress).toHaveBeenCalledTimes(1);
    expect(wrapperA.set).not.toHaveBeenCalled();
    expect(wrapperA.remove).not.toHaveBeenCalled();
    expect(recoverControllerKeyTx).not.toHaveBeenCalled();

    releaseLedgerRead();
    await expect(recovery).rejects.toBe(preflightError);

    expect(() =>
      bindPrivateStateProvider(providersA, contractAddressB),
    ).not.toThrow();
    expect(() =>
      bindPrivateStateProvider(providersB, contractAddressA),
    ).not.toThrow();
    expect(wrapperA.contractAddress).toBe(contractAddressB);
    expect(wrapperB.contractAddress).toBe(contractAddressA);
  });

  it("rejects provider rebinding while an ambiguous rotation owns either address lock", async () => {
    const contractAddressA = "a".repeat(64);
    const contractAddressB = "b".repeat(64);
    const activeA = { secretKey: new Uint8Array(32).fill(50) };
    const activeB = { secretKey: new Uint8Array(32).fill(51) };
    const pendingB = { secretKey: new Uint8Array(32).fill(52) };
    const candidateA = new Uint8Array(32).fill(53);
    const stateByAddress = new Map([
      [
        contractAddressA,
        { active: activeA as unknown, pending: null as unknown },
      ],
      [
        contractAddressB,
        { active: activeB as unknown, pending: pendingB as unknown },
      ],
    ]);

    const makeAddressScopedWrapper = (initialAddress?: string) => {
      let contractAddress = initialAddress;
      const setContractAddress = vi.fn((nextContractAddress: string) => {
        contractAddress = nextContractAddress;
      });
      return {
        get contractAddress() {
          return contractAddress;
        },
        get: vi.fn(async (privateStateId: string) => {
          const state = stateByAddress.get(contractAddress ?? "");
          if (state === undefined) throw new Error("Contract address not set");
          return privateStateId === MidnightDIDPendingControllerPrivateStateId
            ? state.pending
            : state.active;
        }),
        remove: vi.fn(async () => {
          const state = stateByAddress.get(contractAddress ?? "");
          if (state === undefined) throw new Error("Contract address not set");
          state.pending = null;
        }),
        set: vi.fn(async (privateStateId: string, privateState: unknown) => {
          const state = stateByAddress.get(contractAddress ?? "");
          if (state === undefined) throw new Error("Contract address not set");
          if (privateStateId === MidnightDIDPendingControllerPrivateStateId) {
            state.pending = privateState;
          } else {
            state.active = privateState;
          }
        }),
        setContractAddress,
      };
    };

    const wrapperA = makeAddressScopedWrapper();
    const wrapperB = makeAddressScopedWrapper(contractAddressB);
    const providersA = { privateStateProvider: wrapperA } as any;
    const providersB = { privateStateProvider: wrapperB } as any;
    bindPrivateStateProvider(providersA, contractAddressA);
    bindPrivateStateProvider(providersB, contractAddressB);

    let callStarted!: () => void;
    const callStart = new Promise<void>((resolve) => {
      callStarted = resolve;
    });
    let releaseCall!: () => void;
    const callGate = new Promise<void>((resolve) => {
      releaseCall = resolve;
    });
    const rotateControllerKeyTx = vi.fn(async () => {
      callStarted();
      await callGate;
      throw new Error("DID A rotation outcome unknown");
    });
    const rotation = rotateControllerKey(
      {
        deployTxData: { public: { contractAddress: contractAddressA } },
        callTx: { rotateControllerKey: rotateControllerKeyTx },
      } as any,
      providersA,
      candidateA,
    );
    await callStart;

    expect(() =>
      bindPrivateStateProvider(providersA, contractAddressB),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(() =>
      bindPrivateStateProvider(providersA, contractAddressA),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(() =>
      bindPrivateStateProvider(providersB, contractAddressA),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(wrapperA.setContractAddress).toHaveBeenCalledTimes(1);
    expect(wrapperA.setContractAddress).not.toHaveBeenCalledWith(
      contractAddressB,
    );
    expect(wrapperB.setContractAddress).toHaveBeenCalledTimes(1);
    expect(wrapperA.contractAddress).toBe(contractAddressA);
    expect(wrapperB.contractAddress).toBe(contractAddressB);
    await expect(
      discardPendingControllerPrivateState(providersA, {
        contractAddress: contractAddressA,
        rotationFinalized: false,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    expect(stateByAddress.get(contractAddressA)).toEqual({
      active: activeA,
      pending: { secretKey: candidateA },
    });
    expect(stateByAddress.get(contractAddressB)).toEqual({
      active: activeB,
      pending: pendingB,
    });
    expect(wrapperA.set).toHaveBeenCalledTimes(1);
    expect(wrapperA.remove).not.toHaveBeenCalled();

    releaseCall();
    await expect(rotation).rejects.toThrow(/DID A rotation outcome unknown/);
    expect(wrapperA.contractAddress).toBe(contractAddressA);
    expect(stateByAddress.get(contractAddressA)).toEqual({
      active: activeA,
      pending: { secretKey: candidateA },
    });
    expect(stateByAddress.get(contractAddressB)).toEqual({
      active: activeB,
      pending: pendingB,
    });
    expect(wrapperA.set).toHaveBeenCalledTimes(1);
    expect(wrapperA.remove).not.toHaveBeenCalled();
  });

  it("uses one process-local lock for two wrappers bound to the same contract", async () => {
    const activePrivateState = { secretKey: new Uint8Array(32).fill(47) };
    const candidateA = new Uint8Array(32).fill(48);
    const candidateB = new Uint8Array(32).fill(49);
    let active: unknown = activePrivateState;
    let pending: unknown = null;
    const makeWrapper = () => ({
      get: vi.fn(async (privateStateId: string) =>
        privateStateId === MidnightDIDPendingControllerPrivateStateId
          ? pending
          : active,
      ),
      remove: vi.fn(async () => {
        pending = null;
      }),
      set: vi.fn(async (privateStateId: string, privateState: unknown) => {
        if (privateStateId === MidnightDIDPendingControllerPrivateStateId) {
          pending = privateState;
        } else {
          active = privateState;
        }
      }),
      setContractAddress: vi.fn(),
    });
    const wrapperA = makeWrapper();
    const wrapperB = makeWrapper();
    const providersA = { privateStateProvider: wrapperA } as any;
    const providersB = { privateStateProvider: wrapperB } as any;
    const contractAddress = "a".repeat(64);
    bindPrivateStateProvider(providersA, contractAddress);
    bindPrivateStateProvider(providersB, contractAddress);
    let callStarted!: () => void;
    const callStart = new Promise<void>((resolve) => {
      callStarted = resolve;
    });
    let releaseCall!: () => void;
    const callGate = new Promise<void>((resolve) => {
      releaseCall = resolve;
    });
    const rotateControllerKeyTx = vi.fn(async () => {
      callStarted();
      await callGate;
      throw new Error("wrapper A outcome unknown");
    });
    const didContract = {
      deployTxData: { public: { contractAddress } },
      callTx: { rotateControllerKey: rotateControllerKeyTx },
    } as any;

    const operationA = rotateControllerKey(didContract, providersA, candidateA);
    await callStart;

    await expect(
      rotateControllerKey(didContract, providersB, candidateB),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    expect(pending).toEqual({ secretKey: candidateA });
    expect(active).toBe(activePrivateState);
    expect(wrapperB.set).not.toHaveBeenCalled();
    expect(wrapperB.remove).not.toHaveBeenCalled();

    releaseCall();
    await expect(operationA).rejects.toThrow(/wrapper A outcome unknown/);
  });
});
