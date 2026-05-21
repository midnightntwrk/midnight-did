import "./polyfills.js";

import * as ledger from "@midnight-ntwrk/ledger-v8";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {
  type MidnightProvider,
  type WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { Buffer } from "buffer";
import * as Rx from "rxjs";

import { type Config, contractConfig } from "./config.js";
import {
  type MidnightDIDCircuits,
  type MidnightDIDWalletContext,
} from "./types.js";

// Manual transaction intent signing works around an upstream SDK signing gap.
const signTransactionIntents = (
  tx: { intents?: Map<number, { serialize: () => Uint8Array }> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: "proof" | "pre-proof",
): void => {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize(
      "signature",
      proofMarker,
      "pre-binding",
      intent.serialize(),
    );

    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer =
        cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer =
        cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
};

export const createWalletAndMidnightProvider = async (
  ctx: MidnightDIDWalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx as any,
        {
          shieldedSecretKeys: ctx.shieldedSecretKeys as any,
          dustSecretKey: ctx.dustSecretKey as any,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      const signFn = (payload: Uint8Array) =>
        ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, "proof");
      if (recipe.balancingTransaction) {
        signTransactionIntents(
          recipe.balancingTransaction,
          signFn,
          "pre-proof",
        );
      }

      return ctx.wallet.finalizeRecipe(recipe) as any;
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx as any) as any;
    },
  };
};

export const configureProviders = async (
  ctx: MidnightDIDWalletContext,
  config: Config,
) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<MidnightDIDCircuits>(
    contractConfig.zkConfigPath,
  );
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${toHex(
    Buffer.from(ctx.unshieldedKeystore.getSecretKey()),
  )}!A`;

  return {
    privateStateProvider: levelPrivateStateProvider({
      midnightDbName: config.midnightDbName,
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
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
