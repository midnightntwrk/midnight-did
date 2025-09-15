// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { NetworkId } from '@midnight-ntwrk/ledger';
import { DIDContract, type MidnightDIDPrivateState, MidnightNetwork } from '@midnight-ntwrk/midnight-did-contract';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ImpureCircuitId, MidnightProviders } from '@midnight-ntwrk/midnight-js-types';

export type MidnightDIDCircuits = ImpureCircuitId<DIDContract.Contract<MidnightDIDPrivateState>>;

export const MidnightDIDPrivateStateId = 'midnightDIDPrivateState';

export type MidnightDIDProviders = MidnightProviders<
  MidnightDIDCircuits,
  typeof MidnightDIDPrivateStateId,
  MidnightDIDPrivateState
>;

export type MidnightDIDContract = DIDContract.Contract<MidnightDIDPrivateState>;

export type DeployedMidnightDIDContract = DeployedContract<MidnightDIDContract> | FoundContract<MidnightDIDContract>;

export const NetworkMapping: Record<NetworkId, MidnightNetwork> = {
  [NetworkId.Undeployed]: MidnightNetwork.Undeployed,
  [NetworkId.DevNet]: MidnightNetwork.DevNet,
  [NetworkId.TestNet]: MidnightNetwork.Testnet,
  [NetworkId.MainNet]: MidnightNetwork.Mainnet,
};
