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
  allowedIndexerHttpUrls: string[];
  allowedIndexerWsUrls: string[];
  expectedNetwork: MidnightNetwork | null;
  debug: boolean;
};

const parseBoolean = (value: string | undefined): boolean =>
  value?.trim().toLowerCase() === "true";

const parsePort = (value: string | undefined): number => {
  const raw = value ?? "3001";
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid RESOLVER_PORT value: ${raw}`);
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

const deriveWsUrl = (indexerHttpUrl: string): string => {
  const parsed = new URL(indexerHttpUrl);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  if (parsed.pathname.endsWith("/graphql")) {
    parsed.pathname = `${parsed.pathname}/ws`;
  }
  return parsed.toString().replace(/\/+$/, "");
};

const parseIndexerAllowlist = (
  value: string | undefined,
): Pick<
  ResolverServiceConfig,
  "allowedIndexerHttpUrls" | "allowedIndexerWsUrls"
> => {
  const allowedIndexerHttpUrls: string[] = [];
  const allowedIndexerWsUrls: string[] = [];
  if (value === undefined || value.trim() === "") {
    return { allowedIndexerHttpUrls, allowedIndexerWsUrls };
  }

  for (const raw of value.split(",")) {
    const item = raw.trim();
    if (item === "") continue;
    const parsed = new URL(item);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      const httpUrl = parseUrl(
        item,
        item,
        ["http:", "https:"],
        "MIDNIGHT_INDEXER_ALLOWLIST",
      );
      allowedIndexerHttpUrls.push(httpUrl);
      allowedIndexerWsUrls.push(deriveWsUrl(httpUrl));
      continue;
    }
    if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
      allowedIndexerWsUrls.push(
        parseUrl(item, item, ["ws:", "wss:"], "MIDNIGHT_INDEXER_ALLOWLIST"),
      );
      continue;
    }
    throw new Error(`Invalid MIDNIGHT_INDEXER_ALLOWLIST value: ${item}`);
  }

  return { allowedIndexerHttpUrls, allowedIndexerWsUrls };
};

export const loadConfig = (
  env: Record<string, string | undefined> = process.env,
): ResolverServiceConfig => {
  const allowlist = parseIndexerAllowlist(env.MIDNIGHT_INDEXER_ALLOWLIST);
  return {
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
    ...allowlist,
    expectedNetwork: parseNetwork(env.MIDNIGHT_NETWORK),
    debug: parseBoolean(env.RESOLVER_DEBUG),
  };
};
