import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLogger, setLogger } from "../api-logger.js";
import {
  initPrivateState,
  isRestorableDIDPrivateState,
} from "../private-state.js";
import { MidnightDIDPrivateStateId } from "../types.js";

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
    get: vi.fn(async () => {
      if (getError) throw getError;
      return storedPrivateState;
    }),
    set: vi.fn(async () => {
      if (setError) throw setError;
    }),
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

  it("accepts only 32-byte Uint8Array secret keys as restorable state", () => {
    expect(isRestorableDIDPrivateState({ secretKey: new Uint8Array(32) })).toBe(
      true,
    );
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
    const storedPrivateState = { secretKey: new Uint8Array(32).fill(7) };
    const { providers, privateStateProvider } = makeProviders({
      storedPrivateState,
    });

    await expect(initPrivateState(providers)).resolves.toBe(storedPrivateState);
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
    );
    expect(privateStateProvider.set).not.toHaveBeenCalled();
  });

  it("generates and saves a replacement when stored state is missing or malformed", async () => {
    const { providers, privateStateProvider } = makeProviders({
      storedPrivateState: { secretKey: new Uint8Array(31) },
    });

    const privateState = await initPrivateState(providers);

    expect(privateState.secretKey).toBeInstanceOf(Uint8Array);
    expect(privateState.secretKey).toHaveLength(32);
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
});
