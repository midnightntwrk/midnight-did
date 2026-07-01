import { levelPrivateStateProvider, } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { contractConfig } from "./config.js";
// Kept from the original SDK wiring: the level provider expects a password
// shape with at least one non-hex suffix character.
const PRIVATE_STORAGE_PASSWORD_SUFFIX = "!A";
export const derivePrivateStoragePassword = (secretKey) => `${toHex(secretKey)}${PRIVATE_STORAGE_PASSWORD_SUFFIX}`;
export const createPrivateStateProviderOptions = (ctx, config, accountId) => {
    const storagePassword = derivePrivateStoragePassword(ctx.unshieldedKeystore.getSecretKey());
    return {
        midnightDbName: config.midnightDbName,
        privateStateStoreName: contractConfig.privateStateStoreName,
        accountId,
        privateStoragePasswordProvider: () => storagePassword,
    };
};
export const createDIDPrivateStateProvider = (ctx, config, accountId) => levelPrivateStateProvider(createPrivateStateProviderOptions(ctx, config, accountId));
//# sourceMappingURL=private-state-storage.js.map