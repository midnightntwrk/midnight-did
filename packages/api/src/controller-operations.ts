import {
  deriveControllerPublicKey,
  DIDContract,
  signControllerAuthorization,
} from "@midnight-ntwrk/midnight-did-contract";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { getLogger } from "./api-logger.js";
import {
  asSchnorrJubjubDigest,
  createControllerAuthorization,
} from "./controller-authorization.js";
import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
import { randomBytes } from "./lightweight.js";
import {
  clearPendingControllerPrivateState,
  requirePrivateState,
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
  recoverySecretKey?: Uint8Array,
): MidnightDIDPrivateState => {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
    throw new Error("DID controller secret key must be 32 bytes");
  }
  if (
    recoverySecretKey !== undefined &&
    (!(recoverySecretKey instanceof Uint8Array) ||
      recoverySecretKey.length !== 32)
  ) {
    throw new Error("DID recovery secret key must be 32 bytes");
  }

  return {
    recoverySecretKey:
      recoverySecretKey === undefined
        ? undefined
        : new Uint8Array(recoverySecretKey),
    secretKey: new Uint8Array(secretKey),
  };
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
  const currentPrivateState = await requirePrivateState(providers);
  const nextPrivateState = privateStateFromSecret(
    newSecretKey,
    currentPrivateState.recoverySecretKey,
  );
  const nextControllerPublicKey = deriveControllerPublicKey(
    nextPrivateState.secretKey,
  );

  await savePendingControllerPrivateState(providers, nextPrivateState);

  let finalized = false;
  try {
    const [signature, expectedVersion] = await createControllerAuthorization(
      didContract,
      providers,
      (ledgerState) =>
        asSchnorrJubjubDigest(
          DIDContract.pureCircuits.rotateControllerKeyAuthorizationDigest(
            ledgerState.id,
            ledgerState.version,
            nextControllerPublicKey,
          ),
        ),
    );
    const result = await didContract.callTx.rotateControllerKey(
      nextControllerPublicKey,
      signature,
      expectedVersion,
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

/**
 * Rotates the DID controller key using the on-ledger recovery public key.
 *
 * Prototype note: the recovery key is intentionally narrow. It can only rotate
 * the controller key; it cannot mutate the DID document or rotate itself.
 */
export const recoverControllerKey = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  newSecretKey: Uint8Array = randomBytes(32),
): Promise<FinalizedTxData> => {
  const currentPrivateState = await requirePrivateState(providers);
  if (currentPrivateState.recoverySecretKey === undefined) {
    throw new Error("DID recovery private state is missing");
  }
  const nextPrivateState = privateStateFromSecret(
    newSecretKey,
    currentPrivateState.recoverySecretKey,
  );
  const nextControllerPublicKey = deriveControllerPublicKey(
    nextPrivateState.secretKey,
  );

  await savePendingControllerPrivateState(providers, nextPrivateState);

  let finalized = false;
  try {
    const ledgerState = await requireDeployedMidnightDIDLedgerState(
      providers,
      didContract,
    );
    const digest = asSchnorrJubjubDigest(
      DIDContract.pureCircuits.recoverControllerKeyAuthorizationDigest(
        ledgerState.id,
        ledgerState.version,
        nextControllerPublicKey,
      ),
    );
    const signature = signControllerAuthorization(
      currentPrivateState.recoverySecretKey,
      digest,
    );
    const result = await didContract.callTx.recoverControllerKey(
      nextControllerPublicKey,
      signature,
      ledgerState.version,
    );
    finalized = true;

    await savePrivateState(providers, nextPrivateState);
    try {
      await clearPendingControllerPrivateState(providers);
    } catch (error: unknown) {
      getLogger().warn(
        { error },
        "Controller recovery finalized, but pending private state cleanup failed.",
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
          "Controller recovery failed before finalization, and pending private state cleanup failed.",
        );
      }
    } else {
      getLogger().error(
        { error },
        "Controller recovery finalized, but active private state promotion failed. Use recoverPendingControllerPrivateState() before submitting further controller operations.",
      );
    }
    throw error;
  }
};
