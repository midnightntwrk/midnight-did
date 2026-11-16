import { type WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { type UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import * as Rx from "rxjs";

import { getLogger } from "./api-logger.js";

type NightCoinWithDustMetadata = {
  meta?: {
    registeredForDustGeneration?: boolean;
  };
};

export interface DustReadinessOptions {
  /**
   * Returns the timestamp of the latest indexed block the wallet is using.
   * SDK5 values spendable Dust at this indexed time, not at wall-clock time.
   * Use `createIndexerIndexedBlockTime` for the reference indexer adapter.
   */
  readonly indexedBlockTime: () => Promise<Date>;
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

export const filterUnregisteredNightUtxos = <
  T extends NightCoinWithDustMetadata,
>(
  nightUtxos: readonly T[],
): T[] =>
  nightUtxos.filter((coin) => coin.meta?.registeredForDustGeneration !== true);

const assertPositiveFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
};

const assertNonNegativeFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
};

const sleep = (
  ms: number,
  signal: AbortSignal | undefined,
  label: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(`${label} cancelled`));
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      if (signal && abortHandler)
        signal.removeEventListener("abort", abortHandler);
    };
    abortHandler = () => {
      cleanup();
      reject(new Error(`${label} cancelled`));
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    if (signal) {
      signal.addEventListener("abort", abortHandler, { once: true });
      if (signal.aborted) abortHandler();
    }
  });

