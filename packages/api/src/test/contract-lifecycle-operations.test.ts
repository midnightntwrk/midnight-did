import {
  deployContract,
  DeployTxFailedError,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deploy,
  DIDContractDeploymentFinalizedPrivateStateIncompleteError,
  joinContract,
} from "../contract-lifecycle-operations.js";
import {
  bindOrAssertPrivateStateProvider,
  bindPrivateStateProvider,
  discardPendingControllerPrivateState,
  PendingControllerPrivateStateBusyError,
  PrivateStateProviderContractMismatchError,
  recoverPendingControllerPrivateState,
  withPendingControllerPrivateStateLock,
} from "../private-state.js";
import { MidnightDIDPrivateStateId } from "../types.js";

vi.mock("@midnight-ntwrk/midnight-js-contracts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@midnight-ntwrk/midnight-js-contracts")
  >()),
  deployContract: vi.fn(),
  findDeployedContract: vi.fn(),
}));

vi.mock("../contract-instance.js", () => ({
  midnightDIDCompiledContract: { name: "compiled-midnight-did" },
}));

const inspectOwnPropertyGraph = (root: unknown) => {
  const reachable = new Set<object>();
  const text: string[] = [];

  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      text.push(value);
      return;
    }
    if (typeof value === "symbol") {
      text.push(value.description ?? "");
      return;
    }
    if (
      value === null ||
      (typeof value !== "object" && typeof value !== "function") ||
      reachable.has(value)
    ) {
      return;
    }

    reachable.add(value);
    for (const property of Reflect.ownKeys(value)) {
      visit(property);
      const descriptor = Object.getOwnPropertyDescriptor(value, property);
      if (descriptor === undefined) {
        continue;
      }
      if ("value" in descriptor) {
        visit(descriptor.value);
      } else {
        visit(descriptor.get);
        visit(descriptor.set);
      }
    }
  };

  visit(root);
  return { reachable, text: text.join("\n") };
};

