import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { DIDContract, witnesses } from "@midnight-ntwrk/midnight-did-contract";

import { contractConfig } from "./config.js";
import { type MidnightDIDContract } from "./types.js";

export const midnightDIDCompiledContract = CompiledContract.make(
  "did",
  DIDContract.Contract as unknown as new (
    ...args: any[]
  ) => MidnightDIDContract,
).pipe(
  CompiledContract.withWitnesses(witnesses as never),
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

export const midnightDIDContractInstance: MidnightDIDContract =
  new (DIDContract.Contract as unknown as new (
    ...args: any[]
  ) => MidnightDIDContract)(witnesses);
