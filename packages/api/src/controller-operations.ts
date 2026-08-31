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
  bindOrAssertPrivateStateProvider,
  clearPendingControllerPrivateState,
  requirePrivateState,
  requireRecoverySecretKey,
  restoreRecoverySecretKey,
  savePendingControllerPrivateStateWithinLock,
  savePrivateState,
  withPendingControllerPrivateStateLock,
} from "./private-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDPrivateState,
  type MidnightDIDProviders,
} from "./types.js";

const isJubjubPoint = (
  value: unknown,
): value is { readonly x: bigint; readonly y: bigint } =>
  value != null &&
  typeof value === "object" &&
  "x" in value &&
  "y" in value &&
  typeof value.x === "bigint" &&
  typeof value.y === "bigint";

const jubjubPointEquals = (
  left: { readonly x: bigint; readonly y: bigint },
  right: { readonly x: bigint; readonly y: bigint },
): boolean => left.x === right.x && left.y === right.y;

const validateAndCopyControllerSecretKey = (
  secretKey: Uint8Array,
): Uint8Array => {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
    throw new Error("DID controller secret key must be 32 bytes");
  }
  return new Uint8Array(secretKey);
};

const validateAndCopyRecoverySecretKey = (
  recoverySecretKey: Uint8Array,
): Uint8Array => {
  if (
    !(recoverySecretKey instanceof Uint8Array) ||
    recoverySecretKey.length !== 32
  ) {
    throw new Error("DID recovery secret key must be 32 bytes");
  }
  return new Uint8Array(recoverySecretKey);
};

const privateStateFromValidatedControllerSecret = (
  secretKey: Uint8Array,
  trustedRecoverySecretKey?: Uint8Array,
): MidnightDIDPrivateState & { readonly secretKey: Uint8Array } => ({
  ...(trustedRecoverySecretKey === undefined
    ? {}
    : { recoverySecretKey: new Uint8Array(trustedRecoverySecretKey) }),
  secretKey,
});

interface PendingControllerOperationMessages {
  readonly attemptedCallFailed: string;
  readonly cleanupFailed: string;
  readonly preCallCleanupFailed: string;
  readonly preCallFailed: string;
  readonly promotionFailed: string;
}

const runPendingControllerOperationWithinLock = async (
  providers: MidnightDIDProviders,
  nextPrivateState: MidnightDIDPrivateState,
  prepareCall: () => Promise<
    () => Promise<{ readonly public: FinalizedTxData }>
  >,
  messages: PendingControllerOperationMessages,
): Promise<FinalizedTxData> => {
  await savePendingControllerPrivateStateWithinLock(
    providers,
    nextPrivateState,
  );

  let callAttempted = false;
  let finalizedDataReceived = false;
  try {
    const callTx = await prepareCall();
    // This records only that callTx was invoked. A synchronous throw still
    // cannot establish whether dispatch or ledger finality occurred.
    callAttempted = true;
    const result = await callTx();
    finalizedDataReceived = true;

    await savePrivateState(providers, nextPrivateState);
    try {
      await clearPendingControllerPrivateState(providers);
    } catch (error: unknown) {
      getLogger().warn({ error }, messages.cleanupFailed);
    }

    return result.public;
  } catch (error: unknown) {
    if (callAttempted) {
      if (!finalizedDataReceived) {
        getLogger().warn(
          { callAttempted, error },
          messages.attemptedCallFailed,
        );
      } else {
        getLogger().error({ error }, messages.promotionFailed);
      }
    } else {
      try {
        // No transaction call was invoked, so this candidate cannot have
        // reached the ledger. Remove it while the same lease still owns the
        // DID instead of forcing unnecessary ledger reconciliation.
        await clearPendingControllerPrivateState(providers);
        getLogger().warn({ callAttempted, error }, messages.preCallFailed);
      } catch (cleanupError: unknown) {
        getLogger().warn(
          { callAttempted, cleanupError, error },
          messages.preCallCleanupFailed,
        );
      }
    }
    throw error;
  }
};

/**
 * Rotates the DID controller key to a freshly derived controller public key.
 *
 * The replacement secret is first written to a pending recovery slot, then
 * promoted to active private state after finalized transaction data returns.
 * Ambiguous submission/finality failures retain the pending slot so receipt
 * loss cannot destroy the only persisted copy of a finalized replacement key.
 */
export const rotateControllerKey = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  newSecretKey: Uint8Array = randomBytes(32),
): Promise<FinalizedTxData> => {
  bindOrAssertPrivateStateProvider(
    providers,
    didContract.deployTxData.public.contractAddress,
  );
  const validatedNewSecretKey =
    validateAndCopyControllerSecretKey(newSecretKey);

  return withPendingControllerPrivateStateLock(providers, async () => {
    const currentPrivateState = await requirePrivateState(providers);
    const nextPrivateState = privateStateFromValidatedControllerSecret(
      validatedNewSecretKey,
      currentPrivateState.recoverySecretKey,
    );
    const nextControllerPublicKey = deriveControllerPublicKey(
      nextPrivateState.secretKey,
    );

    return runPendingControllerOperationWithinLock(
      providers,
      nextPrivateState,
      async () => {
        const [signature, expectedVersion] =
          await createControllerAuthorization(
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
            undefined,
            currentPrivateState,
          );
        return () =>
          didContract.callTx.rotateControllerKey(
            nextControllerPublicKey,
            signature,
            expectedVersion,
          );
      },
      {
        attemptedCallFailed:
          "Controller key rotation call was attempted but did not return finalized transaction data. Pending private state was retained because the ledger outcome is unknown; after connectivity returns, obtain authoritative finalized ledger evidence and reconcile controllerPublicKey before retrying. Do not discard solely because an available read still shows the old key.",
        cleanupFailed:
          "Controller key rotation finalized and active private state was promoted, but cleanup disposition could not be confirmed; the pending record may remain or may already have been removed.",
        preCallCleanupFailed:
          "Controller key rotation failed before the transaction call was attempted, but pending-state cleanup disposition could not be confirmed; the candidate may remain or may already have been removed. If it remains, discard it with discardPendingControllerPrivateState(providers, { contractAddress, rotationFinalized: false }) before retrying.",
        preCallFailed:
          "Controller key rotation failed before the transaction call was attempted. The unsubmitted pending candidate was removed.",
        promotionFailed:
          "Controller key rotation finalized, but active private state promotion failed. Use recoverPendingControllerPrivateState(providers, { contractAddress, rotationFinalized: true }) before submitting further controller operations.",
      },
    );
  });
};

