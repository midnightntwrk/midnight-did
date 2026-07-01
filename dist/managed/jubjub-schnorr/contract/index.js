import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.15.0');

const _descriptor_0 = __compactRuntime.CompactTypeField;

const _descriptor_1 = new __compactRuntime.CompactTypeVector(4, _descriptor_0);

const _descriptor_2 = __compactRuntime.CompactTypeJubjubPoint;

class _SchnorrSignature_0 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_0.alignment());
  }
  fromValue(value_0) {
    return {
      announcement: _descriptor_2.fromValue(value_0),
      response: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.announcement).concat(_descriptor_0.toValue(value_0.response));
  }
}

const _descriptor_3 = new _SchnorrSignature_0();

const _descriptor_4 = new __compactRuntime.CompactTypeUnsignedInteger(127n, 1);

const _descriptor_5 = new __compactRuntime.CompactTypeUnsignedInteger(452312848583266388373324160190187140051835877600158453279131187530910662655n, 31);

class _tuple_0 {
  alignment() {
    return _descriptor_4.alignment().concat(_descriptor_5.alignment());
  }
  fromValue(value_0) {
    return [
      _descriptor_4.fromValue(value_0),
      _descriptor_5.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_4.toValue(value_0[0]).concat(_descriptor_5.toValue(value_0[1]));
  }
}

const _descriptor_6 = new _tuple_0();

class _SchnorrHashInput_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment()))));
  }
  fromValue(value_0) {
    return {
      ann_x: _descriptor_0.fromValue(value_0),
      ann_y: _descriptor_0.fromValue(value_0),
      pk_x: _descriptor_0.fromValue(value_0),
      pk_y: _descriptor_0.fromValue(value_0),
      msg: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.ann_x).concat(_descriptor_0.toValue(value_0.ann_y).concat(_descriptor_0.toValue(value_0.pk_x).concat(_descriptor_0.toValue(value_0.pk_y).concat(_descriptor_1.toValue(value_0.msg)))));
  }
}

const _descriptor_7 = new _SchnorrHashInput_0();

const _descriptor_8 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_9 = __compactRuntime.CompactTypeBoolean;

const _descriptor_10 = new __compactRuntime.CompactTypeBytes(32);

class _Either_0 {
  alignment() {
    return _descriptor_9.alignment().concat(_descriptor_10.alignment().concat(_descriptor_10.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_9.fromValue(value_0),
      left: _descriptor_10.fromValue(value_0),
      right: _descriptor_10.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_9.toValue(value_0.is_left).concat(_descriptor_10.toValue(value_0.left).concat(_descriptor_10.toValue(value_0.right)));
  }
}

const _descriptor_11 = new _Either_0();

const _descriptor_12 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_10.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_10.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_10.toValue(value_0.bytes);
  }
}

const _descriptor_13 = new _ContractAddress_0();

