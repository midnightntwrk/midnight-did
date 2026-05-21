import {
  levelPrivateStateProvider,
  type LevelPrivateStateProviderConfig,
} from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

import { type Config, contractConfig } from "./config.js";
import {
  type MidnightDIDPrivateState,
  MidnightDIDPrivateStateId,
  type MidnightDIDProviders,
  type MidnightDIDWalletContext,
} from "./types.js";

// Kept from the original SDK wiring: the level provider expects a password
// shape with at least one non-hex suffix character.
const PRIVATE_STORAGE_PASSWORD_SUFFIX = "!A";

type DIDPrivateStateProviderOptions = Partial<LevelPrivateStateProviderConfig> &
  Pick<
    LevelPrivateStateProviderConfig,
    "accountId" | "privateStoragePasswordProvider"
  >;

export const derivePrivateStoragePassword = (secretKey: Uint8Array): string =>
  `${toHex(secretKey)}${PRIVATE_STORAGE_PASSWORD_SUFFIX}`;

export const createPrivateStateProviderOptions = (
  ctx: Pick<MidnightDIDWalletContext, "unshieldedKeystore">,
  config: Pick<Config, "midnightDbName">,
  accountId: string,
): DIDPrivateStateProviderOptions => {
  const storagePassword = derivePrivateStoragePassword(
    ctx.unshieldedKeystore.getSecretKey(),
  );

  return {
    midnightDbName: config.midnightDbName,
    privateStateStoreName: contractConfig.privateStateStoreName,
    accountId,
    privateStoragePasswordProvider: () => storagePassword,
  };
};

export const createDIDPrivateStateProvider = (
  ctx: Pick<MidnightDIDWalletContext, "unshieldedKeystore">,
  config: Pick<Config, "midnightDbName">,
  accountId: string,
): MidnightDIDProviders["privateStateProvider"] =>
  levelPrivateStateProvider<
    typeof MidnightDIDPrivateStateId,
    MidnightDIDPrivateState
  >(createPrivateStateProviderOptions(ctx, config, accountId));
