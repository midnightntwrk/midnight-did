import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { DIDContract, witnesses } from "@midnight-ntwrk/midnight-did-contract";
import { contractConfig } from "./config.js";
export const midnightDIDCompiledContract = CompiledContract.make("did", DIDContract.Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath));
export const midnightDIDContractInstance = new DIDContract.Contract(witnesses);
//# sourceMappingURL=contract-instance.js.map