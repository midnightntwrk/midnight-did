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

import { WitnessContext } from "@midnight-ntwrk/compact-runtime";

import { Ledger } from "./managed/did/contract/index.js";

export type DIDPrivateState = {
  readonly secretKey: Uint8Array;
};

const TWO_248 =
  452312848583266388373324160190187140051835877600158453279131187530910662656n;

export const witnesses = {
  localSecretKey: ({
    privateState
  }: WitnessContext<Ledger, DIDPrivateState>): [
    DIDPrivateState,
    Uint8Array
  ] => [privateState, privateState.secretKey],
  currentTimestamp: ({
    privateState
  }: WitnessContext<Ledger, DIDPrivateState>): [DIDPrivateState, bigint] => [
    privateState,
    BigInt(Date.now())
  ],
  getSchnorrReduction: (
    { privateState }: WitnessContext<Ledger, DIDPrivateState>,
    challengeHash: bigint
  ): [DIDPrivateState, [bigint, bigint]] => {
    const q = challengeHash / TWO_248;
    const r = challengeHash % TWO_248;
    return [privateState, [q, r]];
  }
};
