import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLogger, setLogger } from "../api-logger.js";
import {
  bindPrivateStateProvider,
  initPrivateState,
  isRestorableDIDPrivateState,
  recoverPendingControllerPrivateState,
  requirePrivateState,
  restorePrivateState,
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
      getError: new Error("Contract address not set"),
      setError: new Error("Contract address not set"),
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
      getError: new Error("Contract address not set"),
    });

    await expect(restorePrivateState(providers)).resolves.toBeNull();
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
    );
    expect(privateStateProvider.set).not.toHaveBeenCalled();
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

  it("binds the private-state provider to a contract address", () => {
    const { providers, privateStateProvider } = makeProviders();

    bindPrivateStateProvider(providers, "0200abc");

    expect(privateStateProvider.setContractAddress).toHaveBeenCalledWith(
      "0200abc",
    );
  });

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

  it("refuses to recover pending controller private state without finalization confirmation", async () => {
    const { providers, privateStateProvider } = makeProviders({
      storedPrivateState: {
        recoverySecretKey: new Uint8Array(32).fill(10),
        secretKey: new Uint8Array(32).fill(9),
      },
    });

    await expect(
      recoverPendingControllerPrivateState(providers),
    ).rejects.toThrow(/only be recovered after confirming/);
    expect(privateStateProvider.get).not.toHaveBeenCalled();
    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });

  it("rejects pending controller recovery when no pending state exists", async () => {
    const { providers, privateStateProvider } = makeProviders();

    await expect(
      recoverPendingControllerPrivateState(providers, {
        rotationFinalized: true,
      }),
    ).rejects.toThrow(/private state is missing or malformed/);
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPendingControllerPrivateStateId,
    );
    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(privateStateProvider.remove).not.toHaveBeenCalled();
  });
});