const withDeadline = async <T>(
  operation: Promise<T>,
  deadline: number,
  signal: AbortSignal | undefined,
  label: string,
): Promise<T> => {
  if (signal?.aborted) throw new Error(`${label} cancelled`);
  const remaining = deadline - Date.now();
  if (remaining <= 0)
    throw new Error(`${label} exceeded dust readiness deadline`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} exceeded dust readiness deadline`)),
          remaining,
        );
      }),
      new Promise<never>((_resolve, reject) => {
        if (!signal) return;
        abortHandler = () => reject(new Error(`${label} cancelled`));
        signal.addEventListener("abort", abortHandler, { once: true });
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && abortHandler)
      signal.removeEventListener("abort", abortHandler);
  }
};

type WalletState =
  ReturnType<WalletFacade["state"]> extends Rx.Observable<infer T> ? T : never;

/**
 * Reads one wallet state with the deadline and cancellation enforced at the Rx
 * subscription itself. Promise.race alone would leave the subscription (and
 * its observer) alive after a timeout or abort.
 */
const readWalletState = (
  wallet: WalletFacade,
  deadline: number,
  signal: AbortSignal | undefined,
): Promise<WalletState> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("wallet state read cancelled"));
      return;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new Error("wallet state read exceeded dust readiness deadline"));
      return;
    }
    let settled = false;
    let subscription: { unsubscribe: () => void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      if (signal && abortHandler)
        signal.removeEventListener("abort", abortHandler);
    };
    const finish = (settle: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (subscription) subscription.unsubscribe();
      settle();
    };
    timer = setTimeout(
      () =>
        finish(() =>
          reject(
            new Error("wallet state read exceeded dust readiness deadline"),
          ),
        ),
      remaining,
    );
    if (signal) {
      abortHandler = () =>
        finish(() => reject(new Error("wallet state read cancelled")));
      signal.addEventListener("abort", abortHandler, { once: true });
      if (signal.aborted) abortHandler();
    }
    if (settled) return;
    try {
      subscription = wallet.state().subscribe({
        next: (state) => finish(() => resolve(state)),
        error: (error) => finish(() => reject(error)),
      });
      if (settled) subscription.unsubscribe();
    } catch (error) {
      finish(() => reject(error));
    }
  });

/**
 * Reads the latest indexed block timestamp from the indexer GraphQL endpoint.
 * This is the time SDK5 uses to value generated Dust.
 */
export const createIndexerIndexedBlockTime =
  (
    indexerUrl: string,
    fetchImpl: typeof fetch = fetch,
  ): (() => Promise<Date>) =>
  async () => {
    const response = await fetchImpl(indexerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ block { height timestamp } }" }),
    });
    if (!response.ok) {
      throw new Error(
        `indexed block query failed with HTTP ${response.status}`,
      );
    }
    const payload = (await response.json()) as {
      data?: { block?: { height: number; timestamp: number } };
      errors?: unknown;
    };
    const block = payload.data?.block;
    if (!block) {
      throw new Error(
        `indexed block query failed: ${JSON.stringify(payload.errors ?? payload)}`,
      );
    }
    const time = new Date(block.timestamp);
    if (Number.isNaN(time.getTime())) {
      throw new Error(
        `indexed block returned invalid timestamp ${block.timestamp}`,
      );
    }
    getLogger().info(
      `Indexed dust readiness block height=${block.height} timestamp=${time.toISOString()}`,
    );
    return time;
  };

const normalizeReadinessOptions = (
  options: DustReadinessOptions,
): {
  readonly timeoutMs: number;
  readonly pollIntervalMs: number;
  readonly deadline: number;
} => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  assertPositiveFinite(timeoutMs, "timeoutMs");
  assertNonNegativeFinite(pollIntervalMs, "pollIntervalMs");
  if (typeof options.indexedBlockTime !== "function") {
    throw new Error("indexedBlockTime must be a function");
  }
  if (options.signal?.aborted) {
    throw new Error("dust readiness cancelled");
  }
  return { timeoutMs, pollIntervalMs, deadline: Date.now() + timeoutMs };
};

/**
 * Waits until the SDK values at least one spendable Dust coin at the indexed
 * block time. Genesis coins can have `initialValue = 0` while a wall-clock
 * balance is already positive; event-only progress can also stay at genesis.
 * Every state read, indexer read and sleep is bounded by the same deadline.
 */
export const waitForSpendableDust = async (
  wallet: WalletFacade,
  options: DustReadinessOptions,
): Promise<void> => {
  await waitForSpendableDustWithinBudget(
    wallet,
    options,
    normalizeReadinessOptions(options),
  );
};

const waitForSpendableDustWithinBudget = async (
  wallet: WalletFacade,
  options: DustReadinessOptions,
  {
    timeoutMs,
    pollIntervalMs,
    deadline,
  }: ReturnType<typeof normalizeReadinessOptions>,
): Promise<void> => {
  let last = "no indexed block read yet";
  while (Date.now() < deadline) {
    const state = await readWalletState(wallet, deadline, options.signal);
    const indexedTime = await withDeadline(
      options.indexedBlockTime(),
      deadline,
      options.signal,
      "indexed block read",
    );
    if (Number.isNaN(indexedTime.getTime())) {
      throw new Error("indexedBlockTime returned an invalid Date");
    }
    const indexedBalance = state.dust.balance(indexedTime);
    last = `appliedIndex=${state.dust.progress.appliedIndex.toString()} indexedTime=${indexedTime.toISOString()} indexedBalance=${indexedBalance.toString()} coins=${state.dust.availableCoins.length}`;
    getLogger().info(`Dust readiness: ${last}`);
    if (indexedBalance > 0n) return;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(
      Math.min(pollIntervalMs, remaining),
      options.signal,
      "dust readiness wait",
    );
  }
  throw new Error(
    `Dust did not become spendable at an indexed block time within ${timeoutMs}ms (${last})`,
  );
};

/**
 * Registers NIGHT UTXOs for Dust generation and waits for positive spendable
 * Dust at the supplied indexed block time. This is positive-DUST readiness; it
 * does not guarantee arbitrary transaction affordability or proof-root
 * readiness.
 */
export const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
  readiness: DustReadinessOptions,
): Promise<void> => {
  const budget = normalizeReadinessOptions(readiness);
  const state = await readWalletState(
    wallet,
    budget.deadline,
    readiness.signal,
  );

  if (state.dust.availableCoins.length > 0) {
    await waitForSpendableDustWithinBudget(wallet, readiness, budget);
    getLogger().info("Dust already available and spendable at indexed time");
    return;
  }

  const nightUtxos = filterUnregisteredNightUtxos(
    state.unshielded.availableCoins,
  );

  if (nightUtxos.length === 0) {
    getLogger().info("Waiting for existing dust generation...");
    await waitForSpendableDustWithinBudget(wallet, readiness, budget);
    return;
  }

  getLogger().info(
    `Registering ${nightUtxos.length} NIGHT UTXOs for dust generation`,
  );
  const recipe = await wallet.registerNightUtxosForDustGeneration(
    nightUtxos,
    unshieldedKeystore.getPublicKey(),
    (payload) => unshieldedKeystore.signDataAsync(payload),
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized);

  getLogger().info("Waiting for dust generation...");
  await waitForSpendableDustWithinBudget(wallet, readiness, budget);
  getLogger().info("Dust generation complete");
};
