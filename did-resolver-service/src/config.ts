import { MidnightNetwork } from "@midnight-ntwrk/midnight-did";

const networkMap: Record<string, MidnightNetwork> = {
  undeployed: MidnightNetwork.Undeployed,
  devnet: MidnightNetwork.DevNet,
  testnet: MidnightNetwork.Testnet,
  mainnet: MidnightNetwork.Mainnet,
  preview: MidnightNetwork.Preview,
  preprod: MidnightNetwork.Preprod,
};

const parseNetwork = (value: string | undefined): MidnightNetwork | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const network = networkMap[normalized];
  if (network !== undefined) return network;
  throw new Error(
    `Invalid MIDNIGHT_NETWORK value: ${value}. Expected one of ${Object.keys(networkMap).join("|")}`,
  );
};

export type ResolverServiceConfig = {
  host: string;
  port: number;
  indexerHttpUrl: string;
  indexerWsUrl: string;
  expectedNetwork: MidnightNetwork | null;
  debug: boolean;
  enableDocs: boolean;
  resolveTimeoutMs: number;
};

const parseBoolean = (value: string | undefined): boolean =>
  value?.trim().toLowerCase() === "true";

const parseOptionalBoolean = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(
    `Invalid boolean value: ${value}. Expected one of true|false`,
  );
};

const parsePort = (value: string | undefined): number => {
  const raw = value ?? "3001";
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid RESOLVER_PORT value: ${raw}`);
  }
  return parsed;
};

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
  envName: string,
): number => {
  const raw = value ?? String(fallback);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${envName} value: ${raw}`);
  }
  return parsed;
};

const parseUrl = (
  value: string | undefined,
  fallback: string,
  protocols: readonly string[],
  envName: string,
): string => {
  const raw = (value ?? fallback).trim();
  const parsed = new URL(raw);
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`Invalid ${envName} value: ${raw}`);
  }
  return parsed.toString().replace(/\/+$/, "");
};

export const loadConfig = (
  env: Record<string, string | undefined> = process.env,
): ResolverServiceConfig => ({
  host: env.RESOLVER_HOST ?? "127.0.0.1",
  port: parsePort(env.RESOLVER_PORT),
  indexerHttpUrl: parseUrl(
    env.MIDNIGHT_INDEXER_HTTP_URL,
    "http://127.0.0.1:8088/api/v3/graphql",
    ["http:", "https:"],
    "MIDNIGHT_INDEXER_HTTP_URL",
  ),
  indexerWsUrl: parseUrl(
    env.MIDNIGHT_INDEXER_WS_URL,
    "ws://127.0.0.1:8088/api/v3/graphql/ws",
    ["ws:", "wss:"],
    "MIDNIGHT_INDEXER_WS_URL",
  ),
  expectedNetwork: parseNetwork(env.MIDNIGHT_NETWORK),
  debug: parseBoolean(env.RESOLVER_DEBUG),
  enableDocs: parseOptionalBoolean(env.RESOLVER_ENABLE_DOCS, true),
  resolveTimeoutMs: parsePositiveInt(
    env.RESOLVER_TIMEOUT_MS,
    15_000,
    "RESOLVER_TIMEOUT_MS",
  ),
});
