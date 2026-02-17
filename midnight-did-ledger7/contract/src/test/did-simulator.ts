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
   * Execute a circuit and update the context with the resulting state.
   */
  private executeCircuit(circuitFn: () => any): void {
    const result = circuitFn();
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      result.context.currentZswapLocalState,
      result.context.currentQueryContext.state,
      result.context.currentPrivateState
    );
  }

  // Individual circuit methods
  public addVerificationMethod(vm: any): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.addVerificationMethod(this.circuitContext, vm)
    );
  }

  public updateVerificationMethod(vm: any): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.updateVerificationMethod(this.circuitContext, vm)
    );
  }

  public removeVerificationMethod(id: string): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.removeVerificationMethod(this.circuitContext, id)
    );
  }

  public addVerificationMethodRelation(relation: any, methodId: string): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.addVerificationMethodRelation(
        this.circuitContext, relation, methodId
      )
    );
  }

  public removeVerificationMethodRelation(relation: any, methodId: string): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.removeVerificationMethodRelation(
        this.circuitContext, relation, methodId
      )
    );
  }

  public addService(service: any): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.addService(this.circuitContext, service)
    );
  }

  public updateService(service: any): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.updateService(this.circuitContext, service)
    );
  }

  public removeService(id: string): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.removeService(this.circuitContext, id)
    );
  }

  public addAlsoKnownAs(value: string): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.addAlsoKnownAs(this.circuitContext, value)
    );
  }

  public removeAlsoKnownAs(value: string): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.removeAlsoKnownAs(this.circuitContext, value)
    );
  }

  public deactivate(): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.deactivate(this.circuitContext)
    );
  }
}
