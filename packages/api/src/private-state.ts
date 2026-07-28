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

export const isRestorableDIDPrivateState = (
  privateState: MidnightDIDPrivateState | null | undefined,
): privateState is MidnightDIDPrivateState =>
  privateState != null &&
  privateState.secretKey instanceof Uint8Array &&
  privateState.secretKey.length === 32 &&
  (privateState.recoverySecretKey === undefined ||
    (privateState.recoverySecretKey instanceof Uint8Array &&
      privateState.recoverySecretKey.length === 32));

export const bindPrivateStateProvider = (
  providers: MidnightDIDProviders,
  contractAddress: string,
): void => {
  providers.privateStateProvider.setContractAddress(contractAddress);
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

export async function requirePrivateState(
  providers: MidnightDIDProviders,
  privateStateId: MidnightDIDPrivateStateIds = MidnightDIDPrivateStateId,
): Promise<MidnightDIDPrivateState> {
  const privateState = await restorePrivateState(providers, privateStateId);
  if (!isRestorableDIDPrivateState(privateState)) {
    throw new Error(
      "DID controller private state is missing or malformed; import the controller secret before using this contract",
    );
  }
  return privateState;
}

export interface RecoverPendingControllerPrivateStateOptions {
  readonly rotationFinalized: true;
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
  await savePrivateState(
    providers,
    privateState,
    MidnightDIDPendingControllerPrivateStateId,
  );
}

export async function clearPendingControllerPrivateState(
  providers: MidnightDIDProviders,
): Promise<void> {
  await providers.privateStateProvider.remove(
    MidnightDIDPendingControllerPrivateStateId,
  );
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
