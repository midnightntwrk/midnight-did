import { webcrypto } from "node:crypto";

import { unshieldedToken } from "@midnight-ntwrk/ledger-v7";
import type { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { type Logger } from "pino";
import * as Rx from "rxjs";

let logger: Pick<Logger, "info"> = {
  info: () => undefined,
};

export async function hashProverKey(
  proverKey: Uint8Array,
): Promise<Uint8Array> {
  const hash = await webcrypto.subtle.digest("SHA-256", proverKey);
  return new Uint8Array(hash);
}

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.tap((state) => {
        logger.info(`Waiting for sync... isSynced=${state.isSynced}`);
      }),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.tap((state) => {
        const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
        logger.info(`Waiting for funds... balance=${balance}`);
      }),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  webcrypto.getRandomValues(bytes);
  return bytes;
};

export function setLightweightLogger(_logger: Logger) {
  logger = _logger;
}
