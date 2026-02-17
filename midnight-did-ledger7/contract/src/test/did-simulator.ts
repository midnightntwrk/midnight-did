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
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger
} from "../managed/did/contract/index.js";
import { type DIDPrivateState, witnesses } from "../witnesses.js";

// Simulator for testing the DID contract
export class DIDSimulator {
  readonly contract: Contract<DIDPrivateState>;
  circuitContext: CircuitContext<DIDPrivateState>;

  constructor() {
    this.contract = new Contract<DIDPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      createConstructorContext({}, "0".repeat(64))
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): DIDPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /**
   * Call the applyOperations circuit with the given operations.
   * Updates the circuit context with the resulting state.
   * The contract requires exactly 4 operations, so we pad with Undefined operations.
   */
  public applyOperations(operations: any[]): void {
    // Pad to exactly 4 operations with Undefined operations
    const paddedOps = [...operations];
    while (paddedOps.length < 4) {
      paddedOps.push({ operationType: 0 }); // OperationType.Undefined = 0
    }
    if (paddedOps.length > 4) {
      throw new Error('Maximum 4 operations allowed per transaction');
    }

    const result = this.contract.impureCircuits.applyOperations(
      this.circuitContext,
      paddedOps as any
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      result.newZswapLocalState,
      result.newContractState,
      result.newPrivateState
    );
  }
}
