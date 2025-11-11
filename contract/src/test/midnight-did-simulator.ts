import {
  type CircuitContext,
  constructorContext,
  QueryContext,
  sampleContractAddress
} from "@midnight-ntwrk/compact-runtime";

import { OperationBuilder } from "../ledger-operation-builder";
import {
  Contract,
  DIDUpdateOperation,
  type Ledger,
  ledger
} from "../managed/did/contract/index.cjs";
import { type MidnightDIDPrivateState, witnesses } from "../witnesses.js";

export class MidnightDIDSimulator {
  readonly contract: Contract<MidnightDIDPrivateState>;
  circuitContext: CircuitContext<MidnightDIDPrivateState>;

  constructor(secretKey: Uint8Array = Uint8Array.from({ length: 32 }).fill(0)) {
    let midnightDIDPrivateState: MidnightDIDPrivateState = {
      secretKey: secretKey
    };

    this.contract = new Contract<MidnightDIDPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      constructorContext(midnightDIDPrivateState, "0".repeat(64))
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      originalState: currentContractState,
      transactionContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress()
      )
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.transactionContext.state);
  }

  public getPrivateState(): MidnightDIDPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public applyOperation(operation: DIDUpdateOperation): Ledger {
    return this.applyOperations(Array.of(operation));
  }

  public applyOperations(operations: Array<DIDUpdateOperation>): Ledger {
    const ledgerOperations = OperationBuilder.padding(operations);
    this.circuitContext = this.contract.impureCircuits.applyOperations(
      this.circuitContext,
      ledgerOperations
    ).context;
    return this.getLedger();
  }
}
