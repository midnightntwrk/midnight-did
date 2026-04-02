import path from 'node:path';

export type SetupProfile = 'standalone' | 'preprod' | 'mainnet';

type SetupEndpoints = {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
};

export type ManagerConfig = {
  host: string;
  port: number;
  setupProfile: SetupProfile;
  sessionFilePath: string;
  secretStorePath: string;
  sessionIdleMs: number;
  defaultSecretPassphrase: string;
  rememberUnlockedSessionDefault: boolean;
  standalone: SetupEndpoints;
  preprod: SetupEndpoints;
  mainnet: SetupEndpoints;
};

const parsePort = (value: string | undefined): number => {
  const raw = value ?? '3010';
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid DID_MANAGER_PORT value: ${raw}`);
  }
  return parsed;
};

const parsePositiveMs = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive millisecond value: ${value}`);
  }
  return Math.floor(parsed);
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`Invalid boolean value: ${value}`);
};

const defaultDataDir = `${process.env.HOME ?? process.cwd()}/.midnight-did`;

const parseSetupProfile = (value: string | undefined): SetupProfile => {
  const raw = value?.trim() || 'standalone';
  if (raw === 'standalone' || raw === 'preprod' || raw === 'mainnet') return raw;
  throw new Error(`Invalid DID_MANAGER_SETUP value: ${raw}`);
};

export const loadConfig = (env: Record<string, string | undefined> = process.env): ManagerConfig => {
  const setupProfile = parseSetupProfile(env.DID_MANAGER_SETUP);
  const dataDir = env.DID_MANAGER_DATA_DIR?.trim() || defaultDataDir;
  const sessionFilePath = env.DID_MANAGER_SESSION_FILE?.trim() || path.join(dataDir, 'manager-session.json');
  const secretStorePath = env.DID_MANAGER_SECRET_FILE?.trim() || path.join(dataDir, 'manager-secrets.json');

  return {
    host: env.DID_MANAGER_HOST ?? '127.0.0.1',
    port: parsePort(env.DID_MANAGER_PORT),
    setupProfile,
    sessionFilePath,
    secretStorePath,
    sessionIdleMs: parsePositiveMs(env.DID_MANAGER_SESSION_IDLE_MS, 5 * 60 * 1000),
    defaultSecretPassphrase: env.DID_MANAGER_SECRET_PASSPHRASE ?? 'midnight-dev-passphrase',
    rememberUnlockedSessionDefault: parseBoolean(env.DID_MANAGER_REMEMBER_UNLOCKED, true),
    standalone: {
      indexer: env.DID_MANAGER_STANDALONE_INDEXER ?? 'http://127.0.0.1:8088/api/v3/graphql',
      indexerWS: env.DID_MANAGER_STANDALONE_INDEXER_WS ?? 'ws://127.0.0.1:8088/api/v3/graphql/ws',
      node: env.DID_MANAGER_STANDALONE_NODE ?? 'http://127.0.0.1:9944',
      proofServer: env.DID_MANAGER_STANDALONE_PROOF_SERVER ?? 'http://127.0.0.1:6300',
    },
    preprod: {
      indexer: env.DID_MANAGER_PREPROD_INDEXER ?? 'https://indexer.preprod.midnight.network/api/v4/graphql',
      indexerWS: env.DID_MANAGER_PREPROD_INDEXER_WS ?? 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
      node: env.DID_MANAGER_PREPROD_NODE ?? 'https://rpc.preprod.midnight.network',
      proofServer: env.DID_MANAGER_PREPROD_PROOF_SERVER ?? 'http://127.0.0.1:6300',
    },
    mainnet: {
      indexer: env.DID_MANAGER_MAINNET_INDEXER ?? 'https://indexer.mainnet.midnight.network/api/v4/graphql',
      indexerWS: env.DID_MANAGER_MAINNET_INDEXER_WS ?? 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
      node: env.DID_MANAGER_MAINNET_NODE ?? 'https://rpc.mainnet.midnight.network',
      proofServer: env.DID_MANAGER_MAINNET_PROOF_SERVER ?? 'http://127.0.0.1:6300',
    },
  };
};
