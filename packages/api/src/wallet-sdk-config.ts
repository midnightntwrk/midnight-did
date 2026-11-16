import { ProtocolVersion } from "@midnight-ntwrk/wallet-sdk-abstractions";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import { UnshieldedWallet } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";

type ShieldedConfig = Parameters<typeof ShieldedWallet>[0];
type UnshieldedConfig = Parameters<typeof UnshieldedWallet>[0];
type DustConfig = Parameters<typeof DustWallet>[0];

import { type Config } from "./config.js";

export const buildShieldedConfig = (
  { indexer, indexerWS, node, proofServer }: Config,
  txHistoryStorage: ShieldedConfig["txHistoryStorage"],
  networkId: ShieldedConfig["networkId"],
): ShieldedConfig => ({
  networkId,
  forks: ProtocolVersion.V9NativeForkSchedule,
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  txHistoryStorage,
});

export const buildUnshieldedConfig = (
  { indexer, indexerWS }: Config,
  txHistoryStorage: UnshieldedConfig["txHistoryStorage"],
  networkId: UnshieldedConfig["networkId"],
): UnshieldedConfig => ({
  networkId,
  forks: ProtocolVersion.V9NativeForkSchedule,
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  txHistoryStorage,
});

export const buildDustConfig = (
  { indexer, indexerWS, node, proofServer }: Config,
  txHistoryStorage: DustConfig["txHistoryStorage"],
  networkId: DustConfig["networkId"],
): DustConfig => ({
  networkId,
  forks: ProtocolVersion.V9NativeForkSchedule,
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: { indexerHttpUrl: indexer },
  txHistoryStorage,
});
