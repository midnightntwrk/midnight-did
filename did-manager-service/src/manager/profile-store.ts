import path from 'node:path';

import type { ManagerConfig, SetupProfile } from '../config.js';
import {
  listProfileNames,
  migrateLegacyProfileFile,
  readProfileIndex,
  readSessionStore,
  writeProfileIndex,
  writeSessionStore,
} from '../session-store.js';
import type { NetworkProfile, ProfileSelection, SessionProfileState, SessionStore } from '../types.js';

type ProfileIndex = {
  version: 1;
  selectedProfiles: Partial<Record<NetworkProfile, string>>;
  legacyMigrationCompleted: Partial<Record<NetworkProfile, boolean>>;
};

const nowIso = (): string => new Date().toISOString();

export class ManagerProfileStore {
  private sessionLoaded = false;
  private profileIndexLoaded = false;
  private loadedSessionPath: string | null = null;
  private selectedProfileNameValue = 'default';
  private profileIndex: ProfileIndex = {
    version: 1,
    selectedProfiles: {},
    legacyMigrationCompleted: {},
  };
  private session: SessionStore = {
    version: 1,
    rememberUnlockedSession: true,
    lastProfile: null,
    profiles: {},
  };

  constructor(
    private readonly cfg: ManagerConfig,
    private readonly currentSetupProfile: () => SetupProfile,
  ) {}

  selectedProfileName(): string {
    return this.selectedProfileNameValue;
  }

  baseDataDir(): string {
    return path.dirname(this.cfg.sessionFilePath);
  }

  profileRootDir(profileName = this.selectedProfileNameValue): string {
    return path.join(this.baseDataDir(), 'profiles', this.currentSetupProfile(), profileName);
  }

  profileSecretStorePath(profileName = this.selectedProfileNameValue): string {
    return path.join(this.profileRootDir(profileName), 'manager-secrets.json');
  }

  walletStateRootDir(profileName = this.selectedProfileNameValue): string {
    return path.join(this.profileRootDir(profileName), 'wallet-state');
  }

  currentProfileState(): SessionProfileState | undefined {
    return this.session.profiles[this.currentSetupProfile()];
  }

  rememberUnlockedSession(): boolean {
    return this.session.rememberUnlockedSession;
  }

  async ensureLoaded(): Promise<void> {
    await this.ensureProfileIndexLoaded();
    const sessionPath = this.profileSessionFilePath();
    if (this.sessionLoaded && this.loadedSessionPath === sessionPath) return;

    await this.ensureLegacyProfileMigrated();
    this.session = await readSessionStore(sessionPath, this.cfg.rememberUnlockedSessionDefault);
    this.loadedSessionPath = sessionPath;
    this.sessionLoaded = true;
  }

  async listProfiles(): Promise<ProfileSelection> {
    await this.ensureProfileIndexLoaded();
    const profilesRoot = path.join(this.baseDataDir(), 'profiles', this.currentSetupProfile());
    const availableProfileNames = Array.from(new Set(['default', ...await listProfileNames(profilesRoot)]));
    return {
      profile: this.currentSetupProfile(),
      activeProfileName: this.selectedProfileNameValue,
      availableProfileNames,
    };
  }

  async selectProfile(profileName: string): Promise<void> {
    await this.ensureProfileIndexLoaded();
    this.selectedProfileNameValue = profileName;
    this.profileIndex.selectedProfiles[this.currentSetupProfile()] = profileName;
    await writeProfileIndex(this.profileIndexFilePath(), this.profileIndex);
    this.sessionLoaded = false;
    this.loadedSessionPath = null;
    await this.ensureLoaded();
  }

  async updateRememberUnlockedSession(value: boolean): Promise<void> {
    await this.ensureLoaded();
    this.session.rememberUnlockedSession = value;
    await writeSessionStore(this.profileSessionFilePath(), this.session);
  }

  async saveCurrentProfileState(next: Partial<SessionProfileState>): Promise<void> {
    await this.ensureLoaded();
    const profile = this.currentSetupProfile();
    const current = this.currentProfileState();
    const contractAddress = next.contractAddress ?? current?.contractAddress;

    this.session.lastProfile = profile;
    this.session.profiles[profile] = {
      seed: next.seed ?? current?.seed ?? '',
      unshieldedAddress: next.unshieldedAddress ?? current?.unshieldedAddress,
      contractAddress,
      contractAddresses: this.mergeContractAddresses(
        next.contractAddresses ?? current?.contractAddresses,
        contractAddress,
      ),
      updatedAt: next.updatedAt ?? nowIso(),
    };
    await writeSessionStore(this.profileSessionFilePath(), this.session);
  }

  private profileIndexFilePath(): string {
    return path.join(this.baseDataDir(), 'manager-profiles.json');
  }

  private profileSessionFilePath(profileName = this.selectedProfileNameValue): string {
    return path.join(this.profileRootDir(profileName), 'manager-session.json');
  }

  private profileLegacySessionFilePath(): string {
    return this.cfg.sessionFilePath;
  }

  private profileLegacySecretFilePath(): string {
    return this.cfg.secretStorePath;
  }

  private async ensureProfileIndexLoaded(): Promise<void> {
    if (this.profileIndexLoaded) return;
    this.profileIndex = await readProfileIndex(this.profileIndexFilePath());
    this.selectedProfileNameValue = this.profileIndex.selectedProfiles[this.currentSetupProfile()] ?? 'default';
    this.profileIndexLoaded = true;
  }

  private async ensureLegacyProfileMigrated(): Promise<void> {
    const profile = this.currentSetupProfile();
    if (this.profileIndex.legacyMigrationCompleted[profile]) return;

    const profilesRoot = path.join(this.baseDataDir(), 'profiles', profile);
    const existingProfiles = await listProfileNames(profilesRoot);
    if (existingProfiles.length === 0) {
      await migrateLegacyProfileFile(this.profileLegacySessionFilePath(), this.profileSessionFilePath());
      await migrateLegacyProfileFile(this.profileLegacySecretFilePath(), this.profileSecretStorePath());
    }

    this.profileIndex.legacyMigrationCompleted[profile] = true;
    await writeProfileIndex(this.profileIndexFilePath(), this.profileIndex);
  }

  private mergeContractAddresses(existing: string[] | undefined, next?: string | null): string[] {
    const values = Array.isArray(existing) ? existing.filter((value) => value.length > 0) : [];
    if (typeof next !== 'string' || next.length === 0) return values;
    return [next, ...values.filter((value) => value !== next)];
  }
}
