import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";
import { type DeployedMidnightDIDContract } from "./types.js";
export declare const addAlsoKnownAs: (didContract: DeployedMidnightDIDContract, aliasUri: string) => Promise<FinalizedTxData>;
export declare const removeAlsoKnownAs: (didContract: DeployedMidnightDIDContract, aliasUri: string) => Promise<FinalizedTxData>;
export declare const deactivate: (didContract: DeployedMidnightDIDContract) => Promise<FinalizedTxData>;
