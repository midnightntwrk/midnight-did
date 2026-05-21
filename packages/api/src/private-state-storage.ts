import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { Buffer } from "buffer";

import { type Config, contractConfig } from "./config.js";
import {
  type MidnightDIDPrivateState,
  MidnightDIDPrivateStateId,
  type MidnightDIDProviders,
  type MidnightDIDWalletContext,
} from "./types.js";

const PRIVATE_STORAGE_PASSWORD_SUFFIX = "!A";

export type DIDPrivateStateProviderOptions = {
  midnightDbName?: string;
  privateStateStoreName: string;
  accountId: string;
  privateStoragePasswordProvider: () => string;
};

export const derivePrivateStoragePassword = (secretKey: Uint8Array): string =>
  `${toHex(Buffer.from(secretKey))}${PRIVATE_STORAGE_PASSWORD_SUFFIX}`;

export const createPrivateStateProviderOptions = (
  ctx: MidnightDIDWalletContext,
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
  ctx: MidnightDIDWalletContext,
  config: Pick<Config, "midnightDbName">,
  accountId: string,
): MidnightDIDProviders["privateStateProvider"] =>
  levelPrivateStateProvider<
    typeof MidnightDIDPrivateStateId,
    MidnightDIDPrivateState
  >(createPrivateStateProviderOptions(ctx, config, accountId));