describe("contract lifecycle operations", () => {
  const contractAddress = "A".repeat(64);
  const deployedContractAddress = "D".repeat(64);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("binds the provider and requires existing private state before joining", async () => {
    const privateState = {
      recoverySecretKey: new Uint8Array(32).fill(9),
      secretKey: new Uint8Array(32).fill(7),
    };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => privateState),
    };
    const joinedContract = {
      deployTxData: { public: { contractAddress } },
    };
    vi.mocked(findDeployedContract).mockResolvedValue(joinedContract as any);

    await expect(
      joinContract({ privateStateProvider } as any, contractAddress),
    ).resolves.toBe(joinedContract);

    expect(privateStateProvider.setContractAddress).toHaveBeenCalledWith(
      contractAddress.toLowerCase(),
    );
    expect(
      privateStateProvider.setContractAddress.mock.invocationCallOrder[0],
    ).toBeLessThan(privateStateProvider.get.mock.invocationCallOrder[0]);
    expect(privateStateProvider.get.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(findDeployedContract).mock.invocationCallOrder[0],
    );
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
    );
    expect(findDeployedContract).toHaveBeenCalledWith(
      { privateStateProvider },
      expect.objectContaining({
        contractAddress: contractAddress.toLowerCase(),
        privateStateId: MidnightDIDPrivateStateId,
        initialPrivateState: privateState,
      }),
    );
  });

  it("joins with recovery-only private state for controller recovery", async () => {
    const privateState = {
      recoverySecretKey: new Uint8Array(32).fill(9),
    };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => privateState),
    };
    const joinedContract = {
      deployTxData: { public: { contractAddress } },
    };
    vi.mocked(findDeployedContract).mockResolvedValue(joinedContract as any);

    await expect(
      joinContract({ privateStateProvider } as any, contractAddress),
    ).resolves.toBe(joinedContract);

    expect(findDeployedContract).toHaveBeenCalledWith(
      { privateStateProvider },
      expect.objectContaining({ initialPrivateState: privateState }),
    );
  });

  it("does not join a contract when controller and recovery private state are missing", async () => {
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => null),
    };

    await expect(
      joinContract({ privateStateProvider } as any, contractAddress),
    ).rejects.toThrow(/private state is missing or malformed/);

    expect(findDeployedContract).not.toHaveBeenCalled();
  });

  it("fails join before target binding when another lifecycle owns the target and releases the source", async () => {
    const sourceAddress = "C".repeat(64);
    const joiningProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => ({ secretKey: new Uint8Array(32).fill(7) })),
    };
    const targetOwnerProvider = { setContractAddress: vi.fn() };
    const joiningProviders = { privateStateProvider: joiningProvider } as any;
    const targetOwnerProviders = {
      privateStateProvider: targetOwnerProvider,
    } as any;
    bindPrivateStateProvider(joiningProviders, sourceAddress);
    bindPrivateStateProvider(targetOwnerProviders, contractAddress);

    let releaseTarget!: () => void;
    const targetGate = new Promise<void>((resolve) => {
      releaseTarget = resolve;
    });
    let targetStarted!: () => void;
    const targetStart = new Promise<void>((resolve) => {
      targetStarted = resolve;
    });
    const targetOwner = withPendingControllerPrivateStateLock(
      targetOwnerProviders,
      async () => {
        targetStarted();
        await targetGate;
      },
    );
    await targetStart;

    await expect(
      joinContract(joiningProviders, contractAddress),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    expect(joiningProvider.setContractAddress).toHaveBeenCalledTimes(1);
    expect(joiningProvider.setContractAddress).toHaveBeenCalledWith(
      sourceAddress.toLowerCase(),
    );
    expect(joiningProvider.get).not.toHaveBeenCalled();
    expect(findDeployedContract).not.toHaveBeenCalled();

    const sourceCompetitor = { setContractAddress: vi.fn() };
    expect(() =>
      bindPrivateStateProvider(
        { privateStateProvider: sourceCompetitor } as any,
        sourceAddress,
      ),
    ).not.toThrow();

    releaseTarget();
    await targetOwner;
  });

  it("holds join source and target leases through deferred contract lookup", async () => {
    const sourceAddress = "E".repeat(64);
    const privateState = { secretKey: new Uint8Array(32).fill(7) };
    const joiningProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => privateState),
    };
    const sourceProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    const targetProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    const joiningProviders = { privateStateProvider: joiningProvider } as any;
    const sourceProviders = { privateStateProvider: sourceProvider } as any;
    const targetProviders = { privateStateProvider: targetProvider } as any;
    bindPrivateStateProvider(joiningProviders, sourceAddress);
    bindPrivateStateProvider(sourceProviders, sourceAddress);
    bindPrivateStateProvider(targetProviders, contractAddress);

    let lookupStarted!: () => void;
    const lookupStart = new Promise<void>((resolve) => {
      lookupStarted = resolve;
    });
    let finishLookup!: (value: any) => void;
    const lookupGate = new Promise<any>((resolve) => {
      finishLookup = resolve;
    });
    vi.mocked(findDeployedContract).mockImplementationOnce(async () => {
      lookupStarted();
      return lookupGate;
    });

    const joining = joinContract(joiningProviders, contractAddress);
    await lookupStart;

    await expect(
      withPendingControllerPrivateStateLock(sourceProviders, async () => {}),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    await expect(
      withPendingControllerPrivateStateLock(targetProviders, async () => {}),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    await expect(
      discardPendingControllerPrivateState(sourceProviders, {
        contractAddress: sourceAddress,
        rotationFinalized: false,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    await expect(
      recoverPendingControllerPrivateState(targetProviders, {
        contractAddress,
        rotationFinalized: true,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    expect(() =>
      bindPrivateStateProvider(sourceProviders, contractAddress),
    ).toThrow(PendingControllerPrivateStateBusyError);
    await expect(
      discardPendingControllerPrivateState(joiningProviders, {
        contractAddress: sourceAddress,
        rotationFinalized: false,
      }),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);

    expect(joiningProvider.get).toHaveBeenCalledTimes(1);
    expect(sourceProvider.get).not.toHaveBeenCalled();
    expect(sourceProvider.set).not.toHaveBeenCalled();
    expect(sourceProvider.remove).not.toHaveBeenCalled();
    expect(targetProvider.get).not.toHaveBeenCalled();
    expect(targetProvider.set).not.toHaveBeenCalled();
    expect(targetProvider.remove).not.toHaveBeenCalled();
    expect(sourceProvider.setContractAddress).toHaveBeenCalledTimes(1);
    expect(targetProvider.setContractAddress).toHaveBeenCalledTimes(1);

    const joinedContract = {
      deployTxData: { public: { contractAddress } },
    };
    finishLookup(joinedContract);
    await expect(joining).resolves.toBe(joinedContract);
  });

  it("releases join source and target leases after deferred lookup failure", async () => {
    const sourceAddress = "F".repeat(64);
    const lookupFailure = new Error("lookup failed");
    const joiningProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => ({ secretKey: new Uint8Array(32).fill(7) })),
    };
    const joiningProviders = { privateStateProvider: joiningProvider } as any;
    bindPrivateStateProvider(joiningProviders, sourceAddress);

    let rejectLookup!: (reason: unknown) => void;
    const lookupGate = new Promise<any>((_resolve, reject) => {
      rejectLookup = reject;
    });
    vi.mocked(findDeployedContract).mockReturnValueOnce(lookupGate);

    const joining = joinContract(joiningProviders, contractAddress);
    await vi.waitFor(() =>
      expect(findDeployedContract).toHaveBeenCalledTimes(1),
    );
    rejectLookup(lookupFailure);
    await expect(joining).rejects.toBe(lookupFailure);

    const sourceProvider = { setContractAddress: vi.fn() };
    const targetProvider = { setContractAddress: vi.fn() };
    expect(() =>
      bindPrivateStateProvider(
        { privateStateProvider: sourceProvider } as any,
        sourceAddress,
      ),
    ).not.toThrow();
    expect(() =>
      bindPrivateStateProvider(
        { privateStateProvider: targetProvider } as any,
        contractAddress,
      ),
    ).not.toThrow();
  });

  it("rejects a busy provider before deploying", async () => {
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(),
    };
    const providers = { privateStateProvider } as any;
    let releaseLease!: () => void;
    const leaseGate = new Promise<void>((resolve) => {
      releaseLease = resolve;
    });
    let leaseStarted!: () => void;
    const leaseStart = new Promise<void>((resolve) => {
      leaseStarted = resolve;
    });
    const heldLease = withPendingControllerPrivateStateLock(
      providers,
      async () => {
        leaseStarted();
        await leaseGate;
      },
    );
    await leaseStart;

    await expect(deploy(providers, privateState)).rejects.toBeInstanceOf(
      PendingControllerPrivateStateBusyError,
    );
    expect(deployContract).not.toHaveBeenCalled();

    releaseLease();
    await heldLease;
  });

  it("intercepts midnight-js-contracts 4.0.2 setup and persists each value once", async () => {
    const sourceAddress = "B".repeat(64);
    const privateState = {
      recoverySecretKey: new Uint8Array(32).fill(9),
      secretKey: new Uint8Array(32).fill(8),
    };
    const rotatedState = {
      recoverySecretKey: privateState.recoverySecretKey,
      secretKey: new Uint8Array(32).fill(6),
    };
    const signingKey = new Uint8Array(32).fill(5);
    let storedState: unknown;
    let privateStateProvider: any;
    const setContractAddress = vi.fn(function (this: unknown) {
      expect(this).toBe(privateStateProvider);
    });
    const set = vi.fn(function (this: unknown, _id: string, state: unknown) {
      expect(this).toBe(privateStateProvider);
      storedState = state;
      return Promise.resolve();
    });
    const setSigningKey = vi.fn(function (this: unknown) {
      expect(this).toBe(privateStateProvider);
      // A concurrent controller lifecycle can rotate after the upstream active
      // write. deploy() must not repeat that write after the dependency returns.
      storedState = rotatedState;
      return Promise.resolve();
    });
    privateStateProvider = { setContractAddress, set, setSigningKey };
    const providers = { privateStateProvider } as any;
    bindPrivateStateProvider(providers, sourceAddress);
    let constructedContract: any;
    let capturedDeploymentProvider: any;
    vi.mocked(deployContract).mockImplementationOnce(
      async (deploymentProviders: any, options: any) => {
        capturedDeploymentProvider = deploymentProviders.privateStateProvider;
        deploymentProviders.privateStateProvider.setContractAddress(
          deployedContractAddress,
        );
        await deploymentProviders.privateStateProvider.set(
          options.privateStateId,
          options.initialPrivateState,
        );
        await deploymentProviders.privateStateProvider.setSigningKey(
          deployedContractAddress,
          signingKey,
        );
        // deployContract 4.0.2 constructs callTx after submitDeployTx returns;
        // createCircuitCallTxInterface binds the finalized address again.
        deploymentProviders.privateStateProvider.setContractAddress(
          deployedContractAddress,
        );
        constructedContract = {
          deployTxData: {
            public: { contractAddress: deployedContractAddress },
          },
          callTx: { update: vi.fn() },
        };
        return constructedContract;
      },
    );

    const deployment = await deploy(providers, privateState);
    expect(deployment).toBe(constructedContract);

    expect(setContractAddress).toHaveBeenCalledTimes(3);
    expect(setContractAddress).toHaveBeenNthCalledWith(
      2,
      deployedContractAddress.toLowerCase(),
    );
    expect(setContractAddress).toHaveBeenNthCalledWith(
      3,
      deployedContractAddress.toLowerCase(),
    );
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(MidnightDIDPrivateStateId, privateState);
    expect(setSigningKey).toHaveBeenCalledTimes(1);
    expect(setSigningKey).toHaveBeenCalledWith(
      deployedContractAddress,
      signingKey,
    );
    expect(storedState).toBe(rotatedState);
    bindOrAssertPrivateStateProvider(providers, deployedContractAddress);
    expect(setContractAddress).toHaveBeenCalledTimes(3);
    expect(() =>
      capturedDeploymentProvider.setContractAddress(deployedContractAddress),
    ).not.toThrow();
    expect(setContractAddress).toHaveBeenCalledTimes(4);

    const postSettlementState = {
      recoverySecretKey: privateState.recoverySecretKey,
      secretKey: new Uint8Array(32).fill(4),
    };
    const postSettlementWrite = capturedDeploymentProvider.set(
      MidnightDIDPrivateStateId,
      postSettlementState,
    );
    expect(postSettlementWrite).toBe(set.mock.results[1]?.value);
    await expect(postSettlementWrite).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledTimes(2);
    expect(storedState).toBe(postSettlementState);
  });

  it("reports a finalized target competitor present before interception without mutating the source binding", async () => {
    const sourceAddress = "C".repeat(64);
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    const deployingProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(),
      setSigningKey: vi.fn(),
    };
    const deployingProviders = {
      privateStateProvider: deployingProvider,
    } as any;
    bindPrivateStateProvider(deployingProviders, sourceAddress);

    const targetOwnerProvider = { setContractAddress: vi.fn() };
    const targetOwnerProviders = {
      privateStateProvider: targetOwnerProvider,
    } as any;
    bindPrivateStateProvider(targetOwnerProviders, deployedContractAddress);
    let releaseTarget!: () => void;
    const targetGate = new Promise<void>((resolve) => {
      releaseTarget = resolve;
    });
    let targetStarted!: () => void;
    const targetStart = new Promise<void>((resolve) => {
      targetStarted = resolve;
    });
    const targetOwner = withPendingControllerPrivateStateLock(
      targetOwnerProviders,
      async () => {
        targetStarted();
        await targetGate;
      },
    );
    await targetStart;

    vi.mocked(deployContract).mockImplementationOnce(
      async (deploymentProviders: any) => {
        deploymentProviders.privateStateProvider.setContractAddress(
          deployedContractAddress,
        );
        throw new Error("unreachable after target reservation failure");
      },
    );

    const error = await deploy(deployingProviders, privateState).catch(
      (cause: unknown) => cause,
    );
    expect(error).toMatchObject({
      name: "DIDContractDeploymentFinalizedPrivateStateIncompleteError",
      code: "did_contract_deployment_finalized_private_state_incomplete",
      contractAddress: deployedContractAddress.toLowerCase(),
      setupStage: "target_reservation",
    });
    expect(error).not.toHaveProperty("cause");
    expect(error).not.toHaveProperty("privateState");
    expect(JSON.stringify(error)).not.toContain("secretKey");
    expect(deployingProvider.setContractAddress).toHaveBeenCalledTimes(1);
    expect(deployingProvider.set).not.toHaveBeenCalled();
    expect(deployingProvider.setSigningKey).not.toHaveBeenCalled();
    bindOrAssertPrivateStateProvider(deployingProviders, sourceAddress);
    expect(deployingProvider.setContractAddress).toHaveBeenCalledTimes(1);

    releaseTarget();
    await targetOwner;
  });

  it("reserves source and observed target until all upstream setup and return work settles", async () => {
    const sourceAddress = "E".repeat(64);
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    const signingKey = new Uint8Array(32).fill(5);
    let setupObserved!: () => void;
    const setupStart = new Promise<void>((resolve) => {
      setupObserved = resolve;
    });
    let continueSetup!: () => void;
    const setupGate = new Promise<void>((resolve) => {
      continueSetup = resolve;
    });
    const deployingProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(async () => undefined),
      setSigningKey: vi.fn(async () => undefined),
    };
    const deployingProviders = {
      privateStateProvider: deployingProvider,
    } as any;
    bindPrivateStateProvider(deployingProviders, sourceAddress);
    const sourceCompetitor = { setContractAddress: vi.fn() };
    const sourceCompetitorProviders = {
      privateStateProvider: sourceCompetitor,
    } as any;
    bindPrivateStateProvider(sourceCompetitorProviders, sourceAddress);
    const deployedContract = {
      deployTxData: { public: { contractAddress: deployedContractAddress } },
    };
    vi.mocked(deployContract).mockImplementationOnce(
      async (deploymentProviders: any, options: any) => {
        deploymentProviders.privateStateProvider.setContractAddress(
          deployedContractAddress,
        );
        setupObserved();
        await setupGate;
        await deploymentProviders.privateStateProvider.set(
          options.privateStateId,
          options.initialPrivateState,
        );
        await deploymentProviders.privateStateProvider.setSigningKey(
          deployedContractAddress,
          signingKey,
        );
        deploymentProviders.privateStateProvider.setContractAddress(
          deployedContractAddress,
        );
        return deployedContract as any;
      },
    );

    const deployment = deploy(deployingProviders, privateState);
    await setupStart;

    const targetCompetitor = { setContractAddress: vi.fn() };
    await expect(
      withPendingControllerPrivateStateLock(
        sourceCompetitorProviders,
        async () => undefined,
      ),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);
    expect(() =>
      bindPrivateStateProvider(
        { privateStateProvider: targetCompetitor } as any,
        deployedContractAddress,
      ),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(targetCompetitor.setContractAddress).not.toHaveBeenCalled();
    await expect(
      withPendingControllerPrivateStateLock(deployingProviders, async () => {}),
    ).rejects.toBeInstanceOf(PendingControllerPrivateStateBusyError);

    continueSetup();
    await expect(deployment).resolves.toBe(deployedContract);
    bindOrAssertPrivateStateProvider(
      deployingProviders,
      deployedContractAddress,
    );
    expect(() =>
      bindOrAssertPrivateStateProvider(deployingProviders, sourceAddress),
    ).toThrow(PrivateStateProviderContractMismatchError);
    expect(() =>
      bindPrivateStateProvider(
        { privateStateProvider: targetCompetitor } as any,
        deployedContractAddress,
      ),
    ).not.toThrow();
  });

  it("discards adversarial upstream evidence after active-state rejection", async () => {
    const sourceAddress = "F".repeat(64);
    const initialSecret = "initial-secret-do-not-expose";
    const recoverySecret = "recovery-secret-do-not-expose";
    const signingSecret = "signing-secret-do-not-expose";
    const privateState = {
      recoverySecretKey: new Uint8Array(32).fill(9),
      secretKey: new Uint8Array(32).fill(8),
    };
    const signingKey = new Uint8Array(32).fill(5);
    const secretBundle = { initialSecret, recoverySecret, signingSecret };
    const publicDeployTxData = {
      contractAddress: deployedContractAddress,
      ...secretBundle,
    };
    const privateDeployTxData = { ...secretBundle, privateState };
    const deployTxData = {
      public: publicDeployTxData,
      private: privateDeployTxData,
    };
    const transaction = { ...secretBundle, signingKey };
    const finalizedTxData = {
      status: "SucceedEntirely",
      ...secretBundle,
      transaction,
    };
    const deployedContract = { deployTxData, transaction };
    const saveFailure = Object.assign(
      new Error(
        `provider message: ${initialSecret}:${recoverySecret}:${signingSecret}`,
      ),
      {
        deployedContract,
        finalizedTxData,
        transaction,
      },
    );
    saveFailure.name = `Provider${initialSecret}:${recoverySecret}:${signingSecret}`;
    const secretSymbol = Symbol(
      `provider-symbol-${initialSecret}:${recoverySecret}:${signingSecret}`,
    );
    Object.defineProperty(saveFailure, "hiddenProviderEvidence", {
      value: { initialSecret, recoverySecret, signingSecret },
      enumerable: false,
    });
    const sourceToJSON = vi.fn(() => ({
      initialSecret,
      recoverySecret,
      signingSecret,
    }));
    Object.defineProperty(saveFailure, "toJSON", {
      value: sourceToJSON,
      enumerable: false,
    });
    Object.defineProperty(saveFailure, secretSymbol, {
      value: { initialSecret, recoverySecret, signingSecret },
      enumerable: false,
    });
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(async () => {
        throw saveFailure;
      }),
      setSigningKey: vi.fn(),
    };
    const providers = { privateStateProvider } as any;
    bindPrivateStateProvider(providers, sourceAddress);
    vi.mocked(deployContract).mockImplementationOnce(
      async (deploymentProviders: any, options: any) => {
        deploymentProviders.privateStateProvider.setContractAddress(
          deployedContractAddress,
        );
        await deploymentProviders.privateStateProvider.set(
          options.privateStateId,
          options.initialPrivateState,
        );
        throw new Error("unreachable after active-state failure");
      },
    );

    const error = await deploy(providers, privateState).catch(
      (cause: unknown) => cause,
    );
    if (
      !(
        error instanceof
        DIDContractDeploymentFinalizedPrivateStateIncompleteError
      )
    ) {
      throw error;
    }
    expect(error).toMatchObject({
      name: "DIDContractDeploymentFinalizedPrivateStateIncompleteError",
      code: "did_contract_deployment_finalized_private_state_incomplete",
      contractAddress: deployedContractAddress.toLowerCase(),
      setupStage: "private_state_persistence",
    });
    expect(error).not.toHaveProperty("cause");
    expect(error).not.toHaveProperty("deployedContract");
    expect(error).not.toHaveProperty("deployTxData");
    expect(error).not.toHaveProperty("finalizedTxData");
    expect(error).not.toHaveProperty("transaction");

    const inspected = inspectOwnPropertyGraph(error);
    for (const sourceValue of [
      saveFailure,
      deployedContract,
      deployTxData,
      publicDeployTxData,
      privateDeployTxData,
      finalizedTxData,
      transaction,
      privateState,
      secretBundle,
      privateState.recoverySecretKey,
      privateState.secretKey,
      signingKey,
    ]) {
      expect(inspected.reachable).not.toContain(sourceValue);
    }
    for (const secret of [initialSecret, recoverySecret, signingSecret]) {
      expect(inspected.text).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain(secret);
    }
    expect(sourceToJSON).not.toHaveBeenCalled();
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.setSigningKey).not.toHaveBeenCalled();
    bindOrAssertPrivateStateProvider(providers, deployedContractAddress);
    expect(() =>
      bindOrAssertPrivateStateProvider(providers, sourceAddress),
    ).toThrow(PrivateStateProviderContractMismatchError);
  });

  it("wraps an upstream signing-key rejection after active state is persisted once", async () => {
    const sourceAddress = "9".repeat(64);
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    const signingKey = new Uint8Array(32).fill(5);
    const signingKeyFailure = new Error("signing key failed");
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(async () => undefined),
      setSigningKey: vi.fn(async () => {
        throw signingKeyFailure;
      }),
    };
    const providers = { privateStateProvider } as any;
    bindPrivateStateProvider(providers, sourceAddress);
    vi.mocked(deployContract).mockImplementationOnce(
      async (deploymentProviders: any, options: any) => {
        deploymentProviders.privateStateProvider.setContractAddress(
          deployedContractAddress,
        );
        await deploymentProviders.privateStateProvider.set(
          options.privateStateId,
          options.initialPrivateState,
        );
        await deploymentProviders.privateStateProvider.setSigningKey(
          deployedContractAddress,
          signingKey,
        );
        throw new Error("unreachable after signing-key failure");
      },
    );

    const error = await deploy(providers, privateState).catch(
      (cause: unknown) => cause,
    );
    expect(error).toMatchObject({
      name: "DIDContractDeploymentFinalizedPrivateStateIncompleteError",
      code: "did_contract_deployment_finalized_private_state_incomplete",
      contractAddress: deployedContractAddress.toLowerCase(),
      setupStage: "signing_key_persistence",
    });
    expect(error).not.toHaveProperty("cause");
    expect(inspectOwnPropertyGraph(error).reachable).not.toContain(
      signingKeyFailure,
    );
    expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
    expect(privateStateProvider.setSigningKey).toHaveBeenCalledTimes(1);
    bindOrAssertPrivateStateProvider(providers, deployedContractAddress);
    expect(() =>
      bindOrAssertPrivateStateProvider(providers, sourceAddress),
    ).toThrow(PrivateStateProviderContractMismatchError);
  });

  it.each(["second binding", "later handle setup"] as const)(
    "reports contract handle construction when %s fails after persistence",
    async (failurePoint) => {
      const sourceAddress = "8".repeat(64);
      const privateState = { secretKey: new Uint8Array(32).fill(8) };
      const signingKey = new Uint8Array(32).fill(5);
      const retainedHandle = {
        secret: "contract-handle-secret-do-not-expose",
      };
      const handleFailure = Object.assign(
        new Error("source handle construction message"),
        { handle: retainedHandle, deployTxData: retainedHandle },
      );
      handleFailure.name = "SourceHandleConstructionError";
      let finalizedAddressBindings = 0;
      const privateStateProvider = {
        setContractAddress: vi.fn((address: string) => {
          if (address.toLowerCase() === deployedContractAddress.toLowerCase()) {
            finalizedAddressBindings += 1;
            if (
              failurePoint === "second binding" &&
              finalizedAddressBindings === 2
            ) {
              throw handleFailure;
            }
          }
        }),
        set: vi.fn(async () => undefined),
        setSigningKey: vi.fn(async () => undefined),
      };
      const providers = { privateStateProvider } as any;
      bindPrivateStateProvider(providers, sourceAddress);
      vi.mocked(deployContract).mockImplementationOnce(
        async (deploymentProviders: any, options: any) => {
          // This mirrors submitDeployTx success followed by deployContract's
          // createCircuitCallTxInterface construction in 4.0.2.
          deploymentProviders.privateStateProvider.setContractAddress(
            deployedContractAddress,
          );
          await deploymentProviders.privateStateProvider.set(
            options.privateStateId,
            options.initialPrivateState,
          );
          await deploymentProviders.privateStateProvider.setSigningKey(
            deployedContractAddress,
            signingKey,
          );
          deploymentProviders.privateStateProvider.setContractAddress(
            deployedContractAddress,
          );
          throw handleFailure;
        },
      );

      const error = await deploy(providers, privateState).catch(
        (cause: unknown) => cause,
      );
      expect(error).toMatchObject({
        name: "DIDContractDeploymentFinalizedPrivateStateIncompleteError",
        code: "did_contract_deployment_finalized_private_state_incomplete",
        contractAddress: deployedContractAddress.toLowerCase(),
        setupStage: "contract_handle_construction",
      });
      expect(privateStateProvider.set).toHaveBeenCalledTimes(1);
      expect(privateStateProvider.setSigningKey).toHaveBeenCalledTimes(1);
      expect(finalizedAddressBindings).toBe(2);

      const inspected = inspectOwnPropertyGraph(error);
      expect(error).not.toHaveProperty("cause");
      expect(error).not.toHaveProperty("handle");
      expect(inspected.reachable).not.toContain(handleFailure);
      expect(inspected.reachable).not.toContain(retainedHandle);
      for (const sourceText of [
        handleFailure.name,
        handleFailure.message,
        retainedHandle.secret,
      ]) {
        expect(inspected.text).not.toContain(sourceText);
        expect(JSON.stringify(error)).not.toContain(sourceText);
      }
    },
  );

  it("preserves a genuine DeployTxFailedError when no finalized target was observed", async () => {
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(),
      setSigningKey: vi.fn(),
    };
    const deployFailure = new DeployTxFailedError({ status: "Fail" } as any);
    vi.mocked(deployContract).mockRejectedValueOnce(deployFailure);

    await expect(
      deploy({ privateStateProvider } as any, privateState),
    ).rejects.toBe(deployFailure);
    expect(privateStateProvider.setContractAddress).not.toHaveBeenCalled();
    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(privateStateProvider.setSigningKey).not.toHaveBeenCalled();
  });
});
