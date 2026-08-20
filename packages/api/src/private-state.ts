import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";

import { MidnightDidApiError } from "./api-errors.js";
import { getLogger } from "./api-logger.js";
import { randomBytes } from "./lightweight.js";
import {
  MidnightDIDPendingControllerPrivateStateId,
  type MidnightDIDPrivateState,
  MidnightDIDPrivateStateId,
  type MidnightDIDPrivateStateIds,
  type MidnightDIDProviders,
} from "./types.js";

const isContractAddressUnsetError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("Contract address not set");

type ControllerPrivateState = MidnightDIDPrivateState & {
  readonly secretKey: Uint8Array;
};

export type PendingControllerPrivateStateErrorCode =
  | "pending_controller_private_state_busy"
  | "pending_controller_private_state_exists"
  | "pending_controller_private_state_missing_or_malformed";

/** Raised when another pending-controller lifecycle holds the process-local lock. */
export class PendingControllerPrivateStateBusyError extends MidnightDidApiError<
  Extract<
    PendingControllerPrivateStateErrorCode,
    "pending_controller_private_state_busy"
  >
> {
  constructor() {
    super(
      "pending_controller_private_state_busy",
      "Pending controller private state is busy with another rotation, recovery, or reconciliation; wait for that operation to finish before retrying",
    );
    this.name = "PendingControllerPrivateStateBusyError";
  }
}

/**
 * Raised when a controller rotation/recovery candidate is already pending.
 *
 * The existing candidate must be reconciled against the on-ledger controller
 * key before another candidate can be persisted.
 */
export class PendingControllerPrivateStateExistsError extends MidnightDidApiError<
  Extract<
    PendingControllerPrivateStateErrorCode,
    "pending_controller_private_state_exists"
  >
> {
  constructor() {
    super(
      "pending_controller_private_state_exists",
      "Pending controller private state already exists; reconcile it against the on-ledger controllerPublicKey before starting another rotation or recovery",
    );
    this.name = "PendingControllerPrivateStateExistsError";
  }
}

/** Raised when required pending controller state is absent or invalid. */
export class PendingControllerPrivateStateUnavailableError extends MidnightDidApiError<
  Extract<
    PendingControllerPrivateStateErrorCode,
    "pending_controller_private_state_missing_or_malformed"
  >
> {
  constructor() {
    super(
      "pending_controller_private_state_missing_or_malformed",
      "Pending controller private state is missing or malformed; start a controller rotation or recovery when no candidate exists, recover only a valid retained candidate after confirmed finalization, or discard any retained record only after confirmed non-finalization",
    );
    this.name = "PendingControllerPrivateStateUnavailableError";
  }
}

// bindPrivateStateProvider records canonical per-contract keys so separate
// wrappers bound to one DID share a process-local lock. Explicitly unbound
// providers fall back to wrapper identity. The provider API has no CAS, so this
// cannot coordinate separate processes or independently unbound wrappers.
const pendingControllerContractLockKeys = new WeakMap<object, string>();
const pendingControllerStateReservations = new Set<object | string>();

const pendingControllerLockKey = (providers: MidnightDIDProviders) => {
  const provider = providers.privateStateProvider;
  return pendingControllerContractLockKeys.get(provider) ?? provider;
};

export async function withPendingControllerPrivateStateLock<Result>(
  providers: MidnightDIDProviders,
  operation: () => Promise<Result>,
): Promise<Result> {
  const lockKey = pendingControllerLockKey(providers);
  if (pendingControllerStateReservations.has(lockKey)) {
    throw new PendingControllerPrivateStateBusyError();
  }

  pendingControllerStateReservations.add(lockKey);
  try {
    return await operation();
  } finally {
    pendingControllerStateReservations.delete(lockKey);
  }
}

export const isRestorableDIDPrivateState = (
  privateState: MidnightDIDPrivateState | null | undefined,
): privateState is ControllerPrivateState =>
  privateState != null &&
  privateState.secretKey instanceof Uint8Array &&
  privateState.secretKey.length === 32 &&
  (privateState.recoverySecretKey === undefined ||
    (privateState.recoverySecretKey instanceof Uint8Array &&
      privateState.recoverySecretKey.length === 32));

