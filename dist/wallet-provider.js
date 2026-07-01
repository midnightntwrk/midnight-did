import * as Rx from "rxjs";
import { signTransactionIntents } from "./transaction-intents.js";
export const createWalletAndMidnightProvider = async (ctx) => {
    const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
    return {
        getCoinPublicKey() {
            return state.shielded.coinPublicKey.toHexString();
        },
        getEncryptionPublicKey() {
            return state.shielded.encryptionPublicKey.toHexString();
        },
        async balanceTx(tx, ttl) {
            const recipe = await ctx.wallet.balanceUnboundTransaction(tx, {
                shieldedSecretKeys: ctx.shieldedSecretKeys,
                dustSecretKey: ctx.dustSecretKey,
            }, { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) });
            const signFn = (payload) => ctx.unshieldedKeystore.signData(payload);
            signTransactionIntents(recipe.baseTransaction, signFn, "proof");
            if (recipe.balancingTransaction) {
                signTransactionIntents(recipe.balancingTransaction, signFn, "pre-proof");
            }
            return ctx.wallet.finalizeRecipe(recipe);
        },
        submitTx(tx) {
            return ctx.wallet.submitTransaction(tx);
        },
    };
};
//# sourceMappingURL=wallet-provider.js.map