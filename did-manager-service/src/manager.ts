import { stat } from 'node:fs/promises';
import path from 'node:path';

import * as api from '@midnight-ntwrk/midnight-did-api';
import {
  type ServiceEndpoint,
  type VerificationMethodRelationType,
} from '@midnight-ntwrk/midnight-did-domain';
import {
  type FileSecretStore,
  type GenerateKeyInput,
  type ImportKeyInput,
} from '@midnight-ntwrk/midnight-did-secret-storage';
import type { Logger } from 'pino';

import type { ManagerConfig, SetupProfile } from './config.js';
import {
  addAlsoKnownAs as addDidAlsoKnownAs,
  addRelation as addDidRelation,
  addService as addDidService,
  addVerificationMethod as addDidVerificationMethod,
  buildNormalizedVerificationMethod,
  deactivateDid as deactivateDidContract,
  deployDidContract,
  getDidDocument as getDidDocumentFromLedger,
  getDidState as getDidStateFromLedger,
  listStoredContracts as listStoredContractsOnNetwork,
  removeAlsoKnownAs as removeDidAlsoKnownAs,
  removeRelation as removeDidRelation,
  removeService as removeDidService,
  removeVerificationMethod as removeDidVerificationMethod,
  updateService as updateDidService,
  updateVerificationMethod as updateDidVerificationMethod,
} from './manager/did-lifecycle-service.js';
import {
  buildProfileConfig,
  buildVerificationMethod,
  createSecretStore,
  faucetUrl,
  joinExistingContract,
  midnightDbPath,
  profileNamePattern,
} from './manager/helpers.js';
import { ManagerProfileStore } from './manager/profile-store.js';
import { ManagerRuntimeState } from './manager/runtime-state.js';
import {
  buildSessionStatus,
  buildSetupStatus,
  deriveUnshieldedAddress,
  resolveSeedInput,
} from './manager/wallet-session-service.js';
import type {
  DidDocumentResponse,
  DidStateResponse,
  FundingPreparation,
  PrepareFundingRequest,
  ProfileSelection,
  SessionProfileState,
  SessionStatus,
  SetupStatus,
  StoredContractStatus,
  UnlockRequest,
} from './types.js';
import {
  backupDirectoryIfExists,
  privateStateDbSeedHash,
  readWalletState,
  removeWalletStateDir,
  seedHashPrefix,
  walletStateDir,
  writeWalletState,
} from './wallet-state-store.js';

export class DidManagerService {
  private readonly cfg: ManagerConfig;
  private readonly logger: Logger;
  private readonly profileStore: ManagerProfileStore;
  private readonly runtime: ManagerRuntimeState;

  constructor(cfg: ManagerConfig, logger: Logger) {
    this.cfg = cfg;
    this.logger = logger;
    this.profileStore = new ManagerProfileStore(cfg, () => this.setupProfile());
    this.runtime = new ManagerRuntimeState(logger, cfg.sessionIdleMs, async () => {
      await this.lock();
    });
    api.setLogger(this.logger.child({ component: 'midnight-did-api' }));
  }

  private baseDataDir(): string {
    return this.profileStore.baseDataDir();
  }

  private selectedProfileName(): string {
    return this.profileStore.selectedProfileName();
  }

  private profileRootDir(profileName = this.selectedProfileName()): string {
    return this.profileStore.profileRootDir(profileName);
  }

  private profileSecretStorePath(profileName = this.selectedProfileName()): string {
    return this.profileStore.profileSecretStorePath(profileName);
  }

  private walletStateRootDir(profileName = this.selectedProfileName()): string {
    return this.profileStore.walletStateRootDir(profileName);
  }

  private walletStateKey(seedHash = this.runtime.getActiveSeedHash()): string | null {
    if (seedHash === null) return null;
    return `${this.setupProfile()}/${this.selectedProfileName()}/${seedHash}`;
  }

  private shouldPersistWalletState(): boolean {
    return this.setupProfile() !== 'standalone';
  }

  private setConnectionState(
    phase: SessionStatus['connection']['phase'],
    options: {
      lastError?: string | null;
      reusedPersistedState?: boolean;
      seedHash?: string | null;
    } = {},
  ): void {
    this.runtime.setConnectionState(phase, options);
  }

  private touchSessionActivity(): void {
    this.runtime.touchSessionActivity();
  }

  private async stopRuntimeSessionInternal(): Promise<void> {
    await this.runtime.stopRuntimeSession(
      this.shouldPersistWalletState()
        ? async (seedHash) => await this.persistWalletSnapshot(seedHash)
        : undefined,
    );
  }

