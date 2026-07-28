// This file is part of midnightntwrk/midnight-did.
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

import {
  type JubjubPoint,
  WitnessContext
} from "@midnight-ntwrk/compact-runtime";
import { TWO_248 } from "@midnight-ntwrk/midnight-did-jubjub-schnorr";

import { deriveControllerPublicKey } from "./controller-key.js";
import { Ledger } from "./managed/did/contract/index.js";

export type DIDPrivateState = {
  readonly secretKey: Uint8Array;
  readonly recoverySecretKey?: Uint8Array;
};

export const witnesses = {
  localControllerPublicKey: ({
    privateState
  }: WitnessContext<Ledger, DIDPrivateState>): [
    DIDPrivateState,
    JubjubPoint
  ] => [privateState, deriveControllerPublicKey(privateState.secretKey)],
  localRecoveryAuthorityPublicKey: ({
    privateState
  }: WitnessContext<Ledger, DIDPrivateState>): [
    DIDPrivateState,
    JubjubPoint
  ] => [
    privateState,
    deriveControllerPublicKey(
      privateState.recoverySecretKey ?? privateState.secretKey
    )
  ],
  currentTimestamp: ({
    privateState
  }: WitnessContext<Ledger, DIDPrivateState>): [DIDPrivateState, bigint] => [
    privateState,
    BigInt(Date.now())
  ],
  getSchnorrReduction: (
    { privateState }: WitnessContext<Ledger, DIDPrivateState>,
    challengeHash: bigint
  ): [DIDPrivateState, [bigint, bigint]] => [
    privateState,
    [challengeHash / TWO_248, challengeHash % TWO_248]
  ]
};
