import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLogger, setLogger } from "../api-logger.js";
import {
  bindOrAssertPrivateStateProvider,
  bindPrivateStateProvider,
  discardPendingControllerPrivateState,
  initPrivateState,
  isRestorableDIDPrivateState,
  PendingControllerPrivateStateUnavailableError,
  PrivateStateProviderContractMismatchError,
  recoverPendingControllerPrivateState,
  requireAttachablePrivateState,
  requirePrivateState,
  restorePrivateState,
  restoreRecoverySecretKey,
} from "../private-state.js";
import {
  MidnightDIDPendingControllerPrivateStateId,
  MidnightDIDPrivateStateId,
} from "../types.js";

const makeLogger = () =>
  ({
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  }) as any;

const makeProviders = ({
  storedPrivateState = null,
  getError,
  setError,
}: {
  readonly storedPrivateState?: unknown;
  readonly getError?: Error;
  readonly setError?: Error;
} = {}) => {
  const privateStateProvider = {
    setContractAddress: vi.fn(),
    get: vi.fn(async () => {
      if (getError) throw getError;
      return storedPrivateState;
    }),
    set: vi.fn(async () => {
      if (setError) throw setError;
    }),
    remove: vi.fn(async () => undefined),
  };
  return {
    providers: {
      privateStateProvider,
    } as any,
    privateStateProvider,
  };
};

