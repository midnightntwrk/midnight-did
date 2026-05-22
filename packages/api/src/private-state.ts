import { getLogger } from "./api-logger.js";
import { hashProverKey } from "./lightweight.js";
import {
  type MidnightDIDPrivateState,
  MidnightDIDPrivateStateId,
  type MidnightDIDProviders,
} from "./types.js";

type ProvidersWithProverKey = MidnightDIDProviders & {
  zkConfigProvider: {
    getProverKey: (circuitName: string) => Promise<Uint8Array>;
  };
};

const isContractAddressUnsetError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("Contract address not set");

export const isRestorableDIDPrivateState = (
  privateState: MidnightDIDPrivateState | null | undefined,
): privateState is MidnightDIDPrivateState =>
  privateState != null &&
  privateState.secretKey instanceof Uint8Array &&
  privateState.secretKey.length === 32;

export async function initPrivateState(
  providers: MidnightDIDProviders,
): Promise<MidnightDIDPrivateState> {
  let providedPrivateState: MidnightDIDPrivateState | null = null;
  try {
    providedPrivateState = await providers.privateStateProvider.get(
      MidnightDIDPrivateStateId,
    );
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

  getLogger().info("Creating the new private state..");
  const proverKey = await (
    providers as ProvidersWithProverKey
  ).zkConfigProvider.getProverKey("addVerificationMethod");
  const secretKey = await hashProverKey(proverKey);
  const privateState: MidnightDIDPrivateState = { secretKey };
  try {
    await providers.privateStateProvider.set(
      MidnightDIDPrivateStateId,
      privateState,
    );
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
