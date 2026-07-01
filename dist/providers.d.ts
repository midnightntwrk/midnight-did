import "./polyfills.js";
import { type Config } from "./config.js";
import { type MidnightDIDCircuits, type MidnightDIDWalletContext } from "./types.js";
import { createWalletAndMidnightProvider } from "./wallet-provider.js";
export { createWalletAndMidnightProvider };
export declare const configureProviders: (ctx: MidnightDIDWalletContext, config: Config) => Promise<{
    privateStateProvider: import("@midnight-ntwrk/midnight-js-types").PrivateStateProvider<import("./types.js").MidnightDIDPrivateStateIds, import("@midnight-ntwrk/midnight-did-contract").DIDPrivateState>;
    publicDataProvider: import("@midnight-ntwrk/midnight-js-types").PublicDataProvider;
    zkConfigProvider: import("@midnight-ntwrk/midnight-js-node-zk-config-provider").NodeZkConfigProvider<MidnightDIDCircuits>;
    proofProvider: import("@midnight-ntwrk/midnight-js-types").ProofProvider;
    walletProvider: import("@midnight-ntwrk/midnight-js-types").WalletProvider & import("@midnight-ntwrk/midnight-js-types").MidnightProvider;
    midnightProvider: import("@midnight-ntwrk/midnight-js-types").WalletProvider & import("@midnight-ntwrk/midnight-js-types").MidnightProvider;
}>;