  private async joinExistingContract(
    providers: api.MidnightDIDProviders,
    contractAddress: string,
  ): Promise<api.DeployedMidnightDIDContract> {
    return await joinExistingContract(providers, contractAddress, this.setupProfile());
  }

  private persistWalletStateBackupRoot(): string {
    return path.join(this.baseDataDir(), 'backup', 'wallet-state', this.setupProfile(), this.selectedProfileName());
  }

  private async persistWalletSnapshot(seedHash = this.runtime.getActiveSeedHash()): Promise<void> {
    const walletCtx = this.runtime.getWalletContext();
    if (!this.shouldPersistWalletState() || walletCtx === null || seedHash === null) return;
    const snapshot = await api.serializeWalletState(walletCtx);
    await writeWalletState(
      this.baseDataDir(),
      this.setupProfile(),
      this.selectedProfileName(),
      seedHash,
      snapshot,
    );
  }

  private async ensureSessionLoaded(): Promise<void> {
    await this.profileStore.ensureLoaded();
  }

  private setupProfile(): SetupProfile {
    return this.cfg.setupProfile;
  }

  private profileConfig(): api.Config {
    return buildProfileConfig(this.cfg, this.setupProfile());
  }

  private midnightDbPath(seed: string): string {
    return midnightDbPath(this.profileRootDir(), privateStateDbSeedHash(seed));
  }

  private requireUnlocked(): {
    providers: api.MidnightDIDProviders;
    didContract: api.DeployedMidnightDIDContract;
    secretStore: FileSecretStore;
  } {
    return this.runtime.requireUnlocked();
  }

  private requireUnlockedNoContract(): { providers: api.MidnightDIDProviders; secretStore: FileSecretStore } {
    return this.runtime.requireUnlockedNoContract();
  }

  private currentContractAddress(): string | null {
    return this.runtime.currentContractAddress();
  }

  private currentProfileState() {
    return this.profileStore.currentProfileState();
  }

  private async saveCurrentProfileState(
    next: Partial<SessionProfileState>,
  ): Promise<void> {
    await this.profileStore.saveCurrentProfileState(next);
  }

  private buildVerificationMethod(methodId: string, publicJwk: Awaited<ReturnType<FileSecretStore['getPublicKey']>>) {
    const didContract = this.runtime.getDidContract();
    if (didContract === null) {
      throw new Error('Session is locked or DID contract is not selected.');
    }
    return buildVerificationMethod(didContract, methodId, publicJwk);
  }

  private async persistRuntimeSession(): Promise<void> {
    const profile = this.currentProfileState();
    if (!profile?.seed) return;

    await this.saveCurrentProfileState({
      seed: profile.seed,
      unshieldedAddress: profile.unshieldedAddress,
      contractAddress: this.currentContractAddress() ?? profile.contractAddress,
    });
    await this.persistWalletSnapshot();
    this.touchSessionActivity();
  }

  getSetupStatus(): SetupStatus {
    return buildSetupStatus(this.cfg, this.setupProfile());
  }

  async getSessionStatus(): Promise<SessionStatus> {
    await this.ensureSessionLoaded();
    const profileState = this.currentProfileState();
    const connection: SessionStatus['connection'] = {
      ...this.runtime.getConnection(),
      walletStateKey: this.walletStateKey(),
    };
    const did = this.runtime.getDid(profileState?.contractAddress);
    return buildSessionStatus(
      this.setupProfile(),
      this.selectedProfileName(),
      this.profileStore.rememberUnlockedSession(),
      profileState,
      this.currentContractAddress(),
      this.runtime.getWalletBalances(),
      connection,
      did,
      this.runtime.isUnlocked(),
    );
  }

  async listProfiles(): Promise<ProfileSelection> {
    return await this.profileStore.listProfiles();
  }

  async listStoredContracts(): Promise<StoredContractStatus[]> {
    await this.ensureSessionLoaded();
    return await listStoredContractsOnNetwork({
      addresses: this.currentProfileState()?.contractAddresses ?? [],
      selectedAddress: this.currentContractAddress(),
      unlocked: this.runtime.isUnlocked(),
      providers: this.runtime.getProviders(),
      profile: this.setupProfile(),
    });
  }

  async selectProfile(input: { name: string }): Promise<SessionStatus> {
    const nextProfileName = input.name.trim();
    if (!profileNamePattern.test(nextProfileName)) {
      throw new Error('Profile name must start with an alphanumeric character and contain only letters, numbers, dot, underscore, or dash.');
    }
    if (this.runtime.isUnlocked()) {
      await this.lock();
    }
    await this.profileStore.selectProfile(nextProfileName);
    return this.getSessionStatus();
  }

