import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { MidnightWalletStateSnapshot } from '@midnight-ntwrk/midnight-did-api';

import type { NetworkProfile } from './types.js';

export type WalletStateMeta = {
  version: 2;
  walletSchema: 'ledger8';
  profile: NetworkProfile;
  profileName: string;
  seedHash: string;
  updatedAt: string;
};

export type StoredWalletState = MidnightWalletStateSnapshot & {
  meta: WalletStateMeta;
};

export const seedHashPrefix = (seed: string): string =>
  createHash('sha256').update(seed).digest('hex').slice(0, 6);

export const privateStateDbSeedHash = (seed: string): string =>
  createHash('sha256').update(seed).digest('hex').slice(0, 16);

export const walletStateDir = (
  baseDir: string,
  network: NetworkProfile,
  profileName: string,
  seedHash: string,
): string => path.join(baseDir, 'profiles', network, profileName, 'wallet-state', seedHash);

const metaFilePath = (dir: string): string => path.join(dir, 'meta.json');
const shieldedFilePath = (dir: string): string => path.join(dir, 'shielded.json');
const unshieldedFilePath = (dir: string): string => path.join(dir, 'unshielded.json');
const dustFilePath = (dir: string): string => path.join(dir, 'dust.json');
const historyFilePath = (dir: string): string => path.join(dir, 'unshielded-history.json');

export const readWalletState = async (
  baseDir: string,
  network: NetworkProfile,
  profileName: string,
  seedHash: string,
): Promise<StoredWalletState | null> => {
  const dir = walletStateDir(baseDir, network, profileName, seedHash);
  try {
    const [metaRaw, shieldedState, unshieldedState, dustState] = await Promise.all([
      readFile(metaFilePath(dir), 'utf8'),
      readFile(shieldedFilePath(dir), 'utf8'),
      readFile(unshieldedFilePath(dir), 'utf8'),
      readFile(dustFilePath(dir), 'utf8'),
    ]);
    const meta = JSON.parse(metaRaw) as WalletStateMeta;
    const unshieldedHistory = await readFile(historyFilePath(dir), 'utf8').catch(() => undefined);
    if (
      meta.version !== 2
      || meta.walletSchema !== 'ledger8'
      || meta.profile !== network
      || meta.profileName !== profileName
      || meta.seedHash !== seedHash
    ) {
      return null;
    }
    return {
      meta,
      shieldedState,
      unshieldedState,
      dustState,
      unshieldedHistory,
    };
  } catch {
    return null;
  }
};

export const writeWalletState = async (
  baseDir: string,
  network: NetworkProfile,
  profileName: string,
  seedHash: string,
  snapshot: MidnightWalletStateSnapshot,
): Promise<string> => {
  const dir = walletStateDir(baseDir, network, profileName, seedHash);
  await mkdir(dir, { recursive: true });
  const meta: WalletStateMeta = {
    version: 2,
    walletSchema: 'ledger8',
    profile: network,
    profileName,
    seedHash,
    updatedAt: new Date().toISOString(),
  };
  await Promise.all([
    writeFile(metaFilePath(dir), JSON.stringify(meta, null, 2), 'utf8'),
    writeFile(shieldedFilePath(dir), snapshot.shieldedState, 'utf8'),
    writeFile(unshieldedFilePath(dir), snapshot.unshieldedState, 'utf8'),
    writeFile(dustFilePath(dir), snapshot.dustState, 'utf8'),
    writeFile(historyFilePath(dir), snapshot.unshieldedHistory ?? '', 'utf8'),
  ]);
  return dir;
};

export const backupDirectoryIfExists = async (
  sourceDir: string,
  backupRootDir: string,
): Promise<string | null> => {
  try {
    const sourceStats = await stat(sourceDir);
    if (!sourceStats.isDirectory()) return null;
  } catch {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(backupRootDir, timestamp);
  await mkdir(backupDir, { recursive: true });
  await cp(sourceDir, path.join(backupDir, path.basename(sourceDir)), { recursive: true });
  return backupDir;
};

export const removeWalletStateDir = async (
  baseDir: string,
  network: NetworkProfile,
  profileName: string,
  seedHash: string,
): Promise<void> => {
  await rm(walletStateDir(baseDir, network, profileName, seedHash), { recursive: true, force: true });
};

export const copyWalletStateFile = async (fromPath: string, toPath: string): Promise<void> => {
  await mkdir(path.dirname(toPath), { recursive: true });
  await copyFile(fromPath, toPath);
};
