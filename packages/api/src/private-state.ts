import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";

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

/**
 * Raised when a controller rotation/recovery candidate is already pending.
 *
 * The existing candidate must be reconciled against the on-ledger controller
 * key before another candidate can be persisted.
 */
export class PendingControllerPrivateStateExistsError extends Error {
  readonly code = "pending_controller_private_state_exists" as const;

  constructor() {
    super(
      "Pending controller private state already exists; reconcile it against the on-ledger controllerPublicKey before starting another rotation or recovery",
    );
    this.name = "PendingControllerPrivateStateExistsError";
  }
}

// The provider API has no compare-and-set operation. This reservation closes
// the in-process read-then-write race for callers sharing one provider object;
// the persistent pending slot closes blind retries and process restarts.
const pendingControllerStateReservations = new WeakSet<object>();

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
  providers.privateStateProvider.setContractAddress(
    parseContractAddress(contractAddress),
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

export async function savePendingControllerPrivateState(
  providers: MidnightDIDProviders,
  privateState: MidnightDIDPrivateState,
): Promise<void> {
  const provider = providers.privateStateProvider;
  if (pendingControllerStateReservations.has(provider)) {
    throw new PendingControllerPrivateStateExistsError();
  }

  pendingControllerStateReservations.add(provider);
  try {
    const existing = await provider.get(
      MidnightDIDPendingControllerPrivateStateId,
    );
    if (existing != null) {
      throw new PendingControllerPrivateStateExistsError();
    }
    await provider.set(
      MidnightDIDPendingControllerPrivateStateId,
      privateState,
    );
  } finally {
    pendingControllerStateReservations.delete(provider);
  }
}

export async function clearPendingControllerPrivateState(
  providers: MidnightDIDProviders,
): Promise<void> {
  await providers.privateStateProvider.remove(
    MidnightDIDPendingControllerPrivateStateId,
  );
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
  await requirePrivateState(
    providers,
    MidnightDIDPendingControllerPrivateStateId,
  );
  await clearPendingControllerPrivateState(providers);
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
  const pendingPrivateState = await requirePrivateState(
    providers,
    MidnightDIDPendingControllerPrivateStateId,
  );
  await savePrivateState(providers, pendingPrivateState);
  await clearPendingControllerPrivateState(providers);
  return pendingPrivateState;
}