export const isRecoverableDIDPrivateState = (
  privateState: unknown,
): privateState is MidnightDIDPrivateState & {
  readonly recoverySecretKey: Uint8Array;
} =>
  privateState != null &&
  typeof privateState === "object" &&
  "recoverySecretKey" in privateState &&
  privateState.recoverySecretKey instanceof Uint8Array &&
  privateState.recoverySecretKey.length === 32;

export const isAttachableDIDPrivateState = (
  privateState: MidnightDIDPrivateState | null | undefined,
): privateState is MidnightDIDPrivateState =>
  isRestorableDIDPrivateState(privateState) ||
  isRecoverableDIDPrivateState(privateState);

export const bindPrivateStateProvider = (
  providers: MidnightDIDProviders,
  contractAddress: string,
): void => {
  const canonicalContractAddress = parseContractAddress(contractAddress);
  const currentLockKey = pendingControllerLockKey(providers);
  const requestedLockKey = `contract:${canonicalContractAddress}`;
  if (
    pendingControllerStateReservations.has(currentLockKey) ||
    pendingControllerStateReservations.has(requestedLockKey)
  ) {
    throw new PendingControllerPrivateStateBusyError();
  }

  providers.privateStateProvider.setContractAddress(canonicalContractAddress);
  pendingControllerContractLockKeys.set(
    providers.privateStateProvider,
    requestedLockKey,
  );
};

export async function restorePrivateState(
  providers: MidnightDIDProviders,
  privateStateId: MidnightDIDPrivateStateIds = MidnightDIDPrivateStateId,
): Promise<MidnightDIDPrivateState | null> {
  let providedPrivateState: MidnightDIDPrivateState | null = null;
  try {
    providedPrivateState =
      await providers.privateStateProvider.get(privateStateId);
  } catch (error: unknown) {
    if (!isContractAddressUnsetError(error)) {
      throw error;
    }
    getLogger().info(
      "Private state restore skipped (contract address not set yet).",
    );
  }
  if (isRestorableDIDPrivateState(providedPrivateState)) {
    getLogger().info(
      "The private state is restored from the privateStateProvider",
    );
    return providedPrivateState;
  }

  return null;
}

export async function restoreRecoverySecretKey(
  providers: MidnightDIDProviders,
  privateStateId: MidnightDIDPrivateStateIds = MidnightDIDPrivateStateId,
): Promise<Uint8Array | null> {
  let providedPrivateState: unknown = null;
  try {
    providedPrivateState =
      await providers.privateStateProvider.get(privateStateId);
  } catch (error: unknown) {
    if (!isContractAddressUnsetError(error)) {
      throw error;
    }
    getLogger().info(
      "Recovery private state restore skipped (contract address not set yet).",
    );
  }
  if (!isRecoverableDIDPrivateState(providedPrivateState)) {
    return null;
  }
  return providedPrivateState.recoverySecretKey;
}

export async function requireRecoverySecretKey(
  providers: MidnightDIDProviders,
  privateStateId: MidnightDIDPrivateStateIds = MidnightDIDPrivateStateId,
): Promise<Uint8Array> {
  const recoverySecretKey = await restoreRecoverySecretKey(
    providers,
    privateStateId,
  );
  if (recoverySecretKey == null) {
    throw new Error(
      "DID recovery private state is missing or malformed; import the recovery secret before using recovery",
    );
  }
  return recoverySecretKey;
}

export async function requirePrivateState(
  providers: MidnightDIDProviders,
  privateStateId: MidnightDIDPrivateStateIds = MidnightDIDPrivateStateId,
): Promise<ControllerPrivateState> {
  const privateState = await restorePrivateState(providers, privateStateId);
  if (!isRestorableDIDPrivateState(privateState)) {
    throw new Error(
      "DID controller private state is missing or malformed; import the controller secret before using controller operations",
    );
  }
  return privateState;
}

export async function requireAttachablePrivateState(
  providers: MidnightDIDProviders,
  privateStateId: MidnightDIDPrivateStateIds = MidnightDIDPrivateStateId,
): Promise<MidnightDIDPrivateState> {
  let providedPrivateState: MidnightDIDPrivateState | null = null;
  try {
    providedPrivateState =
      await providers.privateStateProvider.get(privateStateId);
  } catch (error: unknown) {
    if (!isContractAddressUnsetError(error)) {
      throw error;
    }
    getLogger().info(
      "Private state restore skipped (contract address not set yet).",
    );
  }
  if (!isAttachableDIDPrivateState(providedPrivateState)) {
    throw new Error(
      "DID private state is missing or malformed; import a controller or recovery secret before joining this contract",
    );
  }
  return providedPrivateState;
}

