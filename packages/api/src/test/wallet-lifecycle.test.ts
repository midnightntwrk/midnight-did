// SPDX-License-Identifier: Apache-2.0
import { ProtocolVersion } from "@midnight-ntwrk/wallet-sdk-abstractions";
import {
  Lifecycle,
  TransactionLifecycleServiceImpl,
  TransactionTraits,
} from "@midnight-ntwrk/wallet-sdk-capabilities/transactionLifecycle";
import {
  lifecycleTransactionTraits,
  type LifecycleTx,
} from "@midnight-ntwrk/wallet-sdk-facade";
import { PublicKey } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import {
  CoreWallet,
  Serialization,
  UnshieldedState,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet/v2";
import * as ledger from "@midnightntwrk/ledger-v9";
import { DateTime, Either, Option } from "effect";
import { firstValueFrom } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const facadeBoundary = vi.hoisted(() => ({ init: vi.fn(), start: vi.fn() }));
vi.mock("@midnight-ntwrk/wallet-sdk-facade", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@midnight-ntwrk/wallet-sdk-facade")
  >()),
  WalletFacade: { init: facadeBoundary.init },
}));

import { type Config } from "../config.js";
import { buildWallet, restoreWalletFromState } from "../wallet.js";
import {
  createUnshieldedKeystoreFromKeys,
  deriveMidnightWalletKeys,
} from "../wallet-keys.js";
import { serializeWalletState } from "../wallet-state.js";

const config = {
  indexerClientConnection: { indexerHttpUrl: "http://unused.invalid/graphql" },
};
const forks = ProtocolVersion.V9NativeForkSchedule;
const traits = lifecycleTransactionTraits(forks.v9);
const now = new Date("2030-01-01T00:00:00Z");
const ttl = new Date(now.getTime() + 60 * 60 * 1000);
const clock = { now: () => now };

const fixture = () => {
  const keystore = createUnshieldedKeystoreFromKeys(
    deriveMidnightWalletKeys("11".repeat(32)),
    "testnet",
  );
  const coin: ledger.Utxo = {
    value: 100n,
    owner: keystore.getAddress(),
    type: ledger.unshieldedToken().raw,
    intentHash: "ab".repeat(32),
    outputNo: 0,
  };
  const intent = ledger.Intent.new(ttl);
  intent.guaranteedUnshieldedOffer = ledger.UnshieldedOffer.new(
    [{ ...coin, owner: keystore.getPublicKey() }],
    [{ value: coin.value, owner: coin.owner, type: coin.type }],
    [],
  );
  const tx: LifecycleTx = {
    protocolVersion: forks.v9,
    transaction: ledger.Transaction.fromParts(
      "testnet",
      undefined,
      undefined,
      intent,
    ).eraseProofs(),
    form: "Erased",
  };
  const trait = Option.getOrThrow(
    TransactionTraits.recognisingTrait(traits, tx),
  );
  const facts = {
    tx,
    protocolVersion: forks.v9,
    identifiers: trait.ids(tx),
    intentHashes: trait.intentHashes(tx),
    inputs: trait.inputs(tx),
    ttl: trait.ttl(tx, DateTime.unsafeMake(now)),
  };
  let core = CoreWallet.withProtocolVersion(
    CoreWallet.init(PublicKey.fromKeyStore(keystore), "testnet"),
    forks.v9,
  );
  core = Either.getOrThrow(
    CoreWallet.applyUpdate(core, {
      status: "SUCCESS",
      spentUtxos: [],
      createdUtxos: [
        new UnshieldedState.UtxoWithMeta({
          utxo: coin,
          meta: { ctime: now, registeredForDustGeneration: false },
        }),
      ],
    }),
  );
  core = Either.getOrThrow(CoreWallet.spend(core, coin, ttl));
  return { core, coin, facts };
};

const snapshotWithService = async (
  service: Awaited<
    ReturnType<typeof TransactionLifecycleServiceImpl.init<LifecycleTx>>
  >,
  core: CoreWallet,
) => {
  const codec = Serialization.makeDefaultV2SerializationCapability({ clock });
  return await serializeWalletState({
    wallet: { transactionLifecycleService: service },
    shieldedWallet: { serializeState: async () => "shielded-separate" },
    unshieldedWallet: { serializeState: async () => codec.serialize(core) },
    dustWallet: { serializeState: async () => "dust-separate" },
    unshieldedHistoryStorage: { serialize: async () => ({ entries: [] }) },
  } as any);
};

