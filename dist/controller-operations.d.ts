import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";
import { type DeployedMidnightDIDContract, type MidnightDIDProviders } from "./types.js";
/**
 * Rotates the DID controller key to a freshly derived controller public key.
 *
 * The replacement secret is first written to a pending recovery slot, then
 * promoted to active private state after the transaction finalizes.
 */
export declare const rotateControllerKey: (didContract: DeployedMidnightDIDContract, providers: MidnightDIDProviders, newSecretKey?: Uint8Array) => Promise<FinalizedTxData>;
