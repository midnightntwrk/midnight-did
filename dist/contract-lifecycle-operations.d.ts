import { type DeployedMidnightDIDContract, type MidnightDIDPrivateState, type MidnightDIDProviders } from "./types.js";
export declare const joinContract: (providers: MidnightDIDProviders, contractAddress: string) => Promise<DeployedMidnightDIDContract>;
export declare const deploy: (providers: MidnightDIDProviders, privateState: MidnightDIDPrivateState) => Promise<DeployedMidnightDIDContract>;
export declare const createDID: (providers: MidnightDIDProviders, privateState: MidnightDIDPrivateState) => Promise<DeployedMidnightDIDContract>;
