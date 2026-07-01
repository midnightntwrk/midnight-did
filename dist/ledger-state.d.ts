import { type ContractAddress } from "@midnight-ntwrk/midnight-did/midnight";
import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { type DeployedMidnightDIDContract, type MidnightDIDProviders } from "./types.js";
export declare const getMidnightDIDLedgerState: (providers: MidnightDIDProviders, contractAddress: ContractAddress) => Promise<DIDContract.Ledger | null>;
export declare const requireMidnightDIDLedgerState: (providers: MidnightDIDProviders, contractAddress: ContractAddress) => Promise<DIDContract.Ledger>;
export declare const requireDeployedMidnightDIDLedgerState: (providers: MidnightDIDProviders, didContract: DeployedMidnightDIDContract) => Promise<DIDContract.Ledger>;
