import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MIDNIGHT_DID_ZK_CONFIG_PATH_ENV = "MIDNIGHT_DID_ZK_CONFIG_PATH";

export interface ApiContractConfig {
  readonly privateStateStoreName: "did-private-state";
  readonly zkConfigPath: string;
}

export const resolveApiPackageRoot = (moduleUrl: string): string => {
  const fileDir = path.dirname(fileURLToPath(moduleUrl));
  const parentDir = path.resolve(fileDir, "..");

  if (path.basename(parentDir) === "dist") {
    return path.resolve(parentDir, "..");
  }

  return parentDir;
};

const configuredZkConfigPath = (): string | undefined => {
  const value = process.env[MIDNIGHT_DID_ZK_CONFIG_PATH_ENV]?.trim();
  return value ? path.resolve(value) : undefined;
};

const defaultZkConfigPathCandidates = (apiPackageRoot: string): string[] => [
  path.resolve(apiPackageRoot, "..", "contract", "dist", "managed", "did"),
  path.resolve(apiPackageRoot, "..", "contract", "src", "managed", "did"),
];

export const resolveDefaultZkConfigPath = (apiPackageRoot: string): string => {
  const candidates = defaultZkConfigPathCandidates(apiPackageRoot);
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[1];
};

export const createContractConfig = (
  apiPackageRoot: string,
): ApiContractConfig => ({
  privateStateStoreName: "did-private-state",
  zkConfigPath:
    configuredZkConfigPath() ?? resolveDefaultZkConfigPath(apiPackageRoot),
});

export const currentDir = resolveApiPackageRoot(import.meta.url);

export const contractConfig = createContractConfig(currentDir);
