import { type LevelPrivateStateProviderConfig } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { type Config } from "./config.js";
import { type MidnightDIDProviders, type MidnightDIDWalletContext } from "./types.js";
type DIDPrivateStateProviderOptions = Partial<LevelPrivateStateProviderConfig> & Pick<LevelPrivateStateProviderConfig, "accountId" | "privateStoragePasswordProvider">;
export declare const derivePrivateStoragePassword: (secretKey: Uint8Array) => string;
export declare const createPrivateStateProviderOptions: (ctx: Pick<MidnightDIDWalletContext, "unshieldedKeystore">, config: Pick<Config, "midnightDbName">, accountId: string) => DIDPrivateStateProviderOptions;
export declare const createDIDPrivateStateProvider: (ctx: Pick<MidnightDIDWalletContext, "unshieldedKeystore">, config: Pick<Config, "midnightDbName">, accountId: string) => MidnightDIDProviders["privateStateProvider"];
export {};
