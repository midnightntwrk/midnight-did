import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { type MidnightDIDContract } from "./types.js";
export declare const midnightDIDCompiledContract: CompiledContract.CompiledContract<DIDContract.Contract<import("@midnight-ntwrk/midnight-did-contract").DIDPrivateState, DIDContract.Witnesses<import("@midnight-ntwrk/midnight-did-contract").DIDPrivateState>> & {
    provableCircuits: DIDContract.ImpureCircuits<import("./types.js").MidnightDIDPrivateState>;
}, import("@midnight-ntwrk/midnight-did-contract").DIDPrivateState, never>;
export declare const midnightDIDContractInstance: MidnightDIDContract;
