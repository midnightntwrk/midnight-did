import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Schnorr_SchnorrSignature = { announcement: __compactRuntime.JubjubPoint;
                                         response: bigint
                                       };

export type Witnesses<PS> = {
  getSchnorrReduction(context: __compactRuntime.WitnessContext<Ledger, PS>,
                      challengeHash_0: bigint): [PS, [bigint, bigint]];
}

export type ImpureCircuits<PS> = {
  schnorrVerifyDigest(context: __compactRuntime.CircuitContext<PS>,
                      digest_0: bigint[],
                      signature_0: Schnorr_SchnorrSignature,
                      pk_0: __compactRuntime.JubjubPoint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
}

export type PureCircuits = {
  schnorrChallengeDigest(ann_x_0: bigint,
                         ann_y_0: bigint,
                         pk_x_0: bigint,
                         pk_y_0: bigint,
                         digest_0: bigint[]): bigint;
}

export type Circuits<PS> = {
  schnorrVerifyDigest(context: __compactRuntime.CircuitContext<PS>,
                      digest_0: bigint[],
                      signature_0: Schnorr_SchnorrSignature,
                      pk_0: __compactRuntime.JubjubPoint): __compactRuntime.CircuitResults<PS, []>;
  schnorrChallengeDigest(context: __compactRuntime.CircuitContext<PS>,
                         ann_x_0: bigint,
                         ann_y_0: bigint,
                         pk_x_0: bigint,
                         pk_y_0: bigint,
                         digest_0: bigint[]): __compactRuntime.CircuitResults<PS, bigint>;
}

export type Ledger = {
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
