import { MidnightNetwork } from '@midnight-ntwrk/midnight-did-contract';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { describe, expect, it } from 'vitest';

import { DomainToRuntime } from '../domain-to-runtime';

describe('DomainToRuntime.NetworkMap', () => {
  it('maps all MidnightNetwork values to NetworkId', () => {
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Undeployed]).toBe(NetworkId.Undeployed);
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.DevNet]).toBe(NetworkId.DevNet);
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Testnet]).toBe(NetworkId.TestNet);
    expect(DomainToRuntime.NetworkMap[MidnightNetwork.Mainnet]).toBe(NetworkId.MainNet);
  });
});

// RuntimeToDomain tests moved to runtime-to-domain.test.ts