  async updatePreferences(input: { rememberUnlockedSession: boolean }): Promise<SessionStatus> {
    await this.profileStore.updateRememberUnlockedSession(input.rememberUnlockedSession);
    return this.getSessionStatus();
  }

  async prepareFunding(input: PrepareFundingRequest): Promise<FundingPreparation> {
    await this.ensureSessionLoaded();

    const profile = this.setupProfile();
    const { seed, generatedSeed } = resolveSeedInput(this.setupProfile(), this.currentProfileState(), input);
    this.profileConfig();
    const unshieldedAddress = deriveUnshieldedAddress(seed);

    await this.saveCurrentProfileState({
      seed,
      unshieldedAddress,
    });

    return {
      profile,
      unshieldedAddress,
      faucetUrl: faucetUrl(profile),
      generatedSeed,
    };
  }

  private async createSecretStore(passphrase?: string): Promise<FileSecretStore> {
    return await createSecretStore(
      this.profileSecretStorePath(),
      passphrase,
      this.cfg.defaultSecretPassphrase,
    );
  }

  private async restorePersistedWalletState(seedHash: string) {
    if (!this.shouldPersistWalletState()) return null;
    return await readWalletState(
      this.baseDataDir(),
      this.setupProfile(),
      this.selectedProfileName(),
      seedHash,
    );
  }

  private async ensureWalletStateBackupRoot(seedHash: string): Promise<void> {
    if (!this.shouldPersistWalletState()) return;
    const rootDir = this.walletStateRootDir();
    const targetDir = walletStateDir(
      this.baseDataDir(),
      this.setupProfile(),
      this.selectedProfileName(),
      seedHash,
    );
    try {
      await stat(targetDir);
      return;
    } catch {
      const existingBackup = await backupDirectoryIfExists(rootDir, this.persistWalletStateBackupRoot());
      if (existingBackup !== null) {
        this.logger.info({ backupDir: existingBackup }, 'Backed up existing wallet-state directory before migration');
      }
    }
  }

  private async backupAndResetIncompatibleWalletState(seedHash: string, error: unknown): Promise<void> {
    if (!this.shouldPersistWalletState()) return;
    const sourceDir = walletStateDir(
      this.baseDataDir(),
      this.setupProfile(),
      this.selectedProfileName(),
      seedHash,
    );
    const backupDir = await backupDirectoryIfExists(sourceDir, this.persistWalletStateBackupRoot());
    await removeWalletStateDir(
      this.baseDataDir(),
      this.setupProfile(),
      this.selectedProfileName(),
      seedHash,
    );
    this.logger.warn(
      {
        err: error,
        profile: this.setupProfile(),
        profileName: this.selectedProfileName(),
        seedHash,
        backupDir,
      },
      'Persisted wallet state is incompatible. Falling back to fresh wallet sync',
    );
  }

  private startWalletStateTracking(generation: number): void {
    this.runtime.startWalletStateTracking(generation);
  }