/**
 * Rotates the DID controller key using the on-ledger recovery public key.
 *
 * The recovery key is intentionally narrow: it can only rotate the controller
 * key; it cannot mutate the DID document or rotate itself. Pending replacement
 * state follows the same receipt-loss retention rule as controller rotation.
 */
export const recoverControllerKey = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  newSecretKey: Uint8Array = randomBytes(32),
  recoverySecretKey?: Uint8Array,
): Promise<FinalizedTxData> => {
  bindOrAssertPrivateStateProvider(
    providers,
    didContract.deployTxData.public.contractAddress,
  );
  const validatedNewSecretKey =
    validateAndCopyControllerSecretKey(newSecretKey);
  const validatedRecoverySecretKey =
    recoverySecretKey === undefined
      ? undefined
      : validateAndCopyRecoverySecretKey(recoverySecretKey);

  return withPendingControllerPrivateStateLock(providers, async () => {
    const [storedRecoverySecretKey, ledgerState] = await Promise.all([
      validatedRecoverySecretKey === undefined
        ? requireRecoverySecretKey(providers)
        : restoreRecoverySecretKey(providers),
      requireDeployedMidnightDIDLedgerState(providers, didContract),
    ]);
    const activeRecoverySecretKey =
      validatedRecoverySecretKey ?? storedRecoverySecretKey;
    if (activeRecoverySecretKey == null) {
      throw new Error(
        "DID recovery private state is missing or malformed; import the recovery secret before using recovery",
      );
    }
    if (!isJubjubPoint(ledgerState.recoveryAuthorityPublicKey)) {
      throw new Error(
        "DID contract does not expose a recovery authority; deploy or join a recovery-enabled contract",
      );
    }
    const recoveryAuthorityPublicKey = ledgerState.recoveryAuthorityPublicKey;
    const activeRecoveryPublicKey = deriveControllerPublicKey(
      activeRecoverySecretKey,
    );
    if (
      !jubjubPointEquals(activeRecoveryPublicKey, recoveryAuthorityPublicKey)
    ) {
      throw new Error(
        "DID recovery secret key does not match the on-ledger recovery authority",
      );
    }

    const persistedRecoverySecretKey =
      storedRecoverySecretKey != null &&
      jubjubPointEquals(
        deriveControllerPublicKey(storedRecoverySecretKey),
        recoveryAuthorityPublicKey,
      )
        ? storedRecoverySecretKey
        : undefined;
    const nextPrivateState = privateStateFromValidatedControllerSecret(
      validatedNewSecretKey,
      persistedRecoverySecretKey,
    );
    const nextControllerPublicKey = deriveControllerPublicKey(
      nextPrivateState.secretKey,
    );

    return runPendingControllerOperationWithinLock(
      providers,
      nextPrivateState,
      async () => {
        const digest = asSchnorrJubjubDigest(
          DIDContract.pureCircuits.recoverControllerKeyAuthorizationDigest(
            ledgerState.id,
            ledgerState.version,
            nextControllerPublicKey,
          ),
        );
        const signature = signControllerAuthorization(
          activeRecoverySecretKey,
          digest,
        );
        return () =>
          didContract.callTx.recoverControllerKey(
            nextControllerPublicKey,
            signature,
            ledgerState.version,
          );
      },
      {
        attemptedCallFailed:
          "Controller recovery call was attempted but did not return finalized transaction data. Pending private state was retained because the ledger outcome is unknown; after connectivity returns, obtain authoritative finalized ledger evidence and reconcile controllerPublicKey before retrying. Do not discard solely because an available read still shows the old key.",
        cleanupFailed:
          "Controller recovery finalized and active private state was promoted, but cleanup disposition could not be confirmed; the pending record may remain or may already have been removed.",
        preCallCleanupFailed:
          "Controller recovery failed before the transaction call was attempted, but pending-state cleanup disposition could not be confirmed; the candidate may remain or may already have been removed. If it remains, discard it with discardPendingControllerPrivateState(providers, { contractAddress, rotationFinalized: false }) before retrying.",
        preCallFailed:
          "Controller recovery failed before the transaction call was attempted. The unsubmitted pending candidate was removed.",
        promotionFailed:
          "Controller recovery finalized, but active private state promotion failed. Use recoverPendingControllerPrivateState(providers, { contractAddress, rotationFinalized: true }) before submitting further controller operations.",
      },
    );
  });
};