const _descriptor_14 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.getSchnorrReduction) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getSchnorrReduction');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      schnorrVerifyDigest: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`schnorrVerifyDigest: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const digest_0 = args_1[1];
        const signature_0 = args_1[2];
        const pk_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('schnorrVerifyDigest',
                                     'argument 1 (as invoked from Typescript)',
                                     'jubjub-schnorr.compact line 14 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(Array.isArray(digest_0) && digest_0.length === 4 && digest_0.every((t) => typeof(t) === 'bigint' && t >= 0 && t <= __compactRuntime.MAX_FIELD))) {
          __compactRuntime.typeError('schnorrVerifyDigest',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'jubjub-schnorr.compact line 14 char 1',
                                     'Vector<4, Field>',
                                     digest_0)
        }
        if (!(typeof(signature_0) === 'object' && true && typeof(signature_0.response) === 'bigint' && signature_0.response >= 0 && signature_0.response <= __compactRuntime.MAX_FIELD)) {
          __compactRuntime.typeError('schnorrVerifyDigest',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'jubjub-schnorr.compact line 14 char 1',
                                     'struct SchnorrSignature<announcement: Opaque<"JubjubPoint">, response: Field>',
                                     signature_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(digest_0).concat(_descriptor_3.toValue(signature_0).concat(_descriptor_2.toValue(pk_0))),
            alignment: _descriptor_1.alignment().concat(_descriptor_3.alignment().concat(_descriptor_2.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._schnorrVerifyDigest_1(context,
                                                     partialProofData,
                                                     digest_0,
                                                     signature_0,
                                                     pk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      schnorrChallengeDigest(context, ...args_1) {
        return { result: pureCircuits.schnorrChallengeDigest(...args_1), context };
      }
    };
    this.impureCircuits = {
      schnorrVerifyDigest: this.circuits.schnorrVerifyDigest
    };
    this.provableCircuits = this.impureCircuits;
    this.provableCircuits = {};
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _transientHash_0(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_7, value_0);
    return result_0;
  }
  _jubjubPointX_0(np_0) {
    const result_0 = __compactRuntime.jubjubPointX(np_0);
    return result_0;
  }
  _jubjubPointY_0(np_0) {
    const result_0 = __compactRuntime.jubjubPointY(np_0);
    return result_0;
  }
  _ecAdd_0(a_0, b_0) {
    const result_0 = __compactRuntime.ecAdd(a_0, b_0);
    return result_0;
  }
  _ecMul_0(a_0, b_0) {
    const result_0 = __compactRuntime.ecMul(a_0, b_0);
    return result_0;
  }
  _ecMulGenerator_0(b_0) {
    const result_0 = __compactRuntime.ecMulGenerator(b_0);
    return result_0;
  }
  _getSchnorrReduction_0(context, partialProofData, challengeHash_0) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getSchnorrReduction(witnessContext_0,
                                                                              challengeHash_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(Array.isArray(result_0) && result_0.length === 2  && typeof(result_0[0]) === 'bigint' && result_0[0] >= 0n && result_0[0] <= 127n && typeof(result_0[1]) === 'bigint' && result_0[1] >= 0n && result_0[1] <= 452312848583266388373324160190187140051835877600158453279131187530910662655n)) {
      __compactRuntime.typeError('getSchnorrReduction',
                                 'return value',
                                 'schnorr.compact line 32 char 3',
                                 '[Uint<0..128>, Uint<0..452312848583266388373324160190187140051835877600158453279131187530910662656>]',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_6.toValue(result_0),
      alignment: _descriptor_6.alignment()
    });
    return result_0;
  }
  _schnorrVerify_0(context, partialProofData, msg_0, signature_0, pk_0) {
    const __compact_pattern_tmp2_0 = signature_0;
    const announcement_0 = __compact_pattern_tmp2_0.announcement;
    const response_0 = __compact_pattern_tmp2_0.response;
    const cFull_0 = this._transientHash_0({ ann_x:
                                              this._jubjubPointX_0(announcement_0),
                                            ann_y:
                                              this._jubjubPointY_0(announcement_0),
                                            pk_x: this._jubjubPointX_0(pk_0),
                                            pk_y: this._jubjubPointY_0(pk_0),
                                            msg: msg_0 });
    const TWO_248_0 = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
    const __compact_pattern_tmp1_0 = this._getSchnorrReduction_0(context,
                                                                 partialProofData,
                                                                 cFull_0);
    const q_0 = __compact_pattern_tmp1_0[0];
    const cTruncated_0 = __compact_pattern_tmp1_0[1];
    let t_0;
    __compactRuntime.assert((t_0 = q_0, t_0 < 116n),
                            'Schnorr quotient out of range');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.mulField(q_0,
                                                                                TWO_248_0),
                                                      cTruncated_0)
                            ===
                            cFull_0,
                            'Invalid challenge reduction');
    const c_0 = cTruncated_0;
    const lhs_0 = this._ecMulGenerator_0(response_0);
    const rhs_0 = this._ecAdd_0(announcement_0, this._ecMul_0(pk_0, c_0));
    __compactRuntime.assert(this._jubjubPointX_0(lhs_0)
                            ===
                            this._jubjubPointX_0(rhs_0)
                            &&
                            this._jubjubPointY_0(lhs_0)
                            ===
                            this._jubjubPointY_0(rhs_0),
                            'Invalid Jubjub Schnorr signature');
    return [];
  }
  _schnorrVerifyDigest_0(context, partialProofData, digest_0, signature_0, pk_0)
  {
    this._schnorrVerify_0(context, partialProofData, digest_0, signature_0, pk_0);
    return [];
  }
  _schnorrChallengeDigest_0(ann_x_0, ann_y_0, pk_x_0, pk_y_0, digest_0) {
    return this._transientHash_0({ ann_x: ann_x_0,
                                   ann_y: ann_y_0,
                                   pk_x: pk_x_0,
                                   pk_y: pk_y_0,
                                   msg: digest_0 });
  }
  _schnorrVerifyDigest_1(context, partialProofData, digest_0, signature_0, pk_0)
  {
    this._schnorrVerifyDigest_0(context,
                                partialProofData,
                                digest_0,
                                signature_0,
                                pk_0);
    return [];
  }
  _schnorrChallengeDigest_1(ann_x_0, ann_y_0, pk_x_0, pk_y_0, digest_0) {
    return this._schnorrChallengeDigest_0(ann_x_0,
                                          ann_y_0,
                                          pk_x_0,
                                          pk_y_0,
                                          digest_0);
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  getSchnorrReduction: (...args) => undefined
});
export const pureCircuits = {
  schnorrChallengeDigest: (...args_0) => {
    if (args_0.length !== 5) {
      throw new __compactRuntime.CompactError(`schnorrChallengeDigest: expected 5 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const ann_x_0 = args_0[0];
    const ann_y_0 = args_0[1];
    const pk_x_0 = args_0[2];
    const pk_y_0 = args_0[3];
    const digest_0 = args_0[4];
    if (!(typeof(ann_x_0) === 'bigint' && ann_x_0 >= 0 && ann_x_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallengeDigest',
                                 'argument 1',
                                 'jubjub-schnorr.compact line 22 char 1',
                                 'Field',
                                 ann_x_0)
    }
    if (!(typeof(ann_y_0) === 'bigint' && ann_y_0 >= 0 && ann_y_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallengeDigest',
                                 'argument 2',
                                 'jubjub-schnorr.compact line 22 char 1',
                                 'Field',
                                 ann_y_0)
    }
    if (!(typeof(pk_x_0) === 'bigint' && pk_x_0 >= 0 && pk_x_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallengeDigest',
                                 'argument 3',
                                 'jubjub-schnorr.compact line 22 char 1',
                                 'Field',
                                 pk_x_0)
    }
    if (!(typeof(pk_y_0) === 'bigint' && pk_y_0 >= 0 && pk_y_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallengeDigest',
                                 'argument 4',
                                 'jubjub-schnorr.compact line 22 char 1',
                                 'Field',
                                 pk_y_0)
    }
    if (!(Array.isArray(digest_0) && digest_0.length === 4 && digest_0.every((t) => typeof(t) === 'bigint' && t >= 0 && t <= __compactRuntime.MAX_FIELD))) {
      __compactRuntime.typeError('schnorrChallengeDigest',
                                 'argument 5',
                                 'jubjub-schnorr.compact line 22 char 1',
                                 'Vector<4, Field>',
                                 digest_0)
    }
    return _dummyContract._schnorrChallengeDigest_1(ann_x_0,
                                                    ann_y_0,
                                                    pk_x_0,
                                                    pk_y_0,
                                                    digest_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
