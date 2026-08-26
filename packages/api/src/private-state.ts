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

// Exact upstream level-private-state-provider error contract for get/set/remove
// before setContractAddress(). Do not classify decorated storage/I/O failures as
// an unbound provider merely because they repeat part of this message.
const CONTRACT_ADDRESS_UNSET_ERROR_MESSAGE =
  "Contract address not set. Call setContractAddress() before accessing private state.";

const isContractAddressUnsetError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message === CONTRACT_ADDRESS_UNSET_ERROR_MESSAGE;

type ControllerPrivateState = MidnightDIDPrivateState & {
  readonly secretKey: Uint8Array;
};

export type PrivateStateProviderContractMismatchErrorCode =
  "private_state_provider_contract_mismatch";

/** Raised when a provider tracked by the API is bound to another DID. */
export class PrivateStateProviderContractMismatchError extends MidnightDidApiError<PrivateStateProviderContractMismatchErrorCode> {
  constructor(
    readonly expectedContractAddress: string,
    readonly actualContractAddress: string,
  ) {
    super(
      "private_state_provider_contract_mismatch",
      `Private-state provider contract mismatch: expected ${expectedContractAddress}, but the provider is bound to ${actualContractAddress}`,
    );
    this.name = "PrivateStateProviderContractMismatchError";
  }
}

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
// wrappers bound to one DID share a process-local lock. Wrapper-identity fallback
// is only for internal/deep unbound use. The provider has no atomic conditional
// write, so external per-DID coordination is required across processes, direct
// provider mutation, or independently unbound wrappers.
const privateStateProviderContractAddresses = new WeakMap<object, string>();
const pendingControllerContractLockKeys = new WeakMap<object, string>();
const privateStateProviderReservations = new Map<object | string, object>();

const pendingControllerLockKey = (providers: MidnightDIDProviders) => {
  const provider = providers.privateStateProvider;
  return pendingControllerContractLockKeys.get(provider) ?? provider;
};

export interface PrivateStateProviderLease {
  readonly owner: object;
  readonly keys: Set<object | string>;
}

const reservePrivateStateProviderKey = (
  lease: PrivateStateProviderLease,
  key: object | string,
): void => {
  const currentOwner = privateStateProviderReservations.get(key);
  if (currentOwner !== undefined && currentOwner !== lease.owner) {
    throw new PendingControllerPrivateStateBusyError();
  }
  if (currentOwner === undefined) {
    privateStateProviderReservations.set(key, lease.owner);
    lease.keys.add(key);
  }
};

/**
 * Acquires synchronously or fails busy; it never queues behind an owner. The
 * reservation is released only after the operation settles, because releasing
 * it while provider or transaction work continues would permit concurrent
 * private-state mutation.
 */
export async function withPrivateStateProviderLease<Result>(
  providers: MidnightDIDProviders,
  operation: (lease: PrivateStateProviderLease) => Promise<Result>,
): Promise<Result> {
  const lease: PrivateStateProviderLease = {
    owner: {},
    keys: new Set<object | string>(),
  };
  reservePrivateStateProviderKey(lease, pendingControllerLockKey(providers));
  try {
    return await operation(lease);
  } finally {
    for (const key of lease.keys) {
      if (privateStateProviderReservations.get(key) === lease.owner) {
        privateStateProviderReservations.delete(key);
      }
    }
  }
}

