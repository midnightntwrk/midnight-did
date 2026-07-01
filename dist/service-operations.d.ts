import { Service } from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";
import { type DeployedMidnightDIDContract } from "./types.js";
export declare const addService: (didContract: DeployedMidnightDIDContract, service: Service) => Promise<FinalizedTxData>;
export declare const updateService: (didContract: DeployedMidnightDIDContract, service: Service) => Promise<FinalizedTxData>;
export declare const removeService: (didContract: DeployedMidnightDIDContract, serviceId: string) => Promise<FinalizedTxData>;
