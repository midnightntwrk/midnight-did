import "./polyfills.js";

import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";

import { type Config, contractConfig } from "./config.js";
import { createDIDPrivateStateProvider } from "./private-state-storage.js";
import {
  type MidnightDIDCircuits,
  type MidnightDIDWalletContext,
} from "./types.js";
import { createWalletAndMidnightProvider } from "./wallet-provider.js";

export { createWalletAndMidnightProvider } from "./wallet-provider.js";

export const configureProviders = async (
  ctx: MidnightDIDWalletContext,
  config: Config,
) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<MidnightDIDCircuits>(
    contractConfig.zkConfigPath,
  );
  const accountId = walletAndMidnightProvider.getCoinPublicKey();

  return {
    privateStateProvider: createDIDPrivateStateProvider(ctx, config, accountId),
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      config.proofServer,
      zkConfigProvider,
    ),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};
