import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { NetworkProfile, SessionStore } from './types.js';

type ProfileIndex = {
  version: 1;
  selectedProfiles: Partial<Record<NetworkProfile, string>>;
};

const defaultProfileIndex = (): ProfileIndex => ({
  version: 1,
  selectedProfiles: {},
});

export const defaultSessionStore = (rememberUnlockedSession: boolean): SessionStore => ({
  version: 1,
  rememberUnlockedSession,
  lastProfile: null,
  profiles: {},
});

export const readSessionStore = async (
  filePath: string,
  rememberUnlockedSession: boolean,
): Promise<SessionStore> => {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SessionStore>;
    if (parsed.version !== 1 || parsed.profiles === undefined) {
      return defaultSessionStore(rememberUnlockedSession);
    }
    return {
      version: 1,
      rememberUnlockedSession:
        typeof parsed.rememberUnlockedSession === 'boolean'
          ? parsed.rememberUnlockedSession
          : rememberUnlockedSession,
      lastProfile: parsed.lastProfile ?? null,
      profiles: Object.fromEntries(
        Object.entries(parsed.profiles).map(([profile, state]) => {
          const profileState = state as SessionStore['profiles'][keyof SessionStore['profiles']];
          if (profileState === undefined) return [profile, profileState];
          return [profile, {
            ...profileState,
            contractAddresses:
              Array.isArray(profileState.contractAddresses)
                ? profileState.contractAddresses
                : typeof profileState.contractAddress === 'string'
                  ? [profileState.contractAddress]
                  : [],
          }];
        }),
      ),
    };
  } catch {
    return defaultSessionStore(rememberUnlockedSession);
  }
};

export const writeSessionStore = async (filePath: string, store: SessionStore): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), 'utf8');
};

export const readProfileIndex = async (filePath: string): Promise<ProfileIndex> => {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ProfileIndex>;
    if (parsed.version !== 1 || parsed.selectedProfiles === undefined) {
      return defaultProfileIndex();
    }
    return {
      version: 1,
      selectedProfiles: parsed.selectedProfiles,
    };
  } catch {
    return defaultProfileIndex();
  }
};

export const writeProfileIndex = async (filePath: string, store: ProfileIndex): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), 'utf8');
};

export const listProfileNames = async (profilesRootDir: string): Promise<string[]> => {
  try {
    const entries = await readdir(profilesRootDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
};

export const migrateLegacyProfileFile = async (legacyPath: string, targetPath: string): Promise<void> => {
  try {
    const raw = await readFile(targetPath, 'utf8');
    if (raw.length > 0) return;
  } catch {
    try {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(legacyPath, targetPath);
    } catch {
      // ignore missing legacy files or copy failures; a fresh profile will be created on demand
    }
  }
};
