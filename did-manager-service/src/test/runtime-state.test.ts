import pino from 'pino';
import type { Subscription } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ManagerRuntimeState } from '../manager/runtime-state.js';

describe('ManagerRuntimeState', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps phase timing stable within a phase and resets it on phase changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const runtime = new ManagerRuntimeState(pino({ enabled: false }), 0, async () => undefined);

    vi.setSystemTime(new Date('2026-01-01T00:00:05.000Z'));
    runtime.setConnectionState('starting');
    const starting = runtime.getConnection();
    expect(starting.phase).toBe('starting');
    expect(starting.phaseStartedAt).toBe('2026-01-01T00:00:05.000Z');
    expect(starting.phaseElapsedMs).toBe(0);

    vi.setSystemTime(new Date('2026-01-01T00:00:08.000Z'));
    runtime.setConnectionState('starting');
    const samePhase = runtime.getConnection();
    expect(samePhase.phaseStartedAt).toBe(starting.phaseStartedAt);
    expect(samePhase.phaseElapsedMs).toBe(3_000);

    vi.setSystemTime(new Date('2026-01-01T00:00:12.000Z'));
    runtime.setConnectionState('syncing');
    const changedPhase = runtime.getConnection();
    expect(changedPhase.phase).toBe('syncing');
    expect(changedPhase.phaseStartedAt).toBe('2026-01-01T00:00:12.000Z');
    expect(changedPhase.phaseElapsedMs).toBe(0);
  });

  it('resets phase timing when wallet-state updates move syncing to waiting-for-funds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    let walletStateNext: ((state: unknown) => void) | null = null;
    const runtime = new ManagerRuntimeState(pino({ enabled: false }), 0, async () => undefined);
    const syncedWalletState = (isSynced: boolean) => ({
      isSynced,
      unshielded: {
        balances: new Proxy({}, { get: () => 0n }),
      },
      dust: {
        balance: () => 0n,
      },
    });
    runtime.attachWalletContext({
      wallet: {
        state: () => ({
          subscribe: ({ next }: { next: (state: unknown) => void }): Subscription => {
            walletStateNext = next;
            return { unsubscribe: vi.fn() } as unknown as Subscription;
          },
        }),
        stop: vi.fn(),
      },
    } as never);

    const generation = runtime.nextUnlockGeneration();
    runtime.setConnectionState('syncing', { lastError: 'previous stream error' });
    runtime.startWalletStateTracking(generation);

    vi.setSystemTime(new Date('2026-01-01T00:00:05.000Z'));
    walletStateNext?.(syncedWalletState(false));

    const repeatedSyncing = runtime.getConnection();
    expect(repeatedSyncing.phase).toBe('syncing');
    expect(repeatedSyncing.phaseStartedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(repeatedSyncing.phaseElapsedMs).toBe(5_000);
    expect(repeatedSyncing.lastError).toBeNull();

    vi.setSystemTime(new Date('2026-01-01T00:00:09.000Z'));
    walletStateNext?.(syncedWalletState(true));

    const connection = runtime.getConnection();
    expect(connection.phase).toBe('waitingForFunds');
    expect(connection.phaseStartedAt).toBe('2026-01-01T00:00:09.000Z');
    expect(connection.phaseElapsedMs).toBe(0);
    expect(connection.lastError).toBeNull();
  });

  it('records unlock failure timing without resetting repeated error emissions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const runtime = new ManagerRuntimeState(pino({ enabled: false }), 0, async () => undefined);

    vi.setSystemTime(new Date('2026-01-01T00:00:05.000Z'));
    runtime.markUnlockFailed(new Error('first failure'));
    const firstFailure = runtime.getConnection();
    expect(firstFailure.phase).toBe('error');
    expect(firstFailure.phaseStartedAt).toBe('2026-01-01T00:00:05.000Z');
    expect(firstFailure.phaseElapsedMs).toBe(0);
    expect(firstFailure.lastError).toBe('first failure');

    vi.setSystemTime(new Date('2026-01-01T00:00:08.000Z'));
    runtime.markUnlockFailed(new Error('second failure'));
    const repeatedFailure = runtime.getConnection();
    expect(repeatedFailure.phase).toBe('error');
    expect(repeatedFailure.phaseStartedAt).toBe(firstFailure.phaseStartedAt);
    expect(repeatedFailure.phaseElapsedMs).toBe(3_000);
    expect(repeatedFailure.lastError).toBe('second failure');
  });
});
