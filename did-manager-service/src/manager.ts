import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

import { createMidnightDIDString, LedgerToDomain, MidnightNetwork, parseContractAddress } from '@midnight-ntwrk/midnight-did';
import * as api from '@midnight-ntwrk/midnight-did-api';
import {
  createService,
  createVerificationMethod,
  type CurveType,
  KeyType,
  type ServiceEndpoint,
  type VerificationMethodRelationType,
  VerificationMethodType,
} from '@midnight-ntwrk/midnight-did-domain';
import {
  FileSecretStore,
  type GenerateKeyInput,
  type ImportKeyInput,
  normalizePublicForLedger,
  type PublicJwk,
} from '@midnight-ntwrk/midnight-did-secret-storage';
import { getNetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { Logger } from 'pino';

import type { ManagerConfig, SetupProfile } from './config.js';
import {
  listProfileNames,
  migrateLegacyProfileFile,
  readProfileIndex,
  readSessionStore,
  writeProfileIndex,
  writeSessionStore,
} from './session-store.js';
import type {
  DidDocumentResponse,
  DidStateResponse,
  FundingPreparation,
  NetworkProfile,
  PrepareFundingRequest,
  ProfileSelection,
  SessionStatus,
  SessionStore,
  SetupStatus,
  UnlockRequest,
} from './types.js';

const nowIso = (): string => new Date().toISOString();
const generateSeedHex = (): string => randomBytes(32).toString('hex');
const profileNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const runtimeNetworkMap: Record<ReturnType<typeof getNetworkId>, MidnightNetwork> = {
  undeployed: MidnightNetwork.Undeployed,
  devnet: MidnightNetwork.DevNet,
  testnet: MidnightNetwork.Testnet,
  mainnet: MidnightNetwork.Mainnet,
  preview: MidnightNetwork.Preview,
  preprod: MidnightNetwork.Preprod,
};

export class DidManagerService {
  private readonly cfg: ManagerConfig;
  private readonly logger: Logger;

  private sessionLoaded = false;
  private profileIndexLoaded = false;
  private loadedSessionPath: string | null = null;
  private selectedProfileName = 'default';
  private profileIndex: {
    version: 1;
    selectedProfiles: Partial<Record<NetworkProfile, string>>;
  } = {
    version: 1 as const,
    selectedProfiles: {},
  };
  private session: SessionStore = {
    version: 1,
    rememberUnlockedSession: true,
    lastProfile: null,
    profiles: {},
  };

  private unlocked = false;
  private walletCtx: api.MidnightDIDWalletContext | null = null;
  private providers: api.MidnightDIDProviders | null = null;
  private didContract: api.DeployedMidnightDIDContract | null = null;
  private secretStore: FileSecretStore | null = null;

  constructor(cfg: ManagerConfig, logger: Logger) {
    this.cfg = cfg;
    this.logger = logger;
    api.setLogger(this.logger.child({ component: 'midnight-did-api' }));
  }

  private baseDataDir(): string {
    return path.dirname(this.cfg.sessionFilePath);
  }

  private profileIndexFilePath(): string {
    return path.join(this.baseDataDir(), 'manager-profiles.json');
  }

  private profileRootDir(profileName = this.selectedProfileName): string {
    return path.join(this.baseDataDir(), 'profiles', this.setupProfile(), profileName);
  }

  private profileSessionFilePath(profileName = this.selectedProfileName): string {
    return path.join(this.profileRootDir(profileName), 'manager-session.json');
  }

  private profileSecretStorePath(profileName = this.selectedProfileName): string {
    return path.join(this.profileRootDir(profileName), 'manager-secrets.json');
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
    this.selectedProfileName = this.profileIndex.selectedProfiles[this.setupProfile()] ?? 'default';
    this.profileIndexLoaded = true;
  }

  private async ensureSessionLoaded(): Promise<void> {
    await this.ensureProfileIndexLoaded();
    const sessionPath = this.profileSessionFilePath();
    if (this.sessionLoaded && this.loadedSessionPath === sessionPath) return;

    await migrateLegacyProfileFile(this.profileLegacySessionFilePath(), sessionPath);
    await migrateLegacyProfileFile(this.profileLegacySecretFilePath(), this.profileSecretStorePath());
    this.session = await readSessionStore(sessionPath, this.cfg.rememberUnlockedSessionDefault);
    this.loadedSessionPath = sessionPath;
    this.sessionLoaded = true;
  }

  private setupProfile(): SetupProfile {
    return this.cfg.setupProfile;
  }

  private profileConfig(): api.Config {
    const profile = this.setupProfile();
    const baseLogDir = path.resolve(process.cwd(), 'logs', 'did-manager-service', profile);
    if (profile === 'standalone') {
      setNetworkId('undeployed');
      return {
        logDir: `${baseLogDir}/${nowIso()}.log`,
        indexer: this.cfg.standalone.indexer,
        indexerWS: this.cfg.standalone.indexerWS,
        node: this.cfg.standalone.node,
        proofServer: this.cfg.standalone.proofServer,
      };
    }

    setNetworkId('preprod');
    return {
      logDir: `${baseLogDir}/${nowIso()}.log`,
      indexer: this.cfg.preprod.indexer,
      indexerWS: this.cfg.preprod.indexerWS,
      node: this.cfg.preprod.node,
      proofServer: this.cfg.preprod.proofServer,
    };
  }

  private midnightDbPath(seed: string): string {
    const seedHash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
    return path.join(
      this.profileRootDir(),
      'midnight-level-db',
      seedHash,
    );
  }

  private requireUnlocked(): {
    providers: api.MidnightDIDProviders;
    didContract: api.DeployedMidnightDIDContract;
    secretStore: FileSecretStore;
  } {
    if (!this.unlocked || this.providers === null || this.didContract === null || this.secretStore === null) {
      throw new Error('Session is locked or DID contract is not selected.');
    }
    return { providers: this.providers, didContract: this.didContract, secretStore: this.secretStore };
  }

  private requireUnlockedNoContract(): { providers: api.MidnightDIDProviders; secretStore: FileSecretStore } {
    if (!this.unlocked || this.providers === null || this.secretStore === null) {
      throw new Error('Session is locked. Unlock session first.');
    }
    return { providers: this.providers, secretStore: this.secretStore };
  }

  private currentContractAddress(): string | null {
    return this.didContract?.deployTxData.public.contractAddress ?? null;
  }

  private currentProfileState() {
    return this.session.profiles[this.setupProfile()];
  }

  private mergeContractAddresses(existing: string[] | undefined, next?: string | null): string[] {
    const values = Array.isArray(existing) ? existing.filter((value) => value.length > 0) : [];
    if (typeof next !== 'string' || next.length === 0) return values;
    return [next, ...values.filter((value) => value !== next)];
  }

  private async saveCurrentProfileState(
    next: Partial<NonNullable<SessionStore['profiles'][NetworkProfile]>>,
  ): Promise<void> {
    await this.ensureSessionLoaded();
    const profile = this.setupProfile();
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

  private buildVerificationMethod(methodId: string, publicJwk: PublicJwk) {
    if (this.didContract === null) {
      throw new Error('Session is locked or DID contract is not selected.');
    }
    const contractAddress = parseContractAddress(this.didContract.deployTxData.public.contractAddress);
    const didSubject = createMidnightDIDString(contractAddress, runtimeNetworkMap[getNetworkId()]);
    return createVerificationMethod({
      id: methodId,
      type: VerificationMethodType.JsonWebKey,
      controller: didSubject,
      publicKeyJwk: {
        kty: publicJwk.kty === 'EC' ? KeyType.EC : KeyType.OKP,
        crv: publicJwk.crv as CurveType,
        x: publicJwk.x,
        y: publicJwk.y,
      },
    });
  }

  private async persistRuntimeSession(): Promise<void> {
    const profile = this.currentProfileState();
    if (!profile?.seed) return;

    await this.saveCurrentProfileState({
      seed: profile.seed,
      unshieldedAddress: profile.unshieldedAddress,
      contractAddress: this.currentContractAddress() ?? profile.contractAddress,
    });
  }

  private faucetUrl(profile: SetupProfile = this.setupProfile()): string | null {
    return profile === 'preprod' ? 'https://faucet.preprod.midnight.network/' : null;
  }

  private resolveSeedInput(
    input: { seedMode: 'reuse' | 'provided' | 'generated'; seed?: string },
  ): { seed: string; generatedSeed?: string } {
    const profile = this.setupProfile();
    const profileState = this.session.profiles[profile];

    if (input.seedMode === 'reuse') {
      if (!profileState?.seed) {
        throw new Error(`No stored seed found for profile '${profile}'.`);
      }
      return { seed: profileState.seed };
    }

    if (input.seedMode === 'provided') {
      if (!input.seed || input.seed.trim() === '') {
        throw new Error('Seed is required when seedMode=provided.');
      }
      return { seed: input.seed.trim() };
    }

    const generatedSeed = generateSeedHex();
    return { seed: generatedSeed, generatedSeed };
  }

  getSetupStatus(): SetupStatus {
    const profile = this.setupProfile();
    const endpoints = profile === 'standalone'
      ? {
          node: this.cfg.standalone.node,
          indexer: this.cfg.standalone.indexer,
          proofServer: this.cfg.standalone.proofServer,
        }
      : {
          node: this.cfg.preprod.node,
          indexer: this.cfg.preprod.indexer,
          proofServer: this.cfg.preprod.proofServer,
        };

    return {
      profile,
      faucetUrl: this.faucetUrl(profile),
      endpoints,
    };
  }

  async getSessionStatus(): Promise<SessionStatus> {
    await this.ensureSessionLoaded();
    const profile = this.setupProfile();
    const profileState = this.currentProfileState();
    return {
      unlocked: this.unlocked,
      profile,
      profileName: this.selectedProfileName,
      rememberUnlockedSession: this.session.rememberUnlockedSession,
      contractAddress: this.currentContractAddress() ?? profileState?.contractAddress ?? null,
      knownContractAddresses: profileState?.contractAddresses ?? [],
      seedAvailable: Boolean(profileState?.seed),
      unshieldedAddress: profileState?.unshieldedAddress ?? null,
      faucetUrl: this.faucetUrl(profile),
    };
  }

  async listProfiles(): Promise<ProfileSelection> {
    await this.ensureProfileIndexLoaded();
    const availableProfileNames = Array.from(new Set(['default', ...await listProfileNames(path.join(this.baseDataDir(), 'profiles', this.setupProfile()))]));
    return {
      profile: this.setupProfile(),
      activeProfileName: this.selectedProfileName,
      availableProfileNames,
    };
  }

  async selectProfile(input: { name: string }): Promise<SessionStatus> {
    await this.ensureProfileIndexLoaded();
    const nextProfileName = input.name.trim();
    if (!profileNamePattern.test(nextProfileName)) {
      throw new Error('Profile name must start with an alphanumeric character and contain only letters, numbers, dot, underscore, or dash.');
    }
    if (this.unlocked) {
      await this.lock();
    }
    this.selectedProfileName = nextProfileName;
    this.profileIndex.selectedProfiles[this.setupProfile()] = nextProfileName;
    await writeProfileIndex(this.profileIndexFilePath(), this.profileIndex);
    this.sessionLoaded = false;
    this.loadedSessionPath = null;
    await this.ensureSessionLoaded();
    return this.getSessionStatus();
  }

  async updatePreferences(input: { rememberUnlockedSession: boolean }): Promise<SessionStatus> {
    await this.ensureSessionLoaded();
    this.session.rememberUnlockedSession = input.rememberUnlockedSession;
    await writeSessionStore(this.profileSessionFilePath(), this.session);
    return this.getSessionStatus();
  }

  async prepareFunding(input: PrepareFundingRequest): Promise<FundingPreparation> {
    await this.ensureSessionLoaded();

    const profile = this.setupProfile();
    const { seed, generatedSeed } = this.resolveSeedInput(input);
    this.profileConfig();
    const unshieldedAddress = api.deriveUnshieldedAddressFromSeed(seed);

    await this.saveCurrentProfileState({
      seed,
      unshieldedAddress,
    });

    return {
      profile,
      unshieldedAddress,
      faucetUrl: this.faucetUrl(profile),
      generatedSeed,
    };
  }

  async unlock(input: UnlockRequest): Promise<{ status: SessionStatus; generatedSeed?: string }> {
    await this.ensureSessionLoaded();

    if (this.unlocked) {
      await this.lock();
    }

    const profile = this.setupProfile();
    const profileState = this.currentProfileState();
    const { seed, generatedSeed } = this.resolveSeedInput(input);

    const config = this.profileConfig();
    const providerConfig: api.Config = {
      ...config,
      midnightDbName: this.midnightDbPath(seed),
    };
    this.logger.info(
      { profile, midnightDbName: providerConfig.midnightDbName },
      'Using isolated Midnight private state store',
    );
    const walletCtx = await api.buildWalletAndWaitForFunds(config, seed);
    const providers = await api.configureProviders(walletCtx, providerConfig);
    const secretStore = new FileSecretStore();
    await secretStore.initialize({
      location: this.profileSecretStorePath(),
      passphrase: input.passphrase ?? this.cfg.defaultSecretPassphrase,
    });

    let didContract: api.DeployedMidnightDIDContract | null = null;
    if (input.seedMode === 'reuse' && profileState?.contractAddress) {
      try {
        didContract = await api.joinContract(providers, profileState.contractAddress);
      } catch (error) {
        this.logger.warn({ err: error }, 'Failed to auto-join stored contract');
      }
    }

    this.unlocked = true;
    this.walletCtx = walletCtx;
    this.providers = providers;
    this.secretStore = secretStore;
    this.didContract = didContract;

    await this.saveCurrentProfileState({
      seed,
      unshieldedAddress: profileState?.unshieldedAddress ?? api.deriveUnshieldedAddressFromSeed(seed),
      contractAddress: didContract?.deployTxData.public.contractAddress ?? profileState?.contractAddress,
    });
    if (typeof input.rememberUnlockedSession === 'boolean') {
      this.session.rememberUnlockedSession = input.rememberUnlockedSession;
      await writeSessionStore(this.profileSessionFilePath(), this.session);
    }

    return {
      status: await this.getSessionStatus(),
      generatedSeed,
    };
  }

  async lock(): Promise<SessionStatus> {
    if (this.walletCtx !== null) {
      await this.walletCtx.wallet.stop();
    }
    this.unlocked = false;
    this.walletCtx = null;
    this.providers = null;
    this.didContract = null;
    this.secretStore = null;
    return this.getSessionStatus();
  }

  async deployDid(): Promise<unknown> {
    const { providers } = this.requireUnlockedNoContract();
    if (this.walletCtx === null) {
      throw new Error('Session is locked. Unlock session first.');
    }
    this.logger.info('Ensuring dust is available before DID deployment');
    await api.registerForDustGeneration(
      this.walletCtx.wallet,
      this.walletCtx.unshieldedKeystore,
    );
    this.logger.info('Deploying Midnight DID contract');
    const privateState = await api.initPrivateState(providers);
    this.didContract = await api.createDID(providers, privateState);
    this.logger.info(
      { contractAddress: this.currentContractAddress() },
      'Midnight DID contract deployed',
    );
    await this.persistRuntimeSession();
    return { contractAddress: this.currentContractAddress() };
  }

  async joinDid(input: { contractAddress: string }): Promise<unknown> {
    const { providers } = this.requireUnlockedNoContract();
    this.didContract = await api.joinContract(providers, input.contractAddress);
    await this.persistRuntimeSession();
    return { contractAddress: this.currentContractAddress() };
  }

  async getDidState(): Promise<DidStateResponse | null> {
    const { providers, didContract } = this.requireUnlocked();
    const contractAddress = parseContractAddress(didContract.deployTxData.public.contractAddress);
    const didState = await api.getMidnightDIDLedgerState(providers, contractAddress);
    return {
      contractAddress: didContract.deployTxData.public.contractAddress,
      didState: didState === null ? null : LedgerToDomain.toJSON(didState),
    };
  }

  async getDidDocument(): Promise<DidDocumentResponse> {
    const { providers, didContract } = this.requireUnlocked();
    return api.resolve(providers, didContract);
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
    const publicJwk = await secretStore.getPublicKey(input.keyRef);
    normalizePublicForLedger(publicJwk);
    const method = this.buildVerificationMethod(input.methodId, publicJwk);
    await api.addVerificationMethod(didContract, method);
    await this.persistRuntimeSession();
    return { updated: true };
  }

  async updateVerificationMethod(input: { methodId: string; keyRef: string }): Promise<unknown> {
    const { didContract, secretStore } = this.requireUnlocked();
    const publicJwk = await secretStore.getPublicKey(input.keyRef);
    normalizePublicForLedger(publicJwk);
    const method = this.buildVerificationMethod(input.methodId, publicJwk);
    await api.updateVerificationMethod(didContract, method);
    return { updated: true };
  }

  async removeVerificationMethod(input: { methodId: string }): Promise<unknown> {
    const { didContract, providers } = this.requireUnlocked();
    await api.removeVerificationMethod(didContract, providers, input.methodId);
    return { removed: true };
  }

  async addRelation(input: { methodId: string; relation: VerificationMethodRelationType }): Promise<unknown> {
    const { didContract, providers } = this.requireUnlocked();
    await api.addVerificationMethodRelation(didContract, providers, input.relation, input.methodId);
    return { updated: true };
  }

  async removeRelation(input: { methodId: string; relation: VerificationMethodRelationType }): Promise<unknown> {
    const { didContract, providers } = this.requireUnlocked();
    await api.removeVerificationMethodRelation(didContract, providers, input.relation, input.methodId);
    return { removed: true };
  }

  async addService(input: { id: string; type: string; serviceEndpoint: ServiceEndpoint }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    await api.addService(didContract, createService({ id: input.id, type: input.type, serviceEndpoint: input.serviceEndpoint }));
    return { updated: true };
  }

  async updateService(input: { id: string; type: string; serviceEndpoint: ServiceEndpoint }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    await api.updateService(didContract, createService({ id: input.id, type: input.type, serviceEndpoint: input.serviceEndpoint }));
    return { updated: true };
  }

  async removeService(input: { id: string }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    await api.removeService(didContract, input.id);
    return { removed: true };
  }

  async addAlsoKnownAs(input: { value: string }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    await api.addAlsoKnownAs(didContract, input.value);
    return { updated: true };
  }

  async removeAlsoKnownAs(input: { value: string }): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    await api.removeAlsoKnownAs(didContract, input.value);
    return { removed: true };
  }

  async deactivateDid(): Promise<unknown> {
    const { didContract } = this.requireUnlocked();
    await api.deactivate(didContract);
    return { deactivated: true };
  }
}