describe("selected SDK lifecycle-complete snapshot round trip (no services started)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    facadeBoundary.init.mockImplementation(async (init) => {
      // Exercise the actual application factory and SDK restore, without starting components/network services.
      await init.transactionLifecycleService(init.configuration, { clock });
      return { start: facadeBoundary.start };
    });
  });
  it("preserves a real future-TTL transaction and its NIGHT reservation; empty coverage is unsafe", async () => {
    const { core, coin, facts } = fixture();
    expect(facts.identifiers.length).toBeGreaterThan(0);
    expect(facts.inputs.unshielded).toEqual([`${coin.intentHash}#0`]);
    expect(facts.ttl).toEqual(ttl);
    const service = await TransactionLifecycleServiceImpl.init({
      txTraits: traits,
      configuration: config,
      clock,
    });
    try {
      await service.balanced(facts);
      const snapshot = await snapshotWithService(service, core);
      expect(snapshot.transactionLifecycleState).toBe(
        await service.serializeState(),
      );
      expect(snapshot.unshieldedHistory).toBe(JSON.stringify({ entries: [] }));
      const restored = await TransactionLifecycleServiceImpl.restore(
        snapshot.transactionLifecycleState,
        traits,
        config,
        clock,
      );
      try {
        const lifecycle = await firstValueFrom(restored.state());
        expect(lifecycle.records).toHaveLength(1);
        const record = lifecycle.records[0];
        expect(record.state._tag).toBe("Balanced");
        expect(record.ttl).toEqual(ttl);
        expect(DateTime.toDate(record.createdAt)).toEqual(now);
        expect(record.identifiers).toEqual(facts.identifiers);
        const held = Option.getOrThrow(record.tx);
        expect(held.transaction.serialize()).toEqual(
          facts.tx.transaction.serialize(),
        );
        const codec = Serialization.makeDefaultV2SerializationCapability({
          clock,
        });
        const restoredCore = Either.getOrThrow(
          codec.deserialize(snapshot.unshieldedState),
        );
        expect(
          UnshieldedState.UnshieldedState.toArrays(restoredCore.state)
            .pendingUtxos[0].restored,
        ).toBe(true);
        const atTip = CoreWallet.releaseRestoredPending(
          restoredCore,
          Lifecycle.coveredUnshieldedIds(lifecycle),
        );
        expect(
          UnshieldedState.UnshieldedState.toArrays(atTip.state).pendingUtxos,
        ).toHaveLength(1);
        expect(Either.isLeft(CoreWallet.spend(atTip, coin, ttl))).toBe(true);
        const emptyControl = CoreWallet.releaseRestoredPending(
          restoredCore,
          Lifecycle.coveredUnshieldedIds(Lifecycle.empty()),
        );
        expect(
          UnshieldedState.UnshieldedState.toArrays(emptyControl.state)
            .pendingUtxos,
        ).toHaveLength(0);
        expect(Either.isRight(CoreWallet.spend(emptyControl, coin, ttl))).toBe(
          true,
        );
        expect(
          Lifecycle.coveredUnshieldedIds(
            Lifecycle.expire(lifecycle, DateTime.unsafeMake(ttl)),
          ),
        ).toHaveLength(1);
        const expired = Lifecycle.expire(
          lifecycle,
          DateTime.unsafeMake(ttl.getTime() + 1),
        );
        expect(expired.records[0].state._tag).toBe("Expired");
        expect(Lifecycle.coveredUnshieldedIds(expired)).toEqual([]);
        expect(
          Lifecycle.dropFinished(
            expired,
            DateTime.unsafeMake(ttl.getTime() + 1),
          ).records,
        ).toEqual([]);
        expect(
          Either.isRight(
            CoreWallet.spend(
              CoreWallet.expirePending(atTip, new Date(ttl.getTime() + 1)),
              coin,
              ttl,
            ),
          ),
        ).toBe(true);
      } finally {
        await restored.stop();
      }
    } finally {
      await service.stop();
    }
  });

  it("round trips settled records without reviving coverage and preserves a fresh empty SDK store", async () => {
    const { core, facts } = fixture();
    const service = await TransactionLifecycleServiceImpl.init({
      txTraits: traits,
      configuration: config,
      clock,
    });
    try {
      const fresh = await TransactionLifecycleServiceImpl.restore(
        await service.serializeState(),
        traits,
        config,
        clock,
      );
      expect((await firstValueFrom(fresh.state())).records).toEqual([]);
      await fresh.stop();
      await service.balanced(facts);
      await service.included(facts.identifiers, { status: "SUCCESS" });
      const snapshot = await snapshotWithService(service, core);
      const restored = await TransactionLifecycleServiceImpl.restore(
        snapshot.transactionLifecycleState,
        traits,
        config,
        clock,
      );
      try {
        const lifecycle = await firstValueFrom(restored.state());
        expect(lifecycle.records[0].state._tag).toBe("Confirmed");
        expect(Lifecycle.coveredUnshieldedIds(lifecycle)).toEqual([]);
        expect(
          Lifecycle.dropFinished(
            lifecycle,
            DateTime.unsafeMake(ttl.getTime() + 1),
          ).records,
        ).toEqual([]);
      } finally {
        await restored.stop();
      }
    } finally {
      await service.stop();
    }
  });

  it.each(["not JSON", JSON.stringify({ version: "unknown", records: [] })])(
    "SDK refuses corrupt/unknown lifecycle data",
    async (payload) => {
      await expect(
        TransactionLifecycleServiceImpl.restore(payload, traits, config, clock),
      ).rejects.toThrow();
    },
  );

  it.each(["not JSON", JSON.stringify({ version: "unknown", records: [] })])(
    "application factory propagates actual SDK corrupt/unknown rejection before start",
    async (payload) => {
      const runtimeConfig: Config = {
        logDir: "logs",
        indexer: "http://unused.invalid",
        indexerWS: "ws://unused.invalid",
        node: "http://unused.invalid",
        proofServer: "http://unused.invalid",
      };
      await expect(
        buildWallet(runtimeConfig, "11".repeat(32), {
          transactionLifecycleState: payload,
          shieldedState: "unused",
          unshieldedState: "unused",
          dustState: "unused",
        }),
      ).rejects.toThrow();
      expect(facadeBoundary.init).toHaveBeenCalledOnce();
      expect(facadeBoundary.start).not.toHaveBeenCalled();
    },
  );

  it.each([buildWallet, restoreWalletFromState])(
    "public snapshot entrypoint rejects old snapshots before seed derivation",
    async (entrypoint) => {
      await expect(
        entrypoint({} as Config, "invalid seed", {
          shieldedState: "old",
          unshieldedState: "old",
          dustState: "old",
        } as any),
      ).rejects.toThrow(/incomplete|incompatible.*snapshot/i);
      expect(facadeBoundary.init).not.toHaveBeenCalled();
      expect(facadeBoundary.start).not.toHaveBeenCalled();
    },
  );
});
