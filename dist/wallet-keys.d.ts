import { type UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
export declare const deriveMidnightWalletKeys: (seed: string) => Record<0 | 2 | 3, Uint8Array<ArrayBufferLike>>;
export type MidnightWalletKeys = ReturnType<typeof deriveMidnightWalletKeys>;
export declare const createUnshieldedKeystoreFromKeys: (keys: MidnightWalletKeys) => UnshieldedKeystore;
export declare const deriveUnshieldedAddressFromSeed: (seed: string) => string;