describe("DID private state lifecycle", () => {
  const contractAddress = "A".repeat(64);
  const contractAddressUnsetErrorMessage =
    "Contract address not set. Call setContractAddress() before accessing private state.";
  let previousLogger: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    previousLogger = getLogger();
    setLogger(makeLogger());
  });

  afterEach(() => {
    if (previousLogger) {
      setLogger(previousLogger as any);
    }
  });

  it("accepts 32-byte controller state with optional 32-byte recovery state", () => {
    expect(
      isRestorableDIDPrivateState({
        recoverySecretKey: new Uint8Array(32),
        secretKey: new Uint8Array(32),
      }),
    ).toBe(true);
    expect(
      isRestorableDIDPrivateState({ secretKey: new Uint8Array(32) } as any),
    ).toBe(true);
    expect(
      isRestorableDIDPrivateState({
        recoverySecretKey: new Uint8Array(31),
        secretKey: new Uint8Array(32),
      } as any),
    ).toBe(false);
    expect(
      isRestorableDIDPrivateState({ secretKey: new Uint8Array(31) } as any),
    ).toBe(false);
    expect(
      isRestorableDIDPrivateState({ secretKey: new Int8Array(32) } as any),
    ).toBe(false);
    expect(
      isRestorableDIDPrivateState({ secretKey: new Uint16Array(16) } as any),
    ).toBe(false);
    expect(isRestorableDIDPrivateState(null)).toBe(false);
    expect(isRestorableDIDPrivateState({ secretKey: [] } as any)).toBe(false);
  });

  it("returns provider state without deriving or saving a replacement", async () => {
    const storedPrivateState = {
      recoverySecretKey: new Uint8Array(32).fill(8),
      secretKey: new Uint8Array(32).fill(7),
    };
    const { providers, privateStateProvider } = makeProviders({
      storedPrivateState,
    });

    await expect(initPrivateState(providers)).resolves.toBe(storedPrivateState);
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
    );
    expect(privateStateProvider.set).not.toHaveBeenCalled();
  });

  it("restores null for malformed state but requirePrivateState rejects it", async () => {
    const { providers } = makeProviders({
      storedPrivateState: { secretKey: new Uint8Array(31) },
    });

    await expect(restorePrivateState(providers)).resolves.toBeNull();
    await expect(requirePrivateState(providers)).rejects.toThrow(
      /private state is missing or malformed/,
    );
  });

  it("generates and saves a replacement when stored state is missing or malformed", async () => {
    const { providers, privateStateProvider } = makeProviders({
      storedPrivateState: { secretKey: new Uint8Array(31) },
    });

    const privateState = await initPrivateState(providers);

    expect(privateState.secretKey).toBeInstanceOf(Uint8Array);
    expect(privateState.secretKey).toHaveLength(32);
    expect(privateState.recoverySecretKey).toHaveLength(32);
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
      privateState,
    );
  });

  it("allows restore and save before a contract address is bound", async () => {
    const { providers, privateStateProvider } = makeProviders({
      getError: new Error(contractAddressUnsetErrorMessage),
      setError: new Error(contractAddressUnsetErrorMessage),
    });

    const privateState = await initPrivateState(providers);

    expect(privateState.secretKey).toHaveLength(32);
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
    );
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
      privateState,
    );
  });

  it("restorePrivateState returns null when the provider has no contract address", async () => {
    const { providers, privateStateProvider } = makeProviders({
      getError: new Error(contractAddressUnsetErrorMessage),
    });

    await expect(restorePrivateState(providers)).resolves.toBeNull();
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
    );
    expect(privateStateProvider.set).not.toHaveBeenCalled();
  });

  it("uses the exact upstream unbound error for recovery, attach, and discard reads", async () => {
    const recoveryProviders = makeProviders({
      getError: new Error(contractAddressUnsetErrorMessage),
    }).providers;
    await expect(
      restoreRecoverySecretKey(recoveryProviders),
    ).resolves.toBeNull();

    const attachProviders = makeProviders({
      getError: new Error(contractAddressUnsetErrorMessage),
    }).providers;
    await expect(
      requireAttachablePrivateState(attachProviders),
    ).rejects.toThrow(/private state is missing or malformed/);

    const { providers: discardProviders } = makeProviders({
      getError: new Error(contractAddressUnsetErrorMessage),
    });
    await expect(
      discardPendingControllerPrivateState(discardProviders, {
        contractAddress,
        rotationFinalized: false,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateUnavailableError);
  });

  it("propagates private-state provider failures unrelated to contract binding", async () => {
    const restoreFailure = new Error("storage offline");
    await expect(
      initPrivateState(makeProviders({ getError: restoreFailure }).providers),
    ).rejects.toBe(restoreFailure);

    const saveFailure = new Error("write failed");
    await expect(
      initPrivateState(makeProviders({ setError: saveFailure }).providers),
    ).rejects.toBe(saveFailure);
  });

  it("propagates the upstream unbound text when extra I/O context is present", async () => {
    const decoratedError = new Error(
      `${contractAddressUnsetErrorMessage} storage offline`,
    );

    await expect(
      restorePrivateState(
        makeProviders({ getError: decoratedError }).providers,
      ),
    ).rejects.toBe(decoratedError);
    await expect(
      restoreRecoverySecretKey(
        makeProviders({ getError: decoratedError }).providers,
      ),
    ).rejects.toBe(decoratedError);
    await expect(
      requireAttachablePrivateState(
        makeProviders({ getError: decoratedError }).providers,
      ),
    ).rejects.toBe(decoratedError);
    await expect(
      initPrivateState(makeProviders({ getError: decoratedError }).providers),
    ).rejects.toBe(decoratedError);
    await expect(
      initPrivateState(makeProviders({ setError: decoratedError }).providers),
    ).rejects.toBe(decoratedError);
    await expect(
      discardPendingControllerPrivateState(
        makeProviders({ getError: decoratedError }).providers,
        { contractAddress, rotationFinalized: false },
      ),
    ).rejects.toBe(decoratedError);
  });

  it("binds the private-state provider to a contract address", () => {
    const { providers, privateStateProvider } = makeProviders();

    const mixedCaseAddress = `${"A".repeat(32)}${"c".repeat(32)}`;
    bindPrivateStateProvider(providers, mixedCaseAddress);

    expect(privateStateProvider.setContractAddress).toHaveBeenCalledWith(
      mixedCaseAddress.toLowerCase(),
    );
  });

  it("auto-binds an untracked provider and accepts canonical-equivalent addresses", () => {
    const { providers, privateStateProvider } = makeProviders();
    const mixedCaseAddress = `${"A".repeat(32)}${"c".repeat(32)}`;

    bindOrAssertPrivateStateProvider(providers, mixedCaseAddress);
    bindOrAssertPrivateStateProvider(providers, mixedCaseAddress.toLowerCase());

    expect(privateStateProvider.setContractAddress).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.setContractAddress).toHaveBeenCalledWith(
      mixedCaseAddress.toLowerCase(),
    );
  });

  it.each([
    ["promotion", true],
    ["discard", false],
  ] as const)(
    "rejects wrong-DID pending %s before provider access",
    async (_description, rotationFinalized) => {
      const { providers, privateStateProvider } = makeProviders({
        storedPrivateState: { secretKey: new Uint8Array(32).fill(9) },
      });
      bindPrivateStateProvider(providers, contractAddress);
      vi.clearAllMocks();
      const otherContractAddress = "B".repeat(64);

      const reconciliation = rotationFinalized
        ? recoverPendingControllerPrivateState(providers, {
            contractAddress: otherContractAddress,
            rotationFinalized,
          })
        : discardPendingControllerPrivateState(providers, {
            contractAddress: otherContractAddress,
            rotationFinalized,
          });

      await expect(reconciliation).rejects.toBeInstanceOf(
        PrivateStateProviderContractMismatchError,
      );
      await expect(reconciliation).rejects.toMatchObject({
        code: "private_state_provider_contract_mismatch",
        expectedContractAddress: otherContractAddress.toLowerCase(),
        actualContractAddress: contractAddress.toLowerCase(),
      });
      expect(privateStateProvider.setContractAddress).not.toHaveBeenCalled();
      expect(privateStateProvider.get).not.toHaveBeenCalled();
      expect(privateStateProvider.set).not.toHaveBeenCalled();
      expect(privateStateProvider.remove).not.toHaveBeenCalled();
    },
  );

  it("promotes pending controller private state for recovery", async () => {
    const pendingPrivateState = {
      recoverySecretKey: new Uint8Array(32).fill(10),
      secretKey: new Uint8Array(32).fill(9),
    };
    const { providers, privateStateProvider } = makeProviders({
      storedPrivateState: pendingPrivateState,
    });

    await expect(
      recoverPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: true,
      }),
    ).resolves.toBe(pendingPrivateState);
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
      pendingPrivateState,
    );
    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
  });

  it("discards pending controller private state only after non-finalization confirmation", async () => {
    const pendingPrivateState = {
      secretKey: new Uint8Array(32).fill(9),
    };
    const { providers, privateStateProvider } = makeProviders({
      storedPrivateState: pendingPrivateState,
    });

    await expect(
      discardPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: false,
      }),
    ).resolves.toBeUndefined();
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
  });

  it.each([
    ["retained", false],
    ["deleted", true],
  ] as const)(
    "propagates failed discard cleanup when the pending record was %s",
    async (_outcome, deleteBeforeReject) => {
      const pendingPrivateState = { secretKey: new Uint8Array(32).fill(9) };
      let pending: unknown = pendingPrivateState;
      let removeAttempts = 0;
      const removeError = new Error("remove acknowledgement unavailable");
      const privateStateProvider = {
        setContractAddress: vi.fn(),
        get: vi.fn(async () => pending),
        set: vi.fn(),
        remove: vi.fn(async () => {
          removeAttempts += 1;
          if (removeAttempts === 1) {
            if (deleteBeforeReject) pending = null;
            throw removeError;
          }
          pending = null;
        }),
      };
      const providers = { privateStateProvider } as any;

      await expect(
        discardPendingControllerPrivateState(providers, {
          contractAddress,
          rotationFinalized: false,
        }),
      ).rejects.toBe(removeError);

      const laterObservation = discardPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: false,
      });
      if (deleteBeforeReject) {
        await expect(laterObservation).rejects.toMatchObject({
          code: "pending_controller_private_state_missing_or_malformed",
        });
      } else {
        await expect(laterObservation).resolves.toBeUndefined();
      }
    },
  );

  it.each([
    [
      "discard",
      "Pending controller private state can only be discarded after confirming the key-rotation transaction did not finalize",
    ],
    [
      "recover",
      "Pending controller private state can only be recovered after confirming the key-rotation transaction finalized",
    ],
  ] as const)(
    "uses the shared confirmation guard for pending-state %s",
    async (operation, expectedMessage) => {
      const { providers, privateStateProvider } = makeProviders({
        storedPrivateState: { secretKey: new Uint8Array(32).fill(9) },
      });

      const reconciliation =
        operation === "discard"
          ? discardPendingControllerPrivateState(providers, undefined as any)
          : recoverPendingControllerPrivateState(providers, undefined as any);

      await expect(reconciliation).rejects.toThrow(expectedMessage);
      expect(privateStateProvider.get).not.toHaveBeenCalled();
      expect(privateStateProvider.set).not.toHaveBeenCalled();
      expect(privateStateProvider.remove).not.toHaveBeenCalled();
    },
  );

  it("rejects pending controller recovery when no pending state exists", async () => {
    const { providers, privateStateProvider } = makeProviders();

    await expect(
      recoverPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: true,
      }),
    ).rejects.toMatchObject({
      code: "pending_controller_private_state_missing_or_malformed",
      name: "PendingControllerPrivateStateUnavailableError",
    });
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("discards malformed pending state after non-finalization confirmation", async () => {
    const { providers, privateStateProvider } = makeProviders({
      storedPrivateState: { secretKey: new Uint8Array(31) },
    });

    await expect(
      discardPendingControllerPrivateState(providers, {
        contractAddress,
        rotationFinalized: false,
      }),
    ).resolves.toBeUndefined();
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
    expect(privateStateProvider.remove).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
  });
});
