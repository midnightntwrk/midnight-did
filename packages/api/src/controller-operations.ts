import { deriveControllerPublicKey } from "@midnight-ntwrk/midnight-did-contract";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { randomBytes } from "./lightweight.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDPrivateState,
  MidnightDIDPrivateStateId,
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
 * The transaction finalizes before the new secret is written to private state.
 * If private-state persistence fails after finalization, the DID can be locked
 * unless the caller has retained the same `newSecretKey` for recovery.
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
  const result = await didContract.callTx.rotateControllerKey(
    nextControllerPublicKey,
  );

  await providers.privateStateProvider.set(
    MidnightDIDPrivateStateId,
    nextPrivateState,
  );

  return result.public;
};
