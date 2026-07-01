import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum VerificationMethodType { Undefined = 0, JsonWebKey = 1 }

export enum VerificationMethodRelation { Undefined = 0,
                                         Authentication = 1,
                                         AssertionMethod = 2,
                                         KeyAgreement = 3,
                                         CapabilityInvocation = 4,
                                         CapabilityDelegation = 5
}

export enum MapMutation { Undefined = 0, Insert = 1, Update = 2 }

export enum SetMutation { Undefined = 0, Insert = 1, Remove = 2 }

export enum KeyType { EC = 0, RSA = 1, oct = 2, OKP = 3 }

export enum CurveType { Ed25519 = 0,
                        X25519 = 1,
                        Jubjub = 2,
                        P256 = 3,
                        Secp256k1 = 4
}

export type PublicKeyJwk = { kty: KeyType; crv: CurveType; x: string; y: string
                           };

export type VerificationMethod = { id: string;
                                   typ: VerificationMethodType;
                                   publicKeyJwk: PublicKeyJwk
                                 };

export type SchnorrJubjubVerificationMethod = { id: string;
                                                publicKey: __compactRuntime.JubjubPoint
                                              };

export type Service = { id: string; typ: string; serviceEndpoint: string };

export type Schnorr_SchnorrSignature = { announcement: __compactRuntime.JubjubPoint;
                                         response: bigint
                                       };

export type Witnesses<PS> = {
  getSchnorrReduction(context: __compactRuntime.WitnessContext<Ledger, PS>,
                      challengeHash_0: bigint): [PS, [bigint, bigint]];
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  currentTimestamp(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  rotateControllerKey(context: __compactRuntime.CircuitContext<PS>,
                      newControllerPublicKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setAlsoKnownAs(context: __compactRuntime.CircuitContext<PS>,
                 value_0: string,
                 mutation_0: SetMutation): __compactRuntime.CircuitResults<PS, []>;
  setVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                        verificationMethod_0: VerificationMethod,
                        mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                           id_0: string): __compactRuntime.CircuitResults<PS, []>;
  setSchnorrJubjubVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                                     verificationMethod_0: SchnorrJubjubVerificationMethod,
                                     mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeSchnorrJubjubVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                                        id_0: string): __compactRuntime.CircuitResults<PS, []>;
  verifySchnorrJubjubDigestSignature(context: __compactRuntime.CircuitContext<PS>,
                                     methodId_0: string,
                                     digest_0: bigint[],
                                     signature_0: Schnorr_SchnorrSignature): __compactRuntime.CircuitResults<PS, []>;
  setVerificationMethodRelation(context: __compactRuntime.CircuitContext<PS>,
                                relation_0: VerificationMethodRelation,
                                methodId_0: string,
                                mutation_0: SetMutation): __compactRuntime.CircuitResults<PS, []>;
  setService(context: __compactRuntime.CircuitContext<PS>,
             service_0: Service,
             mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeService(context: __compactRuntime.CircuitContext<PS>, id_0: string): __compactRuntime.CircuitResults<PS, []>;
  deactivate(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  rotateControllerKey(context: __compactRuntime.CircuitContext<PS>,
                      newControllerPublicKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setAlsoKnownAs(context: __compactRuntime.CircuitContext<PS>,
                 value_0: string,
                 mutation_0: SetMutation): __compactRuntime.CircuitResults<PS, []>;
  setVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                        verificationMethod_0: VerificationMethod,
                        mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                           id_0: string): __compactRuntime.CircuitResults<PS, []>;
  setSchnorrJubjubVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                                     verificationMethod_0: SchnorrJubjubVerificationMethod,
                                     mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeSchnorrJubjubVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                                        id_0: string): __compactRuntime.CircuitResults<PS, []>;
  verifySchnorrJubjubDigestSignature(context: __compactRuntime.CircuitContext<PS>,
                                     methodId_0: string,
                                     digest_0: bigint[],
                                     signature_0: Schnorr_SchnorrSignature): __compactRuntime.CircuitResults<PS, []>;
  setVerificationMethodRelation(context: __compactRuntime.CircuitContext<PS>,
                                relation_0: VerificationMethodRelation,
                                methodId_0: string,
                                mutation_0: SetMutation): __compactRuntime.CircuitResults<PS, []>;
  setService(context: __compactRuntime.CircuitContext<PS>,
             service_0: Service,
             mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeService(context: __compactRuntime.CircuitContext<PS>, id_0: string): __compactRuntime.CircuitResults<PS, []>;
  deactivate(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  rotateControllerKey(context: __compactRuntime.CircuitContext<PS>,
                      newControllerPublicKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setAlsoKnownAs(context: __compactRuntime.CircuitContext<PS>,
                 value_0: string,
                 mutation_0: SetMutation): __compactRuntime.CircuitResults<PS, []>;
  setVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                        verificationMethod_0: VerificationMethod,
                        mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                           id_0: string): __compactRuntime.CircuitResults<PS, []>;
  setSchnorrJubjubVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                                     verificationMethod_0: SchnorrJubjubVerificationMethod,
                                     mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeSchnorrJubjubVerificationMethod(context: __compactRuntime.CircuitContext<PS>,
                                        id_0: string): __compactRuntime.CircuitResults<PS, []>;
  verifySchnorrJubjubDigestSignature(context: __compactRuntime.CircuitContext<PS>,
                                     methodId_0: string,
                                     digest_0: bigint[],
                                     signature_0: Schnorr_SchnorrSignature): __compactRuntime.CircuitResults<PS, []>;
  setVerificationMethodRelation(context: __compactRuntime.CircuitContext<PS>,
                                relation_0: VerificationMethodRelation,
                                methodId_0: string,
                                mutation_0: SetMutation): __compactRuntime.CircuitResults<PS, []>;
  setService(context: __compactRuntime.CircuitContext<PS>,
             service_0: Service,
             mutation_0: MapMutation): __compactRuntime.CircuitResults<PS, []>;
  removeService(context: __compactRuntime.CircuitContext<PS>, id_0: string): __compactRuntime.CircuitResults<PS, []>;
  deactivate(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly contractVersion: bigint;
  readonly controllerPublicKey: Uint8Array;
  readonly id: { bytes: Uint8Array };
  alsoKnownAs: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: string): boolean;
    [Symbol.iterator](): Iterator<string>
  };
  readonly version: bigint;
  readonly created: bigint;
  readonly updated: bigint;
  readonly deactivated: boolean;
  readonly active: boolean;
  readonly operationCount: bigint;
  verificationMethods: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: string): boolean;
    lookup(key_0: string): VerificationMethod;
    [Symbol.iterator](): Iterator<[string, VerificationMethod]>
  };
  schnorrJubjubVerificationMethods: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: string): boolean;
    lookup(key_0: string): SchnorrJubjubVerificationMethod;
    [Symbol.iterator](): Iterator<[string, SchnorrJubjubVerificationMethod]>
  };
  authenticationRelation: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: string): boolean;
    [Symbol.iterator](): Iterator<string>
  };
  assertionMethodRelation: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: string): boolean;
    [Symbol.iterator](): Iterator<string>
  };
  keyAgreementRelation: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: string): boolean;
    [Symbol.iterator](): Iterator<string>
  };
  capabilityInvocationRelation: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: string): boolean;
    [Symbol.iterator](): Iterator<string>
  };
  capabilityDelegationRelation: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: string): boolean;
    [Symbol.iterator](): Iterator<string>
  };
  services: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: string): boolean;
    lookup(key_0: string): Service;
    [Symbol.iterator](): Iterator<[string, Service]>
  };
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
