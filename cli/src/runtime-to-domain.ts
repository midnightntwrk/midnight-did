import { MidnightNetwork } from '@midnight-ntwrk/midnight-did-contract';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export class RuntimeToDomain {
  static readonly NetworkMap: Record<NetworkId, MidnightNetwork> = {
    [NetworkId.Undeployed]: MidnightNetwork.Undeployed,
    [NetworkId.DevNet]: MidnightNetwork.DevNet,
    [NetworkId.TestNet]: MidnightNetwork.Testnet,
    [NetworkId.MainNet]: MidnightNetwork.Mainnet,
  };
}
