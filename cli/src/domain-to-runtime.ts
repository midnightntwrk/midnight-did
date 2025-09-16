import { MidnightNetwork } from '@midnight-ntwrk/midnight-did-contract';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export class DomainToRuntime {
  static readonly NetworkMap: Record<MidnightNetwork, NetworkId> = {
    [MidnightNetwork.Undeployed]: NetworkId.Undeployed,
    [MidnightNetwork.DevNet]: NetworkId.DevNet,
    [MidnightNetwork.Testnet]: NetworkId.TestNet,
    [MidnightNetwork.Mainnet]: NetworkId.MainNet,
  };
}
