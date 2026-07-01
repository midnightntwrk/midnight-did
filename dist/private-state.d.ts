import { type MidnightDIDPrivateState, type MidnightDIDPrivateStateIds, type MidnightDIDProviders } from "./types.js";
export declare const isRestorableDIDPrivateState: (privateState: MidnightDIDPrivateState | null | undefined) => privateState is MidnightDIDPrivateState;
export declare const bindPrivateStateProvider: (providers: MidnightDIDProviders, contractAddress: string) => void;
export declare function restorePrivateState(providers: MidnightDIDProviders, privateStateId?: MidnightDIDPrivateStateIds): Promise<MidnightDIDPrivateState | null>;
export declare function requirePrivateState(providers: MidnightDIDProviders, privateStateId?: MidnightDIDPrivateStateIds): Promise<MidnightDIDPrivateState>;
export interface RecoverPendingControllerPrivateStateOptions {
    readonly rotationFinalized: true;
}
export declare function savePrivateState(providers: MidnightDIDProviders, privateState: MidnightDIDPrivateState, privateStateId?: MidnightDIDPrivateStateIds): Promise<void>;
export declare function initPrivateState(providers: MidnightDIDProviders): Promise<MidnightDIDPrivateState>;
export declare function savePendingControllerPrivateState(providers: MidnightDIDProviders, privateState: MidnightDIDPrivateState): Promise<void>;
export declare function clearPendingControllerPrivateState(providers: MidnightDIDProviders): Promise<void>;
export declare function recoverPendingControllerPrivateState(providers: MidnightDIDProviders, options?: RecoverPendingControllerPrivateStateOptions): Promise<MidnightDIDPrivateState>;
