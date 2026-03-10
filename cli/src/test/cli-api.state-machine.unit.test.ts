import { describe, expect, it } from 'vitest';

import { buildHints, CliDidState, deriveState, guardTransition } from '../cli-api';

describe('cli-api state machine', () => {
  it('derives NoContract when no contract selected', () => {
    expect(deriveState(false, null)).toBe(CliDidState.NoContract);
  });

  it('blocks mutating events in NoContract state', () => {
    const guard = guardTransition(CliDidState.NoContract, 'AddService');
    expect(guard.allowed).toBe(false);
  });

  it('allows deploy/join in NoContract state', () => {
    expect(guardTransition(CliDidState.NoContract, 'DeployContract').allowed).toBe(true);
    expect(guardTransition(CliDidState.NoContract, 'JoinContract').allowed).toBe(true);
  });

  it('returns shortlist hints for active DID with methods', () => {
    const hints = buildHints(CliDidState.DidActiveWithMethods, {
      active: true,
      deactivated: false,
      hasMethods: true,
      hasRelations: false,
      hasServicesOrAliases: false,
    });
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]?.action).toBeTruthy();
  });
});
