import { MidnightNetwork } from "@midnight-ntwrk/midnight-did/midnight";
import { type BoundIdField } from "@midnight-ntwrk/midnight-did-domain";
import { type DeployedMidnightDIDContract } from "./types.js";
export declare const getMidnightNetwork: () => MidnightNetwork;
export declare const getDidSubject: (didContract: DeployedMidnightDIDContract) => string;
export declare const normalizeBoundFragmentId: (didContract: DeployedMidnightDIDContract, value: string, field: BoundIdField) => string;
