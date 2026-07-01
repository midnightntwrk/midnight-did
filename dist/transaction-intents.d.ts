import * as ledger from "@midnight-ntwrk/ledger-v8";
type SerializableIntent = {
    serialize: () => Uint8Array;
};
export type TransactionIntentContainer = {
    intents?: Map<number, SerializableIntent>;
};
export declare const signTransactionIntents: (tx: TransactionIntentContainer, signFn: (payload: Uint8Array) => ledger.Signature, proofMarker: "proof" | "pre-proof") => void;
export {};
