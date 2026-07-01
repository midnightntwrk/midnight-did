import { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import { Ledger } from "./managed/did/contract/index.js";
export type DIDPrivateState = {
    readonly secretKey: Uint8Array;
};
export declare const witnesses: {
    localSecretKey: ({ privateState }: WitnessContext<Ledger, DIDPrivateState>) => [DIDPrivateState, Uint8Array];
    currentTimestamp: ({ privateState }: WitnessContext<Ledger, DIDPrivateState>) => [DIDPrivateState, bigint];
    getSchnorrReduction: ({ privateState }: WitnessContext<Ledger, DIDPrivateState>, challengeHash: bigint) => [DIDPrivateState, [bigint, bigint]];
};
//# sourceMappingURL=witnesses.d.ts.map