  private async runUnlockSession(
    generation: number,
    seed: string,
    input: UnlockRequest,
  ): Promise<void> {
    const profileState = this.currentProfileState();
    const config = this.profileConfig();
    const seedHash = seedHashPrefix(seed);
    const providerConfig: api.Config = {
      ...config,
      midnightDbName: this.midnightDbPath(seed),
    };
    this.logger.info(
      { profile: this.setupProfile(), profileName: this.selectedProfileName(), midnightDbName: providerConfig.midnightDbName },
      'Using isolated Midnight private state store',
    );

    let persistedWalletState = await this.restorePersistedWalletState(seedHash);
    let reusedPersistedState = persistedWalletState !== null;
    this.setConnectionState(
      persistedWalletState === null ? 'starting' : 'restoring',
      { lastError: null, reusedPersistedState, seedHash },
    );

    let walletCtx: api.MidnightDIDWalletContext | null = null;
    try {
      if (persistedWalletState === null) {
        walletCtx = await api.buildWallet(config, seed);
      } else {
        try {
          walletCtx = await api.restoreWalletFromState(config, seed, persistedWalletState);
        } catch (restoreError) {
          await this.backupAndResetIncompatibleWalletState(seedHash, restoreError);
          persistedWalletState = null;
          reusedPersistedState = false;
          this.setConnectionState('starting', { lastError: null, reusedPersistedState, seedHash });
          walletCtx = await api.buildWallet(config, seed);
        }
      }

      if (generation !== this.runtime.getUnlockGeneration()) {
        await walletCtx.wallet.stop().catch(() => undefined);
        return;
      }

      this.runtime.attachWalletContext(walletCtx);
      this.startWalletStateTracking(generation);
      this.setConnectionState(
        persistedWalletState === null ? 'syncing' : 'restoring',
        { lastError: null, reusedPersistedState, seedHash },
      );

      const syncedState = await api.waitForWalletSync(walletCtx);
      this.runtime.setWalletBalances(api.getWalletBalances(syncedState));
      if (generation !== this.runtime.getUnlockGeneration()) return;

      if (this.shouldPersistWalletState()) {
        await this.ensureWalletStateBackupRoot(seedHash);
        await this.persistWalletSnapshot(seedHash);
      }

      this.setConnectionState('waitingForFunds', {
        lastError: null,
        reusedPersistedState,
        seedHash,
      });
      await api.waitForWalletFunds(walletCtx);
      if (generation !== this.runtime.getUnlockGeneration()) return;

      if (this.shouldPersistWalletState()) {
        await this.persistWalletSnapshot(seedHash);
      }

      this.setConnectionState('configuringProviders', {
        lastError: null,
        reusedPersistedState,
        seedHash,
      });
      this.logger.info(
        { profile: this.setupProfile(), profileName: this.selectedProfileName(), seedHash },
        'Wallet ready, configuring providers',
      );
      const providers = await api.configureProviders(walletCtx, providerConfig);
      const secretStore = await this.createSecretStore(input.passphrase);

      if (generation !== this.runtime.getUnlockGeneration()) return;

      this.runtime.attachReadySession({
        walletCtx,
        providers,
        secretStore,
        seedHash,
        reusedPersistedState,
      });
      this.logger.info(
        {
          storedContractAddress: profileState?.contractAddress ?? null,
          reusedPersistedState,
          walletStateKey: this.walletStateKey(seedHash),
        },
        'Manager session is ready',
      );

      await this.saveCurrentProfileState({
        seed,
        unshieldedAddress: profileState?.unshieldedAddress ?? deriveUnshieldedAddress(seed),
        contractAddress: profileState?.contractAddress,
      });
    } catch (error) {
      this.logger.error({ err: error }, 'Unlock session failed');
      if (walletCtx !== null) {
        await walletCtx.wallet.stop().catch(() => undefined);
      }
      this.runtime.markUnlockFailed(error);
      throw error;
    }
  }

  async unlock(input: UnlockRequest): Promise<{ status: SessionStatus; generatedSeed?: string }> {
    await this.ensureSessionLoaded();
    const { seed, generatedSeed } = resolveSeedInput(this.setupProfile(), this.currentProfileState(), input);
    if (typeof input.rememberUnlockedSession === 'boolean') {
      await this.profileStore.updateRememberUnlockedSession(input.rememberUnlockedSession);
    }

    const requestedSeedHash = seedHashPrefix(seed);
    if (this.runtime.isReadyForSeed(requestedSeedHash)) {
      this.touchSessionActivity();
      return {
        status: await this.getSessionStatus(),
        generatedSeed,
      };
    }

    if (this.runtime.getUnlockTask() !== null) {
      return {
        status: await this.getSessionStatus(),
        generatedSeed,
      };
    }

    await this.stopRuntimeSessionInternal();
    const generation = this.runtime.nextUnlockGeneration();
    this.setConnectionState('starting', {
      lastError: null,
      reusedPersistedState: false,
      seedHash: requestedSeedHash,
    });
    this.runtime.setUnlockTask(this.runUnlockSession(generation, seed, input).finally(() => {
      this.runtime.clearUnlockTaskIfCurrent(generation);
    }));

    return {
      status: await this.getSessionStatus(),
      generatedSeed,
    };
  }

  async lock(): Promise<SessionStatus> {
    this.runtime.nextUnlockGeneration();
    this.runtime.setUnlockTask(null);
    await this.stopRuntimeSessionInternal();
    return this.getSessionStatus();
  }

  async deployDid(): Promise<unknown> {
    const { providers } = this.requireUnlockedNoContract();
    const walletCtx = this.runtime.getWalletContext();
    if (walletCtx === null) {
      throw new Error('Session is locked. Unlock session first.');
    }
    const result = await deployDidContract({
      logger: this.logger,
      walletCtx,
      providers,
      onDidContract: (contract) => {
        this.runtime.setDidContract(contract);
        this.runtime.setDidLastError(null);
      },
      onPersist: async () => await this.persistRuntimeSession(),
    });
    this.runtime.setDidLastError(null);
    return result;
  }

