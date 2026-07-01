import { type WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { type UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
type NightCoinWithDustMetadata = {
    meta?: {
        registeredForDustGeneration?: boolean;
    };
};
export declare const filterUnregisteredNightUtxos: <T extends NightCoinWithDustMetadata>(nightUtxos: readonly T[]) => T[];
export declare const registerForDustGeneration: (wallet: WalletFacade, unshieldedKeystore: UnshieldedKeystore) => Promise<void>;
export {};
