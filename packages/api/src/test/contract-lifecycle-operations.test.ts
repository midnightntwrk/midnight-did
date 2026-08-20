import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deploy,
  DIDContractDeploymentFinalizedPrivateStateIncompleteError,
  joinContract,
} from "../contract-lifecycle-operations.js";
import {
  bindPrivateStateProvider,
  PendingControllerPrivateStateBusyError,
  withPendingControllerPrivateStateLock,
} from "../private-state.js";
import { MidnightDIDPrivateStateId } from "../types.js";

vi.mock("@midnight-ntwrk/midnight-js-contracts", () => ({
  deployContract: vi.fn(),
  findDeployedContract: vi.fn(),
}));

vi.mock("../contract-instance.js", () => ({
  midnightDIDCompiledContract: { name: "compiled-midnight-did" },
}));

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

  it("binds and persists private state after deployment without nested reservation failure", async () => {
    const privateState = {
      recoverySecretKey: new Uint8Array(32).fill(9),
      secretKey: new Uint8Array(32).fill(8),
    };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(async () => undefined),
    };
    const deployedContract = {
      deployTxData: { public: { contractAddress: deployedContractAddress } },
    };
    vi.mocked(deployContract).mockResolvedValue(deployedContract as any);

    await expect(
      deploy({ privateStateProvider } as any, privateState),
    ).resolves.toBe(deployedContract);

    expect(privateStateProvider.setContractAddress).toHaveBeenCalledWith(
      deployedContractAddress.toLowerCase(),
    );
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
      privateState,
    );
  });

  it("reports finalized deployment when another lifecycle already owns the target address", async () => {
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    const deployingProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(),
    };
    let targetContractAddress: string | undefined;
    const targetOwnerProvider = {
      setContractAddress: vi.fn((nextContractAddress: string) => {
        targetContractAddress = nextContractAddress;
      }),
    };
    const deployedContract = {
      deployTxData: { public: { contractAddress: deployedContractAddress } },
    };
    let resolveDeployment!: (value: any) => void;
    const deploymentGate = new Promise<any>((resolve) => {
      resolveDeployment = resolve;
    });
    vi.mocked(deployContract).mockReturnValue(deploymentGate);

    const deployment = deploy(
      { privateStateProvider: deployingProvider } as any,
      privateState,
    );
    await vi.waitFor(() => expect(deployContract).toHaveBeenCalledTimes(1));

    const targetOwnerProviders = {
      privateStateProvider: targetOwnerProvider,
    } as any;
    bindPrivateStateProvider(targetOwnerProviders, deployedContractAddress);
    let releaseTargetLease!: () => void;
    const targetLeaseGate = new Promise<void>((resolve) => {
      releaseTargetLease = resolve;
    });
    let targetLeaseStarted!: () => void;
    const targetLeaseStart = new Promise<void>((resolve) => {
      targetLeaseStarted = resolve;
    });
    const heldTargetLease = withPendingControllerPrivateStateLock(
      targetOwnerProviders,
      async () => {
        targetLeaseStarted();
        await targetLeaseGate;
      },
    );
    await targetLeaseStart;

    resolveDeployment(deployedContract);
    const error = await deployment.catch((cause: unknown) => cause);

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
      deployedContract,
      cause: expect.any(PendingControllerPrivateStateBusyError),
    });
    expect(error.message).toMatch(/Do not redeploy blindly/);
    expect(error.message).toMatch(/reconcile or join the finalized/);
    expect(JSON.stringify(error)).not.toContain("secretKey");
    expect(deployContract).toHaveBeenCalledTimes(1);
    expect(deployingProvider.setContractAddress).not.toHaveBeenCalled();
    expect(deployingProvider.set).not.toHaveBeenCalled();
    expect(targetOwnerProvider.setContractAddress).toHaveBeenCalledTimes(1);
    expect(targetContractAddress).toBe(deployedContractAddress.toLowerCase());

    const competingProvider = { setContractAddress: vi.fn() };
    expect(() =>
      bindPrivateStateProvider(
        { privateStateProvider: competingProvider } as any,
        deployedContractAddress,
      ),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(competingProvider.setContractAddress).not.toHaveBeenCalled();

    releaseTargetLease();
    await heldTargetLease;
    expect(targetContractAddress).toBe(deployedContractAddress.toLowerCase());
  });

  it("wraps a post-finality provider binding failure", async () => {
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    const bindingFailure = new Error("binding failed");
    const privateStateProvider = {
      setContractAddress: vi.fn(() => {
        throw bindingFailure;
      }),
      set: vi.fn(),
    };
    const deployedContract = {
      deployTxData: { public: { contractAddress: deployedContractAddress } },
    };
    vi.mocked(deployContract).mockResolvedValue(deployedContract as any);

    await expect(
      deploy({ privateStateProvider } as any, privateState),
    ).rejects.toMatchObject({
      code: "did_contract_deployment_finalized_private_state_incomplete",
      contractAddress: deployedContractAddress.toLowerCase(),
      deployedContract,
      cause: bindingFailure,
    });
    expect(privateStateProvider.set).not.toHaveBeenCalled();
    expect(deployContract).toHaveBeenCalledTimes(1);
  });

  it("wraps a post-finality active private-state save failure", async () => {
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    const saveFailure = new Error("save failed");
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(async () => {
        throw saveFailure;
      }),
    };
    const deployedContract = {
      deployTxData: { public: { contractAddress: deployedContractAddress } },
    };
    vi.mocked(deployContract).mockResolvedValue(deployedContract as any);

    await expect(
      deploy({ privateStateProvider } as any, privateState),
    ).rejects.toMatchObject({
      name: "DIDContractDeploymentFinalizedPrivateStateIncompleteError",
      code: "did_contract_deployment_finalized_private_state_incomplete",
      contractAddress: deployedContractAddress.toLowerCase(),
      deployedContract,
      cause: saveFailure,
    });
    expect(privateStateProvider.setContractAddress).toHaveBeenCalledWith(
      deployedContractAddress.toLowerCase(),
    );
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
      privateState,
    );
    expect(deployContract).toHaveBeenCalledTimes(1);
  });

  it("holds the deployed target address reservation through private-state persistence", async () => {
    const privateState = { secretKey: new Uint8Array(32).fill(8) };
    let saveStarted!: () => void;
    const saveStart = new Promise<void>((resolve) => {
      saveStarted = resolve;
    });
    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const deployingProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(async () => {
        saveStarted();
        await saveGate;
      }),
    };
    const otherProvider = {
      setContractAddress: vi.fn(),
    };
    const deployedContract = {
      deployTxData: { public: { contractAddress: deployedContractAddress } },
    };
    vi.mocked(deployContract).mockResolvedValue(deployedContract as any);

    const deployment = deploy(
      { privateStateProvider: deployingProvider } as any,
      privateState,
    );
    await saveStart;

    expect(() =>
      bindPrivateStateProvider(
        { privateStateProvider: otherProvider } as any,
        deployedContractAddress,
      ),
    ).toThrow(PendingControllerPrivateStateBusyError);
    expect(otherProvider.setContractAddress).not.toHaveBeenCalled();

    releaseSave();
    await expect(deployment).resolves.toBe(deployedContract);
    expect(() =>
      bindPrivateStateProvider(
        { privateStateProvider: otherProvider } as any,
        deployedContractAddress,
      ),
    ).not.toThrow();
  });
});
