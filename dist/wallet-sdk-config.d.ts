import { InMemoryTransactionHistoryStorage } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { type Config } from "./config.js";
export declare const buildShieldedConfig: ({ indexer, indexerWS, node, proofServer, }: Config) => {
    networkId: string;
    indexerClientConnection: {
        indexerHttpUrl: string;
        indexerWsUrl: string;
    };
    provingServerUrl: import("url").URL;
    relayURL: import("url").URL;
};
export declare const buildUnshieldedConfig: ({ indexer, indexerWS }: Config, txHistoryStorage: InMemoryTransactionHistoryStorage) => {
    networkId: string;
    indexerClientConnection: {
        indexerHttpUrl: string;
        indexerWsUrl: string;
    };
    txHistoryStorage: InMemoryTransactionHistoryStorage;
};
export declare const buildDustConfig: ({ indexer, indexerWS, node, proofServer, }: Config) => {
    networkId: string;
    costParameters: {
        additionalFeeOverhead: bigint;
        feeBlocksMargin: number;
    };
    indexerClientConnection: {
        indexerHttpUrl: string;
        indexerWsUrl: string;
    };
    provingServerUrl: import("url").URL;
    relayURL: import("url").URL;
};
