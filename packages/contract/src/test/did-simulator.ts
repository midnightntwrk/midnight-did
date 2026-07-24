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
  type ContractAddress,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress
} from "@midnight-ntwrk/compact-runtime";

import {
  deriveControllerPublicKey,
  signControllerAuthorization
} from "../controller-key.js";
import {
  Contract,
  type Ledger,
  ledger,
  MapMutation,
  SetMutation
} from "../managed/did/contract/index.js";
import { type DIDPrivateState, witnesses } from "../witnesses.js";

// Simulator for testing the DID contract
export class DIDSimulator {
  readonly contract: Contract<DIDPrivateState>;
  readonly contractAddress: ContractAddress;
  circuitContext: CircuitContext<DIDPrivateState>;

  constructor(contractWitnesses: typeof witnesses = witnesses) {
    this.contract = new Contract<DIDPrivateState>(contractWitnesses);
    this.contractAddress = sampleContractAddress();
    const secretKey = new Uint8Array(32).fill(1);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      createConstructorContext({ secretKey }, "0".repeat(64))
    );
    this.circuitContext = createCircuitContext(
      this.contractAddress,
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

  public setPrivateState(privateState: DIDPrivateState): void {
    this.circuitContext = createCircuitContext(
      this.contractAddress,
      this.circuitContext.currentZswapLocalState,
      this.circuitContext.currentQueryContext.state,
      privateState
    );
  }

  /**
   * Execute a circuit and update the context with the resulting state.
   */
  private executeCircuit(circuitFn: () => any): void {
    const result = circuitFn();
    this.circuitContext = createCircuitContext(
      this.contractAddress,
      result.context.currentZswapLocalState,
      result.context.currentQueryContext.state,
      result.context.currentPrivateState
    );
  }

  public controllerAuthorization(): [any, bigint] {
    const expectedVersion = this.getLedger().version;
    return [
      signControllerAuthorization(
        this.getPrivateState().secretKey,
        this.getLedger().id,
        expectedVersion
      ),
      expectedVersion
    ];
  }

  public staleControllerAuthorization(): [any, bigint] {
    return [
      signControllerAuthorization(
        this.getPrivateState().secretKey,
        this.getLedger().id,
        this.getLedger().version
      ),
      this.getLedger().version
    ];
  }

  // Individual circuit methods
  public rotateControllerKey(newSecretKey: Uint8Array): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.rotateControllerKey(
        this.circuitContext,
        deriveControllerPublicKey(newSecretKey),
        signature,
        expectedVersion
      )
    );
    this.setPrivateState({ secretKey: new Uint8Array(newSecretKey) });
  }

  public rotateControllerPublicKey(newControllerPublicKey: any): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.rotateControllerKey(
        this.circuitContext,
        newControllerPublicKey,
        signature,
        expectedVersion
      )
    );
  }

  public addVerificationMethod(vm: any): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setVerificationMethod(
        this.circuitContext,
        vm,
        MapMutation.Insert,
        signature,
        expectedVersion
      )
    );
  }

  public updateVerificationMethod(vm: any): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setVerificationMethod(
        this.circuitContext,
        vm,
        MapMutation.Update,
        signature,
        expectedVersion
      )
    );
  }

  public removeVerificationMethod(id: string): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.removeVerificationMethod(
        this.circuitContext,
        id,
        signature,
        expectedVersion
      )
    );
  }

  public addSchnorrJubjubVerificationMethod(vm: any): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setSchnorrJubjubVerificationMethod(
        this.circuitContext,
        {
          id: vm.id,
          publicKey: vm.publicKey
        },
        MapMutation.Insert,
        signature,
        expectedVersion
      )
    );
  }

  public updateSchnorrJubjubVerificationMethod(vm: any): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setSchnorrJubjubVerificationMethod(
        this.circuitContext,
        {
          id: vm.id,
          publicKey: vm.publicKey
        },
        MapMutation.Update,
        signature,
        expectedVersion
      )
    );
  }

  public removeSchnorrJubjubVerificationMethod(id: string): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.removeSchnorrJubjubVerificationMethod(
        this.circuitContext,
        id,
        signature,
        expectedVersion
      )
    );
  }

  public verifySchnorrJubjubDigestSignature(
    methodId: string,
    digest: bigint[],
    signature: any
  ): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.verifySchnorrJubjubDigestSignature(
        this.circuitContext,
        methodId,
        digest,
        signature
      )
    );
  }

  public addVerificationMethodRelation(relation: any, methodId: string): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setVerificationMethodRelation(
        this.circuitContext,
        relation,
        methodId,
        SetMutation.Insert,
        signature,
        expectedVersion
      )
    );
  }

  public removeVerificationMethodRelation(
    relation: any,
    methodId: string
  ): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setVerificationMethodRelation(
        this.circuitContext,
        relation,
        methodId,
        SetMutation.Remove,
        signature,
        expectedVersion
      )
    );
  }

  public addService(service: any): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setService(
        this.circuitContext,
        service,
        MapMutation.Insert,
        signature,
        expectedVersion
      )
    );
  }

  public updateService(service: any): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setService(
        this.circuitContext,
        service,
        MapMutation.Update,
        signature,
        expectedVersion
      )
    );
  }

  public removeService(id: string): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.removeService(
        this.circuitContext,
        id,
        signature,
        expectedVersion
      )
    );
  }

  public addAlsoKnownAs(value: string): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.addAlsoKnownAsWithAuthorization(value, signature, expectedVersion);
  }

  public addAlsoKnownAsWithAuthorization(
    value: string,
    signature: any,
    expectedVersion: bigint
  ): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.setAlsoKnownAs(
        this.circuitContext,
        value,
        SetMutation.Insert,
        signature,
        expectedVersion
      )
    );
  }

  public removeAlsoKnownAs(value: string): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.setAlsoKnownAs(
        this.circuitContext,
        value,
        SetMutation.Remove,
        signature,
        expectedVersion
      )
    );
  }

  public deactivate(): void {
    const [signature, expectedVersion] = this.controllerAuthorization();
    this.executeCircuit(() =>
      this.contract.impureCircuits.deactivate(
        this.circuitContext,
        signature,
        expectedVersion
      )
    );
  }
}
