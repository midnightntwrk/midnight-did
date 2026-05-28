import { deriveControllerPublicKey } from "@midnight-ntwrk/midnight-did-contract";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { getLogger } from "./api-logger.js";
import { randomBytes } from "./lightweight.js";
import {
  clearPendingControllerPrivateState,
  savePendingControllerPrivateState,
  savePrivateState,
} from "./private-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDPrivateState,
  type MidnightDIDProviders,
} from "./types.js";

const privateStateFromSecret = (
  secretKey: Uint8Array,
): MidnightDIDPrivateState => {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
    throw new Error("DID controller secret key must be 32 bytes");
  }

  return { secretKey: new Uint8Array(secretKey) };
};

/**
 * Rotates the DID controller key to a freshly derived controller public key.
 *
 * The replacement secret is first written to a pending recovery slot, then
 * promoted to active private state after the transaction finalizes.
 */
export const rotateControllerKey = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  newSecretKey: Uint8Array = randomBytes(32),
): Promise<FinalizedTxData> => {
  const nextPrivateState = privateStateFromSecret(newSecretKey);
  const nextControllerPublicKey = deriveControllerPublicKey(
    nextPrivateState.secretKey,
  );

  await savePendingControllerPrivateState(providers, nextPrivateState);

  let finalized = false;
  try {
    const result = await didContract.callTx.rotateControllerKey(
      nextControllerPublicKey,
    );
    finalized = true;

    await savePrivateState(providers, nextPrivateState);
    try {
      await clearPendingControllerPrivateState(providers);
    } catch (error: unknown) {
      getLogger().warn(
        { error },
        "Controller key rotation finalized, but pending private state cleanup failed.",
      );
    }

    return result.public;
  } catch (error: unknown) {
    if (!finalized) {
      try {
        await clearPendingControllerPrivateState(providers);
      } catch (cleanupError: unknown) {
        getLogger().warn(
          { error: cleanupError },
          "Controller key rotation failed before finalization, and pending private state cleanup failed.",
        );
      }
    } else {
      getLogger().error(
        { error },
        "Controller key rotation finalized, but active private state promotion failed. Use recoverPendingControllerPrivateState() before submitting further controller operations.",
      );
    }
    throw error;
  }
};
