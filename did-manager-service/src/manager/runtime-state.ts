import * as api from '@midnight-ntwrk/midnight-did-api';
import type { FileSecretStore } from '@midnight-ntwrk/midnight-did-secret-storage';
import type { Logger } from 'pino';
import type { Subscription } from 'rxjs';

import type { SessionStatus } from '../types.js';

type UnlockedRuntime = {
  providers: api.MidnightDIDProviders;
  secretStore: FileSecretStore;
};

export class ManagerRuntimeState {
  private unlocked = false;
  private walletCtx: api.MidnightDIDWalletContext | null = null;
  private providers: api.MidnightDIDProviders | null = null;
  private didContract: api.DeployedMidnightDIDContract | null = null;
  private secretStore: FileSecretStore | null = null;
  private unlockTask: Promise<void> | null = null;
  private unlockGeneration = 0;
  private walletSubscription: Subscription | null = null;
  private idleTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private connectionPhase: SessionStatus['connection']['phase'] = 'locked';
  private connectionLastError: string | null = null;
  private reusedPersistedState = false;
  private activeSeedHash: string | null = null;
  private didLastError: string | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly sessionIdleMs: number,
    private readonly onIdle: () => Promise<void>,
  ) {}

  getWalletContext(): api.MidnightDIDWalletContext | null {
    return this.walletCtx;
  }

  getProviders(): api.MidnightDIDProviders | null {
    return this.providers;
  }

  getDidContract(): api.DeployedMidnightDIDContract | null {
    return this.didContract;
  }

  getSecretStore(): FileSecretStore | null {
    return this.secretStore;
  }

  getUnlockGeneration(): number {
    return this.unlockGeneration;
  }

  getUnlockTask(): Promise<void> | null {
    return this.unlockTask;
  }

  getActiveSeedHash(): string | null {
    return this.activeSeedHash;
  }

  getConnection(): SessionStatus['connection'] {
    return {
      phase: this.connectionPhase,
      reusedPersistedState: this.reusedPersistedState,
      walletStateKey: null,
      lastError: this.connectionLastError,
    };
  }

  getDid(storedContractAddress?: string): SessionStatus['did'] {
    return {
      phase: this.didContract !== null
        ? 'joined'
        : storedContractAddress
          ? 'stored'
          : 'none',
      lastError: this.didLastError,
    };
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  isReadyForSeed(seedHash: string): boolean {
    return this.unlocked && this.connectionPhase === 'ready' && this.activeSeedHash === seedHash;
  }

  currentContractAddress(): string | null {
    return this.didContract?.deployTxData.public.contractAddress ?? null;
  }

  nextUnlockGeneration(): number {
    this.unlockGeneration += 1;
    return this.unlockGeneration;
  }

  setUnlockTask(task: Promise<void> | null): void {
    this.unlockTask = task;
  }

  clearUnlockTaskIfCurrent(generation: number): void {
    if (generation === this.unlockGeneration) {
      this.unlockTask = null;
    }
  }

  setDidContract(contract: api.DeployedMidnightDIDContract | null): void {
    this.didContract = contract;
  }

  setDidLastError(error: string | null): void {
    this.didLastError = error;
  }

  setConnectionState(
    phase: SessionStatus['connection']['phase'],
    options: {
      lastError?: string | null;
      reusedPersistedState?: boolean;
      seedHash?: string | null;
    } = {},
  ): void {
    this.connectionPhase = phase;
    if (options.lastError !== undefined) this.connectionLastError = options.lastError;
    if (options.reusedPersistedState !== undefined) {
      this.reusedPersistedState = options.reusedPersistedState;
    }
    if (options.seedHash !== undefined) this.activeSeedHash = options.seedHash;
  }

  touchSessionActivity(): void {
    if (this.unlocked) this.scheduleIdleTimer();
  }

  requireUnlocked(): {
    providers: api.MidnightDIDProviders;
    didContract: api.DeployedMidnightDIDContract;
    secretStore: FileSecretStore;
  } {
    if (!this.unlocked || this.providers === null || this.didContract === null || this.secretStore === null) {
      throw new Error('Session is locked or DID contract is not selected.');
    }
    this.touchSessionActivity();
    return {
      providers: this.providers,
      didContract: this.didContract,
      secretStore: this.secretStore,
    };
  }

  requireUnlockedNoContract(): UnlockedRuntime {
    if (!this.unlocked || this.providers === null || this.secretStore === null) {
      throw new Error('Session is locked. Unlock session first.');
    }
    this.touchSessionActivity();
    return { providers: this.providers, secretStore: this.secretStore };
  }

  attachWalletContext(walletCtx: api.MidnightDIDWalletContext): void {
    this.walletCtx = walletCtx;
  }

  attachReadySession(input: {
    walletCtx: api.MidnightDIDWalletContext;
    providers: api.MidnightDIDProviders;
    secretStore: FileSecretStore;
    seedHash: string;
    reusedPersistedState: boolean;
  }): void {
    this.walletCtx = input.walletCtx;
    this.providers = input.providers;
    this.secretStore = input.secretStore;
    this.didContract = null;
    this.unlocked = true;
    this.didLastError = null;
    this.setConnectionState('ready', {
      lastError: null,
      reusedPersistedState: input.reusedPersistedState,
      seedHash: input.seedHash,
    });
    this.scheduleIdleTimer();
  }

  startWalletStateTracking(generation: number): void {
    this.clearWalletSubscription();
    if (this.walletCtx === null) return;
    this.walletSubscription = this.walletCtx.wallet.state().subscribe({
      next: (state) => {
        if (generation !== this.unlockGeneration) return;
        if (this.connectionPhase === 'ready' || this.connectionPhase === 'error' || this.connectionPhase === 'locked') {
          return;
        }
        this.connectionLastError = null;
        if (state.isSynced) {
          if (this.connectionPhase === 'syncing' || this.connectionPhase === 'restoring' || this.connectionPhase === 'starting') {
            this.connectionPhase = 'waitingForFunds';
          }
        } else if (this.connectionPhase === 'restoring' || this.connectionPhase === 'starting' || this.connectionPhase === 'waitingForFunds') {
          this.connectionPhase = 'syncing';
        }
      },
      error: (error) => {
        if (generation !== this.unlockGeneration) return;
        this.logger.warn({ err: error }, 'Wallet state stream failed');
      },
    });
  }

  async stopRuntimeSession(persistSnapshot?: (seedHash: string) => Promise<void>): Promise<void> {
    this.clearIdleTimer();
    this.clearWalletSubscription();
    if (this.walletCtx !== null) {
      try {
        if (persistSnapshot !== undefined && this.activeSeedHash !== null) {
          await persistSnapshot(this.activeSeedHash);
        }
      } catch (error) {
        this.logger.warn({ err: error }, 'Failed to persist wallet state during session stop');
      }
      await this.walletCtx.wallet.stop().catch((error) => {
        this.logger.warn({ err: error }, 'Failed to stop wallet facade cleanly');
      });
    }

    this.unlocked = false;
    this.walletCtx = null;
    this.providers = null;
    this.didContract = null;
    this.secretStore = null;
    this.activeSeedHash = null;
    this.reusedPersistedState = false;
    this.didLastError = null;
    this.setConnectionState('locked', { lastError: null, reusedPersistedState: false, seedHash: null });
  }

  markUnlockFailed(error: unknown): void {
    this.connectionLastError = error instanceof Error ? error.message : 'Unlock failed';
    this.connectionPhase = 'error';
    this.unlocked = false;
    this.walletCtx = null;
    this.providers = null;
    this.secretStore = null;
    this.didContract = null;
  }

  private clearWalletSubscription(): void {
    this.walletSubscription?.unsubscribe();
    this.walletSubscription = null;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      globalThis.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleIdleTimer(): void {
    this.clearIdleTimer();
    if (!this.unlocked || this.sessionIdleMs <= 0) return;
    this.idleTimer = globalThis.setTimeout(() => {
      this.onIdle().catch((error) => {
        this.logger.warn({ err: error }, 'Failed to stop idle manager session');
      });
    }, this.sessionIdleMs);
  }
}
