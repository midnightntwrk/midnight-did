import { type WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { type UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import * as Rx from "rxjs";

import { getLogger } from "./api-logger.js";

type NightCoinWithDustMetadata = {
  meta?: {
    registeredForDustGeneration?: boolean;
  };
};

export const filterUnregisteredNightUtxos = <
  T extends NightCoinWithDustMetadata,
>(
  nightUtxos: readonly T[],
): T[] =>
  nightUtxos.filter((coin) => coin.meta?.registeredForDustGeneration !== true);

const waitForDustBalance = async (wallet: WalletFacade): Promise<void> => {
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.dust.balance(new Date()) > 0n),
    ),
  );
};

export const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    getLogger().info(`Dust already available: ${dustBal}`);
    return;
  }

  const nightUtxos = filterUnregisteredNightUtxos(
    state.unshielded.availableCoins,
  );

  if (nightUtxos.length === 0) {
    getLogger().info("Waiting for existing dust generation...");
    await waitForDustBalance(wallet);
    return;
  }

  getLogger().info(
    `Registering ${nightUtxos.length} NIGHT UTXOs for dust generation`,
  );
  const recipe = await wallet.registerNightUtxosForDustGeneration(
    nightUtxos,
    unshieldedKeystore.getPublicKey(),
    (payload) => unshieldedKeystore.signData(payload),
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized as any);

  getLogger().info("Waiting for dust generation...");
  await waitForDustBalance(wallet);

  getLogger().info("Dust generation complete");
};
