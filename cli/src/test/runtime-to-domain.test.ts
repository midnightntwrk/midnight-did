import { MidnightNetwork } from '@midnight-ntwrk/midnight-did-contract';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { describe, expect, it } from 'vitest';

import { DomainToRuntime } from '../domain-to-runtime';
import { RuntimeToDomain } from '../runtime-to-domain';

describe('RuntimeToDomain.NetworkMap', () => {
  it('maps all NetworkId values to MidnightNetwork', () => {
    expect(RuntimeToDomain.NetworkMap[NetworkId.Undeployed]).toBe(MidnightNetwork.Undeployed);
    expect(RuntimeToDomain.NetworkMap[NetworkId.DevNet]).toBe(MidnightNetwork.DevNet);
    expect(RuntimeToDomain.NetworkMap[NetworkId.TestNet]).toBe(MidnightNetwork.Testnet);
    expect(RuntimeToDomain.NetworkMap[NetworkId.MainNet]).toBe(MidnightNetwork.Mainnet);
  });

  it('is inverse of DomainToRuntime.NetworkMap for all defined values', () => {
    const entries = Object.entries(DomainToRuntime.NetworkMap) as Array<[keyof typeof MidnightNetwork, NetworkId]>;
    for (const [, nid] of entries) {
      expect(RuntimeToDomain.NetworkMap[nid]).toBeDefined();
    }
  });
});