export interface RecoverPendingControllerPrivateStateOptions {
  readonly rotationFinalized: true;
}

export interface DiscardPendingControllerPrivateStateOptions {
  readonly rotationFinalized: false;
}

export async function savePrivateState(
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
  privateStateId: MidnightDIDPrivateStateIds = MidnightDIDPrivateStateId,
): Promise<void> {
  await providers.privateStateProvider.set(privateStateId, privateState);
}

export async function initPrivateState(
  providers: MidnightDIDProviders,
): Promise<MidnightDIDPrivateState> {
  const providedPrivateState = await restorePrivateState(providers);
  if (isRestorableDIDPrivateState(providedPrivateState)) {
    return providedPrivateState;
  }

  getLogger().info("Creating the new private state..");
  const secretKey = randomBytes(32);
  const recoverySecretKey = randomBytes(32);
  const privateState: MidnightDIDPrivateState = {
    recoverySecretKey,
    secretKey,
  };
  try {
    await savePrivateState(providers, privateState);
  } catch (error: unknown) {
    if (isContractAddressUnsetError(error)) {
      getLogger().info(
        "Private state save skipped (contract address not set yet).",
      );
    } else {
      throw error;
    }
  }
  return privateState;
}

export async function savePendingControllerPrivateStateWithinLock(
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<void> {
  const provider = providers.privateStateProvider;
  const existing = await provider.get(
    MidnightDIDPendingControllerPrivateStateId,
  );
  if (existing != null) {
    throw new PendingControllerPrivateStateExistsError();
  }
  await provider.set(MidnightDIDPendingControllerPrivateStateId, privateState);
}

export async function savePendingControllerPrivateState(
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<void> {
  await withPendingControllerPrivateStateLock(providers, () =>
    savePendingControllerPrivateStateWithinLock(providers, privateState),
  );
}

export async function clearPendingControllerPrivateState(
  providers: MidnightDIDProviders,
): Promise<void> {
  await providers.privateStateProvider.remove(
    MidnightDIDPendingControllerPrivateStateId,
  );
}

export async function requirePendingControllerPrivateState(
  providers: MidnightDIDProviders,
): Promise<ControllerPrivateState> {
  const privateState = await restorePrivateState(
    providers,
    MidnightDIDPendingControllerPrivateStateId,
  );
  if (!isRestorableDIDPrivateState(privateState)) {
    throw new PendingControllerPrivateStateUnavailableError();
  }
  return privateState;
}

export async function discardPendingControllerPrivateState(
  providers: MidnightDIDProviders,
  options?: DiscardPendingControllerPrivateStateOptions,
): Promise<void> {
  if (options?.rotationFinalized !== false) {
    throw new Error(
      "Pending controller private state can only be discarded after confirming the key-rotation transaction did not finalize",
    );
  }
  await withPendingControllerPrivateStateLock(providers, async () => {
    let pendingPrivateState: unknown = null;
    try {
      pendingPrivateState = await providers.privateStateProvider.get(
        MidnightDIDPendingControllerPrivateStateId,
      );
    } catch (error: unknown) {
      if (!isContractAddressUnsetError(error)) {
        throw error;
      }
      getLogger().info(
        "Pending private state restore skipped (contract address not set yet).",
      );
    }
    if (pendingPrivateState == null) {
      throw new PendingControllerPrivateStateUnavailableError();
    }
    await clearPendingControllerPrivateState(providers);
  });
}

export async function recoverPendingControllerPrivateState(
  providers: MidnightDIDProviders,
  options?: RecoverPendingControllerPrivateStateOptions,
): Promise<MidnightDIDPrivateState> {
  if (options?.rotationFinalized !== true) {
    throw new Error(
      "Pending controller private state can only be recovered after confirming the key-rotation transaction finalized",
    );
  }
  return withPendingControllerPrivateStateLock(providers, async () => {
    const pendingPrivateState =
      await requirePendingControllerPrivateState(providers);
    await savePrivateState(providers, pendingPrivateState);
    try {
      await clearPendingControllerPrivateState(providers);
    } catch (error: unknown) {
      getLogger().warn(
        { error },
        "Pending controller private state was promoted, but pending private state cleanup failed.",
      );
    }
    return pendingPrivateState;
  });
}
