import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
export const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer, }) => ({
    networkId: getNetworkId(),
    indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
    provingServerUrl: new URL(proofServer),
    relayURL: new URL(node.replace(/^http/, "ws")),
});
export const buildUnshieldedConfig = ({ indexer, indexerWS }, txHistoryStorage) => ({
    networkId: getNetworkId(),
    indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
    txHistoryStorage,
});
export const buildDustConfig = ({ indexer, indexerWS, node, proofServer, }) => ({
    networkId: getNetworkId(),
    costParameters: {
        additionalFeeOverhead: 300000000000000n,
        feeBlocksMargin: 5,
    },
    indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
    provingServerUrl: new URL(proofServer),
    relayURL: new URL(node.replace(/^http/, "ws")),
});
//# sourceMappingURL=wallet-sdk-config.js.map