export async function withPendingControllerPrivateStateLock<Result>(
  providers: MidnightDIDProviders,
  operation: () => Promise<Result>,
): Promise<Result> {
  return withPrivateStateProviderLease(providers, operation);
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

const canonicalContractLockKey = (contractAddress: string): string =>
  `contract:${contractAddress}`;

const recordPrivateStateProviderBinding = (
  providers: MidnightDIDProviders,
  canonicalContractAddress: string,
): void => {
  const provider = providers.privateStateProvider;
  privateStateProviderContractAddresses.set(provider, canonicalContractAddress);
  pendingControllerContractLockKeys.set(
    provider,
    canonicalContractLockKey(canonicalContractAddress),
  );
};

export const bindPrivateStateProvider = (
  providers: MidnightDIDProviders,
  contractAddress: string,
): void => {
  const canonicalContractAddress = parseContractAddress(contractAddress);
  const currentLockKey = pendingControllerLockKey(providers);
  const requestedLockKey = canonicalContractLockKey(canonicalContractAddress);
  if (
    privateStateProviderReservations.has(currentLockKey) ||
    privateStateProviderReservations.has(requestedLockKey)
  ) {
    throw new PendingControllerPrivateStateBusyError();
  }

  providers.privateStateProvider.setContractAddress(canonicalContractAddress);
  recordPrivateStateProviderBinding(providers, canonicalContractAddress);
};

export const bindPrivateStateProviderWithinLease = (
  providers: MidnightDIDProviders,
  contractAddress: string,
  lease: PrivateStateProviderLease,
): void => {
  const canonicalContractAddress = parseContractAddress(contractAddress);
  const currentLockKey = pendingControllerLockKey(providers);
  if (privateStateProviderReservations.get(currentLockKey) !== lease.owner) {
    throw new PendingControllerPrivateStateBusyError();
  }
  reservePrivateStateProviderKey(
    lease,
    canonicalContractLockKey(canonicalContractAddress),
  );
  providers.privateStateProvider.setContractAddress(canonicalContractAddress);
  recordPrivateStateProviderBinding(providers, canonicalContractAddress);
};

/**
 * Synchronously binds an API-untracked provider to the expected DID, or rejects
 * a known binding mismatch without touching provider storage.
 */
export const bindOrAssertPrivateStateProvider = (
  providers: MidnightDIDProviders,
  contractAddress: string,
): void => {
  const expectedContractAddress = parseContractAddress(contractAddress);
  const actualContractAddress = privateStateProviderContractAddresses.get(
    providers.privateStateProvider,
  );
  // A lifecycle may temporarily own both the provider's source binding and a
  // new target binding. Report that ownership before a transient mismatch so a
  // competing source/target operation fails busy without provider mutation.
  if (
    privateStateProviderReservations.has(pendingControllerLockKey(providers))
  ) {
    throw new PendingControllerPrivateStateBusyError();
  }
  if (
    actualContractAddress !== undefined &&
    actualContractAddress !== expectedContractAddress
  ) {
    throw new PrivateStateProviderContractMismatchError(
      expectedContractAddress,
      actualContractAddress,
    );
  }
  if (actualContractAddress === undefined) {
    bindPrivateStateProvider(providers, expectedContractAddress);
  }
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
  readonly contractAddress: string;
  readonly rotationFinalized: true;
}

export interface DiscardPendingControllerPrivateStateOptions {
  readonly contractAddress: string;
  readonly rotationFinalized: false;
}

type PendingControllerConfirmationOperation = "discard" | "recover";

const assertPendingControllerConfirmation = (
  options:
    | DiscardPendingControllerPrivateStateOptions
    | RecoverPendingControllerPrivateStateOptions
    | undefined,
  operation: PendingControllerConfirmationOperation,
): void => {
  const rotationFinalized = operation === "recover";
  if (options?.rotationFinalized !== rotationFinalized) {
    const action = operation === "recover" ? "recovered" : "discarded";
    const outcome = rotationFinalized ? "finalized" : "did not finalize";
    throw new Error(
      `Pending controller private state can only be ${action} after confirming the key-rotation transaction ${outcome}`,
    );
  }
};

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
  options: DiscardPendingControllerPrivateStateOptions,
): Promise<void> {
  assertPendingControllerConfirmation(options, "discard");
  bindOrAssertPrivateStateProvider(providers, options.contractAddress);
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
  options: RecoverPendingControllerPrivateStateOptions,
): Promise<MidnightDIDPrivateState> {
  assertPendingControllerConfirmation(options, "recover");
  bindOrAssertPrivateStateProvider(providers, options.contractAddress);
  return withPendingControllerPrivateStateLock(providers, async () => {
    const pendingPrivateState =
      await requirePendingControllerPrivateState(providers);
    await savePrivateState(providers, pendingPrivateState);
    try {
      await clearPendingControllerPrivateState(providers);
    } catch (error: unknown) {
      getLogger().warn(
        { error },
        "Pending controller private state was promoted, but cleanup disposition could not be confirmed; the pending record may remain or may already have been removed.",
      );
    }
    return pendingPrivateState;
  });
}
