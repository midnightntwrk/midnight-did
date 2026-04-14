import {
  type CircuitContext,
  type CircuitResults,
  createCircuitContext,
  createConstructorContext,
  type JubjubPoint,
  sampleContractAddress,
} from "@midnight-ntwrk/compact-runtime";

import {
  type BirthCredential,
  type BirthCredentialPresentation,
  type BirthCredentialPresentationRequest,
  Contract,
  type Ledger,
  ledger,
  type Proof,
} from "../managed/demo/contract/index.js";
import {
  type CredentialsDemoPrivateState,
  witnesses,
} from "../witnesses.js";

export class CredentialsDemoSimulator {
  readonly contract: Contract<CredentialsDemoPrivateState>;
  circuitContext: CircuitContext<CredentialsDemoPrivateState>;

  constructor() {
    this.contract = new Contract<CredentialsDemoPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext(
        {
          holderBirthDateDays: 0n,
          holderBirthDateOpening: new Uint8Array(32),
        },
        "0".repeat(64),
      ),
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public setAgeWitness(days: bigint, opening: Uint8Array): void {
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      this.circuitContext.currentZswapLocalState,
      this.circuitContext.currentQueryContext.state,
      {
        ...this.circuitContext.currentPrivateState,
        holderBirthDateDays: days,
        holderBirthDateOpening: opening,
      },
    );
  }

  private executeCircuit<T>(
    circuitFn: () => CircuitResults<CredentialsDemoPrivateState, T>,
  ): T {
    const result = circuitFn();
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      result.context.currentZswapLocalState,
      result.context.currentQueryContext.state,
      result.context.currentPrivateState,
    );
    return result.result;
  }

  public issueBirthCredential(
    credential: BirthCredential,
    credentialProof: Proof,
    holderPublicKey: JubjubPoint,
  ): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.issueBirthCredential(
        this.circuitContext,
        credential,
        credentialProof,
        holderPublicKey,
      ),
    );
  }

  public verifyBirthPresentation(
    credential: BirthCredential,
    credentialProof: Proof,
    presentation: BirthCredentialPresentation,
    presentationProof: Proof,
    currentDay: bigint,
  ): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.verifyBirthPresentation(
        this.circuitContext,
        credential,
        credentialProof,
        presentation,
        presentationProof,
        currentDay,
      ),
    );
  }

  public verifyBirthPresentationForRequest(
    credential: BirthCredential,
    credentialProof: Proof,
    request: BirthCredentialPresentationRequest,
    presentation: BirthCredentialPresentation,
    presentationProof: Proof,
    currentDay: bigint,
  ): void {
    this.executeCircuit(() =>
      this.contract.impureCircuits.verifyBirthPresentationForRequest(
        this.circuitContext,
        credential,
        credentialProof,
        request,
        presentation,
        presentationProof,
        currentDay,
      ),
    );
  }
}