  async joinDid(input: { contractAddress: string }): Promise<unknown> {
    const { providers } = this.requireUnlockedNoContract();
    try {
      this.runtime.setDidContract(await this.joinExistingContract(providers, input.contractAddress));
      this.runtime.setDidLastError(null);
    } catch (error) {
      this.runtime.setDidLastError(error instanceof Error ? error.message : 'DID contract join failed');
      throw error;
    }
    await this.persistRuntimeSession();
    return { contractAddress: this.currentContractAddress() };
  }

  async getDidState(): Promise<DidStateResponse | null> {
    const { providers, didContract } = this.requireUnlocked();
    return await getDidStateFromLedger(providers, didContract);
  }

  async getDidDocument(): Promise<DidDocumentResponse> {
    const { providers, didContract } = this.requireUnlocked();
    return await getDidDocumentFromLedger(providers, didContract);
  }

  async listKeys(): Promise<unknown> {
    const { secretStore } = this.requireUnlockedNoContract();
    return secretStore.listKeys();
  }

  async generateKey(input: GenerateKeyInput): Promise<unknown> {
    const { secretStore } = this.requireUnlockedNoContract();
    return secretStore.generateKey(input);
  }

  async importKey(input: ImportKeyInput): Promise<unknown> {
    const { secretStore } = this.requireUnlockedNoContract();
    return secretStore.importKey(input);
  }

  async deleteKey(input: { keyRef: string }): Promise<void> {
    const { secretStore } = this.requireUnlockedNoContract();
    await secretStore.deleteKey(input.keyRef);
  }

  async addVerificationMethod(input: { methodId: string; keyRef: string }): Promise<unknown> {
    const { didContract, secretStore } = this.requireUnlocked();
    const { method } = await buildNormalizedVerificationMethod(
      didContract,
      secretStore,
      input.keyRef,
      input.methodId,
      (methodId, publicJwk) => this.buildVerificationMethod(methodId, publicJwk),
    );
    return await addDidVerificationMethod(didContract, method, async () => await this.persistRuntimeSession());
  }

  async updateVerificationMethod(input: { methodId: string; keyRef: string }): Promise<unknown> {
    const { didContract, secretStore } = this.requireUnlocked();
    const { method } = await buildNormalizedVerificationMethod(
      didContract,
      secretStore,
      input.keyRef,
      input.methodId,
      (methodId, publicJwk) => this.buildVerificationMethod(methodId, publicJwk),
    );
    return await updateDidVerificationMethod(didContract, method, async () => await this.persistRuntimeSession());
  }

  async removeVerificationMethod(input: { methodId: string }): Promise<unknown> {
    const { didContract, providers } = this.requireUnlocked();
    return await removeDidVerificationMethod(
      didContract,
      providers,
      input.methodId,
      async () => await this.persistRuntimeSession(),
    );
  }

  async addRelation(input: { methodId: string; relation: VerificationMethodRelationType }): Promise<unknown> {
    const { didContract, providers } = this.requireUnlocked();
    return await addDidRelation(
      didContract,
      providers,
      input.relation,
      input.methodId,
      async () => await this.persistRuntimeSession(),
    );
  }

  async removeRelation(input: { methodId: string; relation: VerificationMethodRelationType }): Promise<unknown> {
    const { didContract, providers } = this.requireUnlocked();
    return await removeDidRelation(
      didContract,
      providers,
      input.relation,
      input.methodId,
      async () => await this.persistRuntimeSession(),
    );
  }

  async addService(input: { id: string; type: string; serviceEndpoint: ServiceEndpoint }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    return await addDidService(didContract, input, async () => await this.persistRuntimeSession());
  }

  async updateService(input: { id: string; type: string; serviceEndpoint: ServiceEndpoint }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    return await updateDidService(didContract, input, async () => await this.persistRuntimeSession());
  }

  async removeService(input: { id: string }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    return await removeDidService(didContract, input.id, async () => await this.persistRuntimeSession());
  }

  async addAlsoKnownAs(input: { value: string }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    return await addDidAlsoKnownAs(didContract, input.value, async () => await this.persistRuntimeSession());
  }

  async removeAlsoKnownAs(input: { value: string }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    return await removeDidAlsoKnownAs(didContract, input.value, async () => await this.persistRuntimeSession());
  }

  async deactivateDid(): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    return await deactivateDidContract(didContract, async () => await this.persistRuntimeSession());
  }
}
