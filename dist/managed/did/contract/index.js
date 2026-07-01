import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.15.0');

export var VerificationMethodType;
(function (VerificationMethodType) {
  VerificationMethodType[VerificationMethodType['Undefined'] = 0] = 'Undefined';
  VerificationMethodType[VerificationMethodType['JsonWebKey'] = 1] = 'JsonWebKey';
})(VerificationMethodType || (VerificationMethodType = {}));

export var VerificationMethodRelation;
(function (VerificationMethodRelation) {
  VerificationMethodRelation[VerificationMethodRelation['Undefined'] = 0] = 'Undefined';
  VerificationMethodRelation[VerificationMethodRelation['Authentication'] = 1] = 'Authentication';
  VerificationMethodRelation[VerificationMethodRelation['AssertionMethod'] = 2] = 'AssertionMethod';
  VerificationMethodRelation[VerificationMethodRelation['KeyAgreement'] = 3] = 'KeyAgreement';
  VerificationMethodRelation[VerificationMethodRelation['CapabilityInvocation'] = 4] = 'CapabilityInvocation';
  VerificationMethodRelation[VerificationMethodRelation['CapabilityDelegation'] = 5] = 'CapabilityDelegation';
})(VerificationMethodRelation || (VerificationMethodRelation = {}));

export var MapMutation;
(function (MapMutation) {
  MapMutation[MapMutation['Undefined'] = 0] = 'Undefined';
  MapMutation[MapMutation['Insert'] = 1] = 'Insert';
  MapMutation[MapMutation['Update'] = 2] = 'Update';
})(MapMutation || (MapMutation = {}));

export var SetMutation;
(function (SetMutation) {
  SetMutation[SetMutation['Undefined'] = 0] = 'Undefined';
  SetMutation[SetMutation['Insert'] = 1] = 'Insert';
  SetMutation[SetMutation['Remove'] = 2] = 'Remove';
})(SetMutation || (SetMutation = {}));

export var KeyType;
(function (KeyType) {
  KeyType[KeyType['EC'] = 0] = 'EC';
  KeyType[KeyType['RSA'] = 1] = 'RSA';
  KeyType[KeyType['oct'] = 2] = 'oct';
  KeyType[KeyType['OKP'] = 3] = 'OKP';
})(KeyType || (KeyType = {}));

export var CurveType;
(function (CurveType) {
  CurveType[CurveType['Ed25519'] = 0] = 'Ed25519';
  CurveType[CurveType['X25519'] = 1] = 'X25519';
  CurveType[CurveType['Jubjub'] = 2] = 'Jubjub';
  CurveType[CurveType['P256'] = 3] = 'P256';
  CurveType[CurveType['Secp256k1'] = 4] = 'Secp256k1';
})(CurveType || (CurveType = {}));

const _descriptor_0 = __compactRuntime.CompactTypeOpaqueString;

class _Service_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      id: _descriptor_0.fromValue(value_0),
      typ: _descriptor_0.fromValue(value_0),
      serviceEndpoint: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.id).concat(_descriptor_0.toValue(value_0.typ).concat(_descriptor_0.toValue(value_0.serviceEndpoint)));
  }
}

const _descriptor_1 = new _Service_0();

const _descriptor_2 = __compactRuntime.CompactTypeBoolean;

const _descriptor_3 = new __compactRuntime.CompactTypeEnum(5, 1);

const _descriptor_4 = new __compactRuntime.CompactTypeEnum(2, 1);

const _descriptor_5 = new __compactRuntime.CompactTypeEnum(2, 1);

const _descriptor_6 = __compactRuntime.CompactTypeJubjubPoint;

class _SchnorrJubjubVerificationMethod_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_6.alignment());
  }
  fromValue(value_0) {
    return {
      id: _descriptor_0.fromValue(value_0),
      publicKey: _descriptor_6.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.id).concat(_descriptor_6.toValue(value_0.publicKey));
  }
}

const _descriptor_7 = new _SchnorrJubjubVerificationMethod_0();

const _descriptor_8 = __compactRuntime.CompactTypeField;

const _descriptor_9 = new __compactRuntime.CompactTypeVector(4, _descriptor_8);

class _SchnorrSignature_0 {
  alignment() {
    return _descriptor_6.alignment().concat(_descriptor_8.alignment());
  }
  fromValue(value_0) {
    return {
      announcement: _descriptor_6.fromValue(value_0),
      response: _descriptor_8.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_6.toValue(value_0.announcement).concat(_descriptor_8.toValue(value_0.response));
  }
}

const _descriptor_10 = new _SchnorrSignature_0();

const _descriptor_11 = new __compactRuntime.CompactTypeEnum(1, 1);

const _descriptor_12 = new __compactRuntime.CompactTypeEnum(3, 1);

const _descriptor_13 = new __compactRuntime.CompactTypeEnum(4, 1);

class _PublicKeyJwk_0 {
  alignment() {
    return _descriptor_12.alignment().concat(_descriptor_13.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment())));
  }
  fromValue(value_0) {
    return {
      kty: _descriptor_12.fromValue(value_0),
      crv: _descriptor_13.fromValue(value_0),
      x: _descriptor_0.fromValue(value_0),
      y: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_12.toValue(value_0.kty).concat(_descriptor_13.toValue(value_0.crv).concat(_descriptor_0.toValue(value_0.x).concat(_descriptor_0.toValue(value_0.y))));
  }
}

const _descriptor_14 = new _PublicKeyJwk_0();

class _VerificationMethod_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_11.alignment().concat(_descriptor_14.alignment()));
  }
  fromValue(value_0) {
    return {
      id: _descriptor_0.fromValue(value_0),
      typ: _descriptor_11.fromValue(value_0),
      publicKeyJwk: _descriptor_14.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.id).concat(_descriptor_11.toValue(value_0.typ).concat(_descriptor_14.toValue(value_0.publicKeyJwk)));
  }
}

const _descriptor_15 = new _VerificationMethod_0();

const _descriptor_16 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_17 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_18 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

const _descriptor_19 = new __compactRuntime.CompactTypeUnsignedInteger(127n, 1);

const _descriptor_20 = new __compactRuntime.CompactTypeUnsignedInteger(452312848583266388373324160190187140051835877600158453279131187530910662655n, 31);

class _tuple_0 {
  alignment() {
    return _descriptor_19.alignment().concat(_descriptor_20.alignment());
  }
  fromValue(value_0) {
    return [
      _descriptor_19.fromValue(value_0),
      _descriptor_20.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_19.toValue(value_0[0]).concat(_descriptor_20.toValue(value_0[1]));
  }
}

const _descriptor_21 = new _tuple_0();

const _descriptor_22 = new __compactRuntime.CompactTypeVector(2, _descriptor_16);

class _SchnorrHashInput_0 {
  alignment() {
    return _descriptor_8.alignment().concat(_descriptor_8.alignment().concat(_descriptor_8.alignment().concat(_descriptor_8.alignment().concat(_descriptor_9.alignment()))));
  }
  fromValue(value_0) {
    return {
      ann_x: _descriptor_8.fromValue(value_0),
      ann_y: _descriptor_8.fromValue(value_0),
      pk_x: _descriptor_8.fromValue(value_0),
      pk_y: _descriptor_8.fromValue(value_0),
      msg: _descriptor_9.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_8.toValue(value_0.ann_x).concat(_descriptor_8.toValue(value_0.ann_y).concat(_descriptor_8.toValue(value_0.pk_x).concat(_descriptor_8.toValue(value_0.pk_y).concat(_descriptor_9.toValue(value_0.msg)))));
  }
}

const _descriptor_23 = new _SchnorrHashInput_0();

class _Either_0 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_16.alignment().concat(_descriptor_16.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_2.fromValue(value_0),
      left: _descriptor_16.fromValue(value_0),
      right: _descriptor_16.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.is_left).concat(_descriptor_16.toValue(value_0.left).concat(_descriptor_16.toValue(value_0.right)));
  }
}

const _descriptor_24 = new _Either_0();

const _descriptor_25 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_16.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_16.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_16.toValue(value_0.bytes);
  }
}

const _descriptor_26 = new _ContractAddress_0();

const _descriptor_27 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

const _descriptor_28 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

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
    if (typeof(witnesses_0.localSecretKey) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named localSecretKey');
    }
    if (typeof(witnesses_0.currentTimestamp) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named currentTimestamp');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      rotateControllerKey: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`rotateControllerKey: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const newControllerPublicKey_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('rotateControllerKey',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 221 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(newControllerPublicKey_0.buffer instanceof ArrayBuffer && newControllerPublicKey_0.BYTES_PER_ELEMENT === 1 && newControllerPublicKey_0.length === 32)) {
          __compactRuntime.typeError('rotateControllerKey',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'did.compact line 221 char 1',
                                     'Bytes<32>',
                                     newControllerPublicKey_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_16.toValue(newControllerPublicKey_0),
            alignment: _descriptor_16.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._rotateControllerKey_0(context,
                                                     partialProofData,
                                                     newControllerPublicKey_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      setAlsoKnownAs: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`setAlsoKnownAs: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const value_0 = args_1[1];
        const mutation_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('setAlsoKnownAs',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 230 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(mutation_0) === 'number' && mutation_0 >= 0 && mutation_0 <= 2)) {
          __compactRuntime.typeError('setAlsoKnownAs',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'did.compact line 230 char 1',
                                     'Enum<SetMutation, Undefined, Insert, Remove>',
                                     mutation_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(value_0).concat(_descriptor_4.toValue(mutation_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_4.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._setAlsoKnownAs_0(context,
                                                partialProofData,
                                                value_0,
                                                mutation_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      setVerificationMethod: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`setVerificationMethod: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const verificationMethod_0 = args_1[1];
        const mutation_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('setVerificationMethod',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 246 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(verificationMethod_0) === 'object' && true && typeof(verificationMethod_0.typ) === 'number' && verificationMethod_0.typ >= 0 && verificationMethod_0.typ <= 1 && typeof(verificationMethod_0.publicKeyJwk) === 'object' && typeof(verificationMethod_0.publicKeyJwk.kty) === 'number' && verificationMethod_0.publicKeyJwk.kty >= 0 && verificationMethod_0.publicKeyJwk.kty <= 3 && typeof(verificationMethod_0.publicKeyJwk.crv) === 'number' && verificationMethod_0.publicKeyJwk.crv >= 0 && verificationMethod_0.publicKeyJwk.crv <= 4 && true && true)) {
          __compactRuntime.typeError('setVerificationMethod',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'did.compact line 246 char 1',
                                     'struct VerificationMethod<id: Opaque<"string">, typ: Enum<VerificationMethodType, Undefined, JsonWebKey>, publicKeyJwk: struct PublicKeyJwk<kty: Enum<KeyType, EC, RSA, oct, OKP>, crv: Enum<CurveType, Ed25519, X25519, Jubjub, P256, Secp256k1>, x: Opaque<"string">, y: Opaque<"string">>>',
                                     verificationMethod_0)
        }
        if (!(typeof(mutation_0) === 'number' && mutation_0 >= 0 && mutation_0 <= 2)) {
          __compactRuntime.typeError('setVerificationMethod',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'did.compact line 246 char 1',
                                     'Enum<MapMutation, Undefined, Insert, Update>',
                                     mutation_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_15.toValue(verificationMethod_0).concat(_descriptor_5.toValue(mutation_0)),
            alignment: _descriptor_15.alignment().concat(_descriptor_5.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._setVerificationMethod_0(context,
                                                       partialProofData,
                                                       verificationMethod_0,
                                                       mutation_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      removeVerificationMethod: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`removeVerificationMethod: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const id_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('removeVerificationMethod',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 266 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(id_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._removeVerificationMethod_0(context,
                                                          partialProofData,
                                                          id_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      setSchnorrJubjubVerificationMethod: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`setSchnorrJubjubVerificationMethod: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const verificationMethod_0 = args_1[1];
        const mutation_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('setSchnorrJubjubVerificationMethod',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 276 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(verificationMethod_0) === 'object' && true && true)) {
          __compactRuntime.typeError('setSchnorrJubjubVerificationMethod',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'did.compact line 276 char 1',
                                     'struct SchnorrJubjubVerificationMethod<id: Opaque<"string">, publicKey: Opaque<"JubjubPoint">>',
                                     verificationMethod_0)
        }
        if (!(typeof(mutation_0) === 'number' && mutation_0 >= 0 && mutation_0 <= 2)) {
          __compactRuntime.typeError('setSchnorrJubjubVerificationMethod',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'did.compact line 276 char 1',
                                     'Enum<MapMutation, Undefined, Insert, Update>',
                                     mutation_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_7.toValue(verificationMethod_0).concat(_descriptor_5.toValue(mutation_0)),
            alignment: _descriptor_7.alignment().concat(_descriptor_5.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._setSchnorrJubjubVerificationMethod_0(context,
                                                                    partialProofData,
                                                                    verificationMethod_0,
                                                                    mutation_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      removeSchnorrJubjubVerificationMethod: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`removeSchnorrJubjubVerificationMethod: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const id_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('removeSchnorrJubjubVerificationMethod',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 295 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(id_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._removeSchnorrJubjubVerificationMethod_0(context,
                                                                       partialProofData,
                                                                       id_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      verifySchnorrJubjubDigestSignature: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`verifySchnorrJubjubDigestSignature: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const methodId_0 = args_1[1];
        const digest_0 = args_1[2];
        const signature_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('verifySchnorrJubjubDigestSignature',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 307 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(Array.isArray(digest_0) && digest_0.length === 4 && digest_0.every((t) => typeof(t) === 'bigint' && t >= 0 && t <= __compactRuntime.MAX_FIELD))) {
          __compactRuntime.typeError('verifySchnorrJubjubDigestSignature',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'did.compact line 307 char 1',
                                     'Vector<4, Field>',
                                     digest_0)
        }
        if (!(typeof(signature_0) === 'object' && true && typeof(signature_0.response) === 'bigint' && signature_0.response >= 0 && signature_0.response <= __compactRuntime.MAX_FIELD)) {
          __compactRuntime.typeError('verifySchnorrJubjubDigestSignature',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'did.compact line 307 char 1',
                                     'struct SchnorrSignature<announcement: Opaque<"JubjubPoint">, response: Field>',
                                     signature_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(methodId_0).concat(_descriptor_9.toValue(digest_0).concat(_descriptor_10.toValue(signature_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_9.alignment().concat(_descriptor_10.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._verifySchnorrJubjubDigestSignature_0(context,
                                                                    partialProofData,
                                                                    methodId_0,
                                                                    digest_0,
                                                                    signature_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      setVerificationMethodRelation: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`setVerificationMethodRelation: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const relation_0 = args_1[1];
        const methodId_0 = args_1[2];
        const mutation_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('setVerificationMethodRelation',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 319 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(relation_0) === 'number' && relation_0 >= 0 && relation_0 <= 5)) {
          __compactRuntime.typeError('setVerificationMethodRelation',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'did.compact line 319 char 1',
                                     'Enum<VerificationMethodRelation, Undefined, Authentication, AssertionMethod, KeyAgreement, CapabilityInvocation, CapabilityDelegation>',
                                     relation_0)
        }
        if (!(typeof(mutation_0) === 'number' && mutation_0 >= 0 && mutation_0 <= 2)) {
          __compactRuntime.typeError('setVerificationMethodRelation',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'did.compact line 319 char 1',
                                     'Enum<SetMutation, Undefined, Insert, Remove>',
                                     mutation_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_3.toValue(relation_0).concat(_descriptor_0.toValue(methodId_0).concat(_descriptor_4.toValue(mutation_0))),
            alignment: _descriptor_3.alignment().concat(_descriptor_0.alignment().concat(_descriptor_4.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._setVerificationMethodRelation_0(context,
                                                               partialProofData,
                                                               relation_0,
                                                               methodId_0,
                                                               mutation_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      setService: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`setService: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const service_0 = args_1[1];
        const mutation_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('setService',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 343 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(service_0) === 'object' && true && true && true)) {
          __compactRuntime.typeError('setService',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'did.compact line 343 char 1',
                                     'struct Service<id: Opaque<"string">, typ: Opaque<"string">, serviceEndpoint: Opaque<"string">>',
                                     service_0)
        }
        if (!(typeof(mutation_0) === 'number' && mutation_0 >= 0 && mutation_0 <= 2)) {
          __compactRuntime.typeError('setService',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'did.compact line 343 char 1',
                                     'Enum<MapMutation, Undefined, Insert, Update>',
                                     mutation_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(service_0).concat(_descriptor_5.toValue(mutation_0)),
            alignment: _descriptor_1.alignment().concat(_descriptor_5.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._setService_0(context,
                                            partialProofData,
                                            service_0,
                                            mutation_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      removeService: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`removeService: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const id_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('removeService',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 359 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(id_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._removeService_0(context, partialProofData, id_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      deactivate: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`deactivate: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('deactivate',
                                     'argument 1 (as invoked from Typescript)',
                                     'did.compact line 368 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._deactivate_0(context, partialProofData);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      rotateControllerKey: this.circuits.rotateControllerKey,
      setAlsoKnownAs: this.circuits.setAlsoKnownAs,
      setVerificationMethod: this.circuits.setVerificationMethod,
      removeVerificationMethod: this.circuits.removeVerificationMethod,
      setSchnorrJubjubVerificationMethod: this.circuits.setSchnorrJubjubVerificationMethod,
      removeSchnorrJubjubVerificationMethod: this.circuits.removeSchnorrJubjubVerificationMethod,
      verifySchnorrJubjubDigestSignature: this.circuits.verifySchnorrJubjubDigestSignature,
      setVerificationMethodRelation: this.circuits.setVerificationMethodRelation,
      setService: this.circuits.setService,
      removeService: this.circuits.removeService,
      deactivate: this.circuits.deactivate
    };
    this.provableCircuits = this.impureCircuits;
    this.provableCircuits = {
      rotateControllerKey: this.circuits.rotateControllerKey,
      setAlsoKnownAs: this.circuits.setAlsoKnownAs,
      setVerificationMethod: this.circuits.setVerificationMethod,
      removeVerificationMethod: this.circuits.removeVerificationMethod,
      setSchnorrJubjubVerificationMethod: this.circuits.setSchnorrJubjubVerificationMethod,
      removeSchnorrJubjubVerificationMethod: this.circuits.removeSchnorrJubjubVerificationMethod,
      verifySchnorrJubjubDigestSignature: this.circuits.verifySchnorrJubjubDigestSignature,
      setVerificationMethodRelation: this.circuits.setVerificationMethodRelation,
      setService: this.circuits.setService,
      removeService: this.circuits.removeService,
      deactivate: this.circuits.deactivate
    };
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
    let stateValue_2 = __compactRuntime.StateValue.newArray();
    stateValue_2 = stateValue_2.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_2 = stateValue_2.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_2 = stateValue_2.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(stateValue_2);
    let stateValue_1 = __compactRuntime.StateValue.newArray();
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_1 = stateValue_1.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(stateValue_1);
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('rotateControllerKey', new __compactRuntime.ContractOperation());
    state_0.setOperation('setAlsoKnownAs', new __compactRuntime.ContractOperation());
    state_0.setOperation('setVerificationMethod', new __compactRuntime.ContractOperation());
    state_0.setOperation('removeVerificationMethod', new __compactRuntime.ContractOperation());
    state_0.setOperation('setSchnorrJubjubVerificationMethod', new __compactRuntime.ContractOperation());
    state_0.setOperation('removeSchnorrJubjubVerificationMethod', new __compactRuntime.ContractOperation());
    state_0.setOperation('verifySchnorrJubjubDigestSignature', new __compactRuntime.ContractOperation());
    state_0.setOperation('setVerificationMethodRelation', new __compactRuntime.ContractOperation());
    state_0.setOperation('setService', new __compactRuntime.ContractOperation());
    state_0.setOperation('removeService', new __compactRuntime.ContractOperation());
    state_0.setOperation('deactivate', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(0n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(0n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_27.toValue(0n),
                                                                                              alignment: _descriptor_27.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(0n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(1n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(0n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(2n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_26.toValue({ bytes: new Uint8Array(32) }),
                                                                                              alignment: _descriptor_26.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(0n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(1n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                              alignment: _descriptor_17.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(2n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                              alignment: _descriptor_17.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(3n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                              alignment: _descriptor_17.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(4n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(false),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(5n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(false),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(6n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                              alignment: _descriptor_17.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(7n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(8n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(9n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(10n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(11n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(12n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(13n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(14n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(0n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(0n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_27.toValue(tmp_0),
                                                                                              alignment: _descriptor_27.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_1 = _descriptor_26.fromValue(__compactRuntime.queryLedgerState(context,
                                                                             partialProofData,
                                                                             [
                                                                              { dup: { n: 2 } },
                                                                              { idx: { cached: true,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_28.toValue(0n),
                                                                                                         alignment: _descriptor_28.alignment() } }] } },
                                                                              { popeq: { cached: true,
                                                                                         result: undefined } }]).value);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(0n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(2n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_26.toValue(tmp_1),
                                                                                              alignment: _descriptor_26.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(5n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(true),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(4n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(false),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_2 = this._controllerKey_0(this._localSecretKey_0(context,
                                                               partialProofData));
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(0n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(1n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(tmp_2),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const timestamp_0 = this._currentTimestamp_0(context, partialProofData);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(2n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(timestamp_0),
                                                                                              alignment: _descriptor_17.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(3n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(timestamp_0),
                                                                                              alignment: _descriptor_17.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _transientHash_0(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_23, value_0);
    return result_0;
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_22, value_0);
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
      value: _descriptor_21.toValue(result_0),
      alignment: _descriptor_21.alignment()
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
  _localSecretKey_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.localSecretKey(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('localSecretKey',
                                 'return value',
                                 'did.compact line 44 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_16.toValue(result_0),
      alignment: _descriptor_16.alignment()
    });
    return result_0;
  }
  _currentTimestamp_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.currentTimestamp(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0n && result_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('currentTimestamp',
                                 'return value',
                                 'did.compact line 45 char 1',
                                 'Uint<0..18446744073709551616>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_17.toValue(result_0),
      alignment: _descriptor_17.alignment()
    });
    return result_0;
  }
  _verificationMethodExists_0(context, partialProofData, id_0) {
    return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                     partialProofData,
                                                                     [
                                                                      { dup: { n: 0 } },
                                                                      { idx: { cached: false,
                                                                               pushPath: false,
                                                                               path: [
                                                                                      { tag: 'value',
                                                                                        value: { value: _descriptor_28.toValue(1n),
                                                                                                 alignment: _descriptor_28.alignment() } },
                                                                                      { tag: 'value',
                                                                                        value: { value: _descriptor_28.toValue(7n),
                                                                                                 alignment: _descriptor_28.alignment() } }] } },
                                                                      { push: { storage: false,
                                                                                value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(id_0),
                                                                                                                             alignment: _descriptor_0.alignment() }).encode() } },
                                                                      'member',
                                                                      { popeq: { cached: true,
                                                                                 result: undefined } }]).value)
           ||
           _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                     partialProofData,
                                                                     [
                                                                      { dup: { n: 0 } },
                                                                      { idx: { cached: false,
                                                                               pushPath: false,
                                                                               path: [
                                                                                      { tag: 'value',
                                                                                        value: { value: _descriptor_28.toValue(1n),
                                                                                                 alignment: _descriptor_28.alignment() } },
                                                                                      { tag: 'value',
                                                                                        value: { value: _descriptor_28.toValue(8n),
                                                                                                 alignment: _descriptor_28.alignment() } }] } },
                                                                      { push: { storage: false,
                                                                                value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(id_0),
                                                                                                                             alignment: _descriptor_0.alignment() }).encode() } },
                                                                      'member',
                                                                      { popeq: { cached: true,
                                                                                 result: undefined } }]).value);
  }
  _controllerKey_0(sk_0) {
    return this._persistentHash_0([new Uint8Array([100, 105, 100, 58, 99, 111, 110, 116, 114, 111, 108, 108, 101, 114, 58, 112, 107, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   sk_0]);
  }
  _assertController_0(context, partialProofData) {
    __compactRuntime.assert(this._equal_0(this._controllerKey_0(this._localSecretKey_0(context,
                                                                                       partialProofData)),
                                          _descriptor_16.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                     partialProofData,
                                                                                                     [
                                                                                                      { dup: { n: 0 } },
                                                                                                      { idx: { cached: false,
                                                                                                               pushPath: false,
                                                                                                               path: [
                                                                                                                      { tag: 'value',
                                                                                                                        value: { value: _descriptor_28.toValue(0n),
                                                                                                                                 alignment: _descriptor_28.alignment() } },
                                                                                                                      { tag: 'value',
                                                                                                                        value: { value: _descriptor_28.toValue(1n),
                                                                                                                                 alignment: _descriptor_28.alignment() } }] } },
                                                                                                      { popeq: { cached: false,
                                                                                                                 result: undefined } }]).value)),
                            'DID controller is allowed to update the DID only');
    return [];
  }
  _assertControllerCanUpdate_0(context, partialProofData) {
    this._assertController_0(context, partialProofData);
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(1n),
                                                                                                                  alignment: _descriptor_28.alignment() } },
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(5n),
                                                                                                                  alignment: _descriptor_28.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value),
                            'Contract is not active');
    return [];
  }
  _recordUpdate_0(context, partialProofData) {
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } },
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(6n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_18.toValue(tmp_0),
                                                                alignment: _descriptor_18.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 2 } }]);
    const tmp_1 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } },
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_18.toValue(tmp_1),
                                                                alignment: _descriptor_18.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 2 } }]);
    const tmp_2 = this._currentTimestamp_0(context, partialProofData);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(3n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(tmp_2),
                                                                                              alignment: _descriptor_17.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _assertMapMutationDefined_0(mutation_0) {
    __compactRuntime.assert(mutation_0 === 1 || mutation_0 === 2,
                            'Map mutation must be Insert or Update');
    return [];
  }
  _assertSetMutationDefined_0(mutation_0) {
    __compactRuntime.assert(mutation_0 === 1 || mutation_0 === 2,
                            'Set mutation must be Insert or Remove');
    return [];
  }
  _assertSupportedVerificationMethod_0(verificationMethod_0) {
    __compactRuntime.assert(verificationMethod_0.typ === 1,
                            'Only JsonWebKey verification methods are supported');
    if (verificationMethod_0.publicKeyJwk.kty === 3) {
      __compactRuntime.assert(verificationMethod_0.publicKeyJwk.crv === 0
                              ||
                              verificationMethod_0.publicKeyJwk.crv === 1,
                              'OKP keys must use Ed25519 or X25519');
    } else {
      if (verificationMethod_0.publicKeyJwk.kty === 0) {
        __compactRuntime.assert(verificationMethod_0.publicKeyJwk.crv === 3
                                ||
                                verificationMethod_0.publicKeyJwk.crv === 4,
                                'EC keys must use P-256 or secp256k1; use SchnorrJubjub methods for Jubjub');
      } else {
        __compactRuntime.assert(false,
                                'Only OKP (Ed25519/X25519) and EC (P-256/secp256k1) keys are supported');
      }
    }
    return [];
  }
  _verificationMethodRelationMember_0(context,
                                      partialProofData,
                                      relation_0,
                                      methodId_0)
  {
    if (relation_0 === 1) {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_28.toValue(1n),
                                                                                                   alignment: _descriptor_28.alignment() } },
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_28.toValue(9n),
                                                                                                   alignment: _descriptor_28.alignment() } }] } },
                                                                        { push: { storage: false,
                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                        'member',
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    } else {
      if (relation_0 === 2) {
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(10n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      } else {
        if (relation_0 === 3) {
          return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                           partialProofData,
                                                                           [
                                                                            { dup: { n: 0 } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_28.toValue(1n),
                                                                                                       alignment: _descriptor_28.alignment() } },
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_28.toValue(11n),
                                                                                                       alignment: _descriptor_28.alignment() } }] } },
                                                                            { push: { storage: false,
                                                                                      value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                                                   alignment: _descriptor_0.alignment() }).encode() } },
                                                                            'member',
                                                                            { popeq: { cached: true,
                                                                                       result: undefined } }]).value);
        } else {
          if (relation_0 === 4) {
            return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                             partialProofData,
                                                                             [
                                                                              { dup: { n: 0 } },
                                                                              { idx: { cached: false,
                                                                                       pushPath: false,
                                                                                       path: [
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_28.toValue(1n),
                                                                                                         alignment: _descriptor_28.alignment() } },
                                                                                              { tag: 'value',
                                                                                                value: { value: _descriptor_28.toValue(12n),
                                                                                                         alignment: _descriptor_28.alignment() } }] } },
                                                                              { push: { storage: false,
                                                                                        value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                                                     alignment: _descriptor_0.alignment() }).encode() } },
                                                                              'member',
                                                                              { popeq: { cached: true,
                                                                                         result: undefined } }]).value);
          } else {
            if (relation_0 === 5) {
              return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_28.toValue(1n),
                                                                                                           alignment: _descriptor_28.alignment() } },
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_28.toValue(13n),
                                                                                                           alignment: _descriptor_28.alignment() } }] } },
                                                                                { push: { storage: false,
                                                                                          value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                                                       alignment: _descriptor_0.alignment() }).encode() } },
                                                                                'member',
                                                                                { popeq: { cached: true,
                                                                                           result: undefined } }]).value);
            } else {
              return false;
            }
          }
        }
      }
    }
  }
  _insertVerificationMethodRelation_0(context,
                                      partialProofData,
                                      relation_0,
                                      methodId_0)
  {
    if (relation_0 === 1) {
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(1n),
                                                                    alignment: _descriptor_28.alignment() } },
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(9n),
                                                                    alignment: _descriptor_28.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                alignment: _descriptor_0.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newNull().encode() } },
                                         { ins: { cached: false, n: 1 } },
                                         { ins: { cached: true, n: 2 } }]);
    } else {
      if (relation_0 === 2) {
        __compactRuntime.queryLedgerState(context,
                                          partialProofData,
                                          [
                                           { idx: { cached: false,
                                                    pushPath: true,
                                                    path: [
                                                           { tag: 'value',
                                                             value: { value: _descriptor_28.toValue(1n),
                                                                      alignment: _descriptor_28.alignment() } },
                                                           { tag: 'value',
                                                             value: { value: _descriptor_28.toValue(10n),
                                                                      alignment: _descriptor_28.alignment() } }] } },
                                           { push: { storage: false,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                  alignment: _descriptor_0.alignment() }).encode() } },
                                           { push: { storage: true,
                                                     value: __compactRuntime.StateValue.newNull().encode() } },
                                           { ins: { cached: false, n: 1 } },
                                           { ins: { cached: true, n: 2 } }]);
      } else {
        if (relation_0 === 3) {
          __compactRuntime.queryLedgerState(context,
                                            partialProofData,
                                            [
                                             { idx: { cached: false,
                                                      pushPath: true,
                                                      path: [
                                                             { tag: 'value',
                                                               value: { value: _descriptor_28.toValue(1n),
                                                                        alignment: _descriptor_28.alignment() } },
                                                             { tag: 'value',
                                                               value: { value: _descriptor_28.toValue(11n),
                                                                        alignment: _descriptor_28.alignment() } }] } },
                                             { push: { storage: false,
                                                       value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                    alignment: _descriptor_0.alignment() }).encode() } },
                                             { push: { storage: true,
                                                       value: __compactRuntime.StateValue.newNull().encode() } },
                                             { ins: { cached: false, n: 1 } },
                                             { ins: { cached: true, n: 2 } }]);
        } else {
          if (relation_0 === 4) {
            __compactRuntime.queryLedgerState(context,
                                              partialProofData,
                                              [
                                               { idx: { cached: false,
                                                        pushPath: true,
                                                        path: [
                                                               { tag: 'value',
                                                                 value: { value: _descriptor_28.toValue(1n),
                                                                          alignment: _descriptor_28.alignment() } },
                                                               { tag: 'value',
                                                                 value: { value: _descriptor_28.toValue(12n),
                                                                          alignment: _descriptor_28.alignment() } }] } },
                                               { push: { storage: false,
                                                         value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                      alignment: _descriptor_0.alignment() }).encode() } },
                                               { push: { storage: true,
                                                         value: __compactRuntime.StateValue.newNull().encode() } },
                                               { ins: { cached: false, n: 1 } },
                                               { ins: { cached: true, n: 2 } }]);
          } else {
            if (relation_0 === 5) {
              __compactRuntime.queryLedgerState(context,
                                                partialProofData,
                                                [
                                                 { idx: { cached: false,
                                                          pushPath: true,
                                                          path: [
                                                                 { tag: 'value',
                                                                   value: { value: _descriptor_28.toValue(1n),
                                                                            alignment: _descriptor_28.alignment() } },
                                                                 { tag: 'value',
                                                                   value: { value: _descriptor_28.toValue(13n),
                                                                            alignment: _descriptor_28.alignment() } }] } },
                                                 { push: { storage: false,
                                                           value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                        alignment: _descriptor_0.alignment() }).encode() } },
                                                 { push: { storage: true,
                                                           value: __compactRuntime.StateValue.newNull().encode() } },
                                                 { ins: { cached: false, n: 1 } },
                                                 { ins: { cached: true, n: 2 } }]);
            }
          }
        }
      }
    }
    return [];
  }
  _removeVerificationMethodRelationFromLedger_0(context,
                                                partialProofData,
                                                relation_0,
                                                methodId_0)
  {
    if (relation_0 === 1) {
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(1n),
                                                                    alignment: _descriptor_28.alignment() } },
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(9n),
                                                                    alignment: _descriptor_28.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                alignment: _descriptor_0.alignment() }).encode() } },
                                         { rem: { cached: false } },
                                         { ins: { cached: true, n: 2 } }]);
    } else {
      if (relation_0 === 2) {
        __compactRuntime.queryLedgerState(context,
                                          partialProofData,
                                          [
                                           { idx: { cached: false,
                                                    pushPath: true,
                                                    path: [
                                                           { tag: 'value',
                                                             value: { value: _descriptor_28.toValue(1n),
                                                                      alignment: _descriptor_28.alignment() } },
                                                           { tag: 'value',
                                                             value: { value: _descriptor_28.toValue(10n),
                                                                      alignment: _descriptor_28.alignment() } }] } },
                                           { push: { storage: false,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                  alignment: _descriptor_0.alignment() }).encode() } },
                                           { rem: { cached: false } },
                                           { ins: { cached: true, n: 2 } }]);
      } else {
        if (relation_0 === 3) {
          __compactRuntime.queryLedgerState(context,
                                            partialProofData,
                                            [
                                             { idx: { cached: false,
                                                      pushPath: true,
                                                      path: [
                                                             { tag: 'value',
                                                               value: { value: _descriptor_28.toValue(1n),
                                                                        alignment: _descriptor_28.alignment() } },
                                                             { tag: 'value',
                                                               value: { value: _descriptor_28.toValue(11n),
                                                                        alignment: _descriptor_28.alignment() } }] } },
                                             { push: { storage: false,
                                                       value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                    alignment: _descriptor_0.alignment() }).encode() } },
                                             { rem: { cached: false } },
                                             { ins: { cached: true, n: 2 } }]);
        } else {
          if (relation_0 === 4) {
            __compactRuntime.queryLedgerState(context,
                                              partialProofData,
                                              [
                                               { idx: { cached: false,
                                                        pushPath: true,
                                                        path: [
                                                               { tag: 'value',
                                                                 value: { value: _descriptor_28.toValue(1n),
                                                                          alignment: _descriptor_28.alignment() } },
                                                               { tag: 'value',
                                                                 value: { value: _descriptor_28.toValue(12n),
                                                                          alignment: _descriptor_28.alignment() } }] } },
                                               { push: { storage: false,
                                                         value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                      alignment: _descriptor_0.alignment() }).encode() } },
                                               { rem: { cached: false } },
                                               { ins: { cached: true, n: 2 } }]);
          } else {
            if (relation_0 === 5) {
              __compactRuntime.queryLedgerState(context,
                                                partialProofData,
                                                [
                                                 { idx: { cached: false,
                                                          pushPath: true,
                                                          path: [
                                                                 { tag: 'value',
                                                                   value: { value: _descriptor_28.toValue(1n),
                                                                            alignment: _descriptor_28.alignment() } },
                                                                 { tag: 'value',
                                                                   value: { value: _descriptor_28.toValue(13n),
                                                                            alignment: _descriptor_28.alignment() } }] } },
                                                 { push: { storage: false,
                                                           value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(methodId_0),
                                                                                                        alignment: _descriptor_0.alignment() }).encode() } },
                                                 { rem: { cached: false } },
                                                 { ins: { cached: true, n: 2 } }]);
            }
          }
        }
      }
    }
    return [];
  }
  _assertVerificationMethodIsNotReferenced_0(context, partialProofData, id_0) {
    __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(1n),
                                                                                                                   alignment: _descriptor_28.alignment() } },
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(9n),
                                                                                                                   alignment: _descriptor_28.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(id_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Verification method still referenced in authenticationRelation');
    __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(1n),
                                                                                                                   alignment: _descriptor_28.alignment() } },
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(10n),
                                                                                                                   alignment: _descriptor_28.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(id_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Verification method still referenced in assertionMethodRelation');
    __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(1n),
                                                                                                                   alignment: _descriptor_28.alignment() } },
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(11n),
                                                                                                                   alignment: _descriptor_28.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(id_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Verification method still referenced in keyAgreementRelation');
    __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(1n),
                                                                                                                   alignment: _descriptor_28.alignment() } },
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(12n),
                                                                                                                   alignment: _descriptor_28.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(id_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Verification method still referenced in capabilityInvocationRelation');
    __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(1n),
                                                                                                                   alignment: _descriptor_28.alignment() } },
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_28.toValue(13n),
                                                                                                                   alignment: _descriptor_28.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(id_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Verification method still referenced in capabilityDelegationRelation');
    return [];
  }
  _rotateControllerKey_0(context, partialProofData, newControllerPublicKey_0) {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedNewControllerPublicKey_0 = newControllerPublicKey_0;
    __compactRuntime.assert(!this._equal_1(disclosedNewControllerPublicKey_0,
                                           _descriptor_16.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                      partialProofData,
                                                                                                      [
                                                                                                       { dup: { n: 0 } },
                                                                                                       { idx: { cached: false,
                                                                                                                pushPath: false,
                                                                                                                path: [
                                                                                                                       { tag: 'value',
                                                                                                                         value: { value: _descriptor_28.toValue(0n),
                                                                                                                                  alignment: _descriptor_28.alignment() } },
                                                                                                                       { tag: 'value',
                                                                                                                         value: { value: _descriptor_28.toValue(1n),
                                                                                                                                  alignment: _descriptor_28.alignment() } }] } },
                                                                                                       { popeq: { cached: false,
                                                                                                                  result: undefined } }]).value)),
                            'New controller key matches current controller key');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(0n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(1n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(disclosedNewControllerPublicKey_0),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _setAlsoKnownAs_0(context, partialProofData, value_0, mutation_0) {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedMutation_0 = mutation_0;
    this._assertSetMutationDefined_0(disclosedMutation_0);
    const alias_0 = value_0;
    if (disclosedMutation_0 === 1) {
      __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                         partialProofData,
                                                                                         [
                                                                                          { dup: { n: 0 } },
                                                                                          { idx: { cached: false,
                                                                                                   pushPath: false,
                                                                                                   path: [
                                                                                                          { tag: 'value',
                                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                                          { tag: 'value',
                                                                                                            value: { value: _descriptor_28.toValue(0n),
                                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                                          { push: { storage: false,
                                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(alias_0),
                                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                                          'member',
                                                                                          { popeq: { cached: true,
                                                                                                     result: undefined } }]).value),
                              'alsoKnownAs value already exists');
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(1n),
                                                                    alignment: _descriptor_28.alignment() } },
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(0n),
                                                                    alignment: _descriptor_28.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(alias_0),
                                                                                                alignment: _descriptor_0.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newNull().encode() } },
                                         { ins: { cached: false, n: 1 } },
                                         { ins: { cached: true, n: 2 } }]);
    } else {
      if (disclosedMutation_0 === 2) {
        __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                          partialProofData,
                                                                                          [
                                                                                           { dup: { n: 0 } },
                                                                                           { idx: { cached: false,
                                                                                                    pushPath: false,
                                                                                                    path: [
                                                                                                           { tag: 'value',
                                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                                           { tag: 'value',
                                                                                                             value: { value: _descriptor_28.toValue(0n),
                                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                                           { push: { storage: false,
                                                                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(alias_0),
                                                                                                                                                  alignment: _descriptor_0.alignment() }).encode() } },
                                                                                           'member',
                                                                                           { popeq: { cached: true,
                                                                                                      result: undefined } }]).value),
                                'alsoKnownAs value does not exist');
        __compactRuntime.queryLedgerState(context,
                                          partialProofData,
                                          [
                                           { idx: { cached: false,
                                                    pushPath: true,
                                                    path: [
                                                           { tag: 'value',
                                                             value: { value: _descriptor_28.toValue(1n),
                                                                      alignment: _descriptor_28.alignment() } },
                                                           { tag: 'value',
                                                             value: { value: _descriptor_28.toValue(0n),
                                                                      alignment: _descriptor_28.alignment() } }] } },
                                           { push: { storage: false,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(alias_0),
                                                                                                  alignment: _descriptor_0.alignment() }).encode() } },
                                           { rem: { cached: false } },
                                           { ins: { cached: true, n: 2 } }]);
      }
    }
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _setVerificationMethod_0(context,
                           partialProofData,
                           verificationMethod_0,
                           mutation_0)
  {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedVerificationMethod_0 = verificationMethod_0;
    const disclosedMutation_0 = mutation_0;
    this._assertMapMutationDefined_0(disclosedMutation_0);
    this._assertSupportedVerificationMethod_0(disclosedVerificationMethod_0);
    if (disclosedMutation_0 === 2) {
      let tmp_0;
      __compactRuntime.assert((tmp_0 = disclosedVerificationMethod_0.id,
                               _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                         partialProofData,
                                                                                         [
                                                                                          { dup: { n: 0 } },
                                                                                          { idx: { cached: false,
                                                                                                   pushPath: false,
                                                                                                   path: [
                                                                                                          { tag: 'value',
                                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                                          { tag: 'value',
                                                                                                            value: { value: _descriptor_28.toValue(7n),
                                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                                          { push: { storage: false,
                                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_0),
                                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                                          'member',
                                                                                          { popeq: { cached: true,
                                                                                                     result: undefined } }]).value)),
                              'Verification method does not exist');
      const tmp_1 = disclosedVerificationMethod_0.id;
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(1n),
                                                                    alignment: _descriptor_28.alignment() } },
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(7n),
                                                                    alignment: _descriptor_28.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_1),
                                                                                                alignment: _descriptor_0.alignment() }).encode() } },
                                         { rem: { cached: false } },
                                         { ins: { cached: true, n: 2 } }]);
    } else {
      if (disclosedMutation_0 === 1) {
        __compactRuntime.assert(!this._verificationMethodExists_0(context,
                                                                  partialProofData,
                                                                  disclosedVerificationMethod_0.id),
                                'Verification method already exists');
      }
    }
    const tmp_2 = disclosedVerificationMethod_0.id;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } },
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(7n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_2),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(disclosedVerificationMethod_0),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 2 } }]);
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _removeVerificationMethod_0(context, partialProofData, id_0) {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedId_0 = id_0;
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(1n),
                                                                                                                  alignment: _descriptor_28.alignment() } },
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(7n),
                                                                                                                  alignment: _descriptor_28.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Verification method does not exist');
    this._assertVerificationMethodIsNotReferenced_0(context,
                                                    partialProofData,
                                                    disclosedId_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } },
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(7n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { rem: { cached: false } },
                                       { ins: { cached: true, n: 2 } }]);
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _setSchnorrJubjubVerificationMethod_0(context,
                                        partialProofData,
                                        verificationMethod_0,
                                        mutation_0)
  {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedVerificationMethod_0 = verificationMethod_0;
    const disclosedMutation_0 = mutation_0;
    this._assertMapMutationDefined_0(disclosedMutation_0);
    if (disclosedMutation_0 === 2) {
      let tmp_0;
      __compactRuntime.assert((tmp_0 = disclosedVerificationMethod_0.id,
                               _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                         partialProofData,
                                                                                         [
                                                                                          { dup: { n: 0 } },
                                                                                          { idx: { cached: false,
                                                                                                   pushPath: false,
                                                                                                   path: [
                                                                                                          { tag: 'value',
                                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                                          { tag: 'value',
                                                                                                            value: { value: _descriptor_28.toValue(8n),
                                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                                          { push: { storage: false,
                                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_0),
                                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                                          'member',
                                                                                          { popeq: { cached: true,
                                                                                                     result: undefined } }]).value)),
                              'Verification method does not exist');
      const tmp_1 = disclosedVerificationMethod_0.id;
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(1n),
                                                                    alignment: _descriptor_28.alignment() } },
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(8n),
                                                                    alignment: _descriptor_28.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_1),
                                                                                                alignment: _descriptor_0.alignment() }).encode() } },
                                         { rem: { cached: false } },
                                         { ins: { cached: true, n: 2 } }]);
    } else {
      if (disclosedMutation_0 === 1) {
        __compactRuntime.assert(!this._verificationMethodExists_0(context,
                                                                  partialProofData,
                                                                  disclosedVerificationMethod_0.id),
                                'Verification method already exists');
      }
    }
    const tmp_2 = disclosedVerificationMethod_0.id;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } },
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(8n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_2),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(disclosedVerificationMethod_0),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 2 } }]);
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _removeSchnorrJubjubVerificationMethod_0(context, partialProofData, id_0) {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedId_0 = id_0;
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(1n),
                                                                                                                  alignment: _descriptor_28.alignment() } },
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(8n),
                                                                                                                  alignment: _descriptor_28.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Verification method does not exist');
    this._assertVerificationMethodIsNotReferenced_0(context,
                                                    partialProofData,
                                                    disclosedId_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } },
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(8n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { rem: { cached: false } },
                                       { ins: { cached: true, n: 2 } }]);
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _verifySchnorrJubjubDigestSignature_0(context,
                                        partialProofData,
                                        methodId_0,
                                        digest_0,
                                        signature_0)
  {
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(1n),
                                                                                                                  alignment: _descriptor_28.alignment() } },
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(5n),
                                                                                                                  alignment: _descriptor_28.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value),
                            'Contract is not active');
    const disclosedMethodId_0 = methodId_0;
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(1n),
                                                                                                                  alignment: _descriptor_28.alignment() } },
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(8n),
                                                                                                                  alignment: _descriptor_28.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedMethodId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Verification method does not exist');
    const verificationMethod_0 = _descriptor_7.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                           partialProofData,
                                                                                           [
                                                                                            { dup: { n: 0 } },
                                                                                            { idx: { cached: false,
                                                                                                     pushPath: false,
                                                                                                     path: [
                                                                                                            { tag: 'value',
                                                                                                              value: { value: _descriptor_28.toValue(1n),
                                                                                                                       alignment: _descriptor_28.alignment() } },
                                                                                                            { tag: 'value',
                                                                                                              value: { value: _descriptor_28.toValue(8n),
                                                                                                                       alignment: _descriptor_28.alignment() } }] } },
                                                                                            { idx: { cached: false,
                                                                                                     pushPath: false,
                                                                                                     path: [
                                                                                                            { tag: 'value',
                                                                                                              value: { value: _descriptor_0.toValue(disclosedMethodId_0),
                                                                                                                       alignment: _descriptor_0.alignment() } }] } },
                                                                                            { popeq: { cached: false,
                                                                                                       result: undefined } }]).value);
    this._schnorrVerifyDigest_0(context,
                                partialProofData,
                                digest_0,
                                signature_0,
                                verificationMethod_0.publicKey);
    return [];
  }
  _setVerificationMethodRelation_0(context,
                                   partialProofData,
                                   relation_0,
                                   methodId_0,
                                   mutation_0)
  {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedRelation_0 = relation_0;
    const disclosedMethodId_0 = methodId_0;
    const disclosedMutation_0 = mutation_0;
    this._assertSetMutationDefined_0(disclosedMutation_0);
    __compactRuntime.assert(this._verificationMethodExists_0(context,
                                                             partialProofData,
                                                             disclosedMethodId_0),
                            'Verification method does not exist');
    __compactRuntime.assert(disclosedRelation_0 !== 0,
                            'Verification relation must be defined');
    const currentPresent_0 = this._verificationMethodRelationMember_0(context,
                                                                      partialProofData,
                                                                      disclosedRelation_0,
                                                                      disclosedMethodId_0);
    if (disclosedMutation_0 === 1) {
      __compactRuntime.assert(!currentPresent_0,
                              'Verification method relation already exists');
      this._insertVerificationMethodRelation_0(context,
                                               partialProofData,
                                               disclosedRelation_0,
                                               disclosedMethodId_0);
    } else {
      if (disclosedMutation_0 === 2) {
        __compactRuntime.assert(currentPresent_0,
                                'Verification method relation does not exist');
        this._removeVerificationMethodRelationFromLedger_0(context,
                                                           partialProofData,
                                                           disclosedRelation_0,
                                                           disclosedMethodId_0);
      }
    }
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _setService_0(context, partialProofData, service_0, mutation_0) {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedService_0 = service_0;
    const disclosedMutation_0 = mutation_0;
    this._assertMapMutationDefined_0(disclosedMutation_0);
    if (disclosedMutation_0 === 2) {
      let tmp_0;
      __compactRuntime.assert((tmp_0 = disclosedService_0.id,
                               _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                         partialProofData,
                                                                                         [
                                                                                          { dup: { n: 0 } },
                                                                                          { idx: { cached: false,
                                                                                                   pushPath: false,
                                                                                                   path: [
                                                                                                          { tag: 'value',
                                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                                          { tag: 'value',
                                                                                                            value: { value: _descriptor_28.toValue(14n),
                                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                                          { push: { storage: false,
                                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_0),
                                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                                          'member',
                                                                                          { popeq: { cached: true,
                                                                                                     result: undefined } }]).value)),
                              'Service with a given id does not exist');
      const tmp_1 = disclosedService_0.id;
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(1n),
                                                                    alignment: _descriptor_28.alignment() } },
                                                         { tag: 'value',
                                                           value: { value: _descriptor_28.toValue(14n),
                                                                    alignment: _descriptor_28.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_1),
                                                                                                alignment: _descriptor_0.alignment() }).encode() } },
                                         { rem: { cached: false } },
                                         { ins: { cached: true, n: 2 } }]);
    } else {
      if (disclosedMutation_0 === 1) {
        let tmp_2;
        __compactRuntime.assert(!(tmp_2 = disclosedService_0.id,
                                  _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                            partialProofData,
                                                                                            [
                                                                                             { dup: { n: 0 } },
                                                                                             { idx: { cached: false,
                                                                                                      pushPath: false,
                                                                                                      path: [
                                                                                                             { tag: 'value',
                                                                                                               value: { value: _descriptor_28.toValue(1n),
                                                                                                                        alignment: _descriptor_28.alignment() } },
                                                                                                             { tag: 'value',
                                                                                                               value: { value: _descriptor_28.toValue(14n),
                                                                                                                        alignment: _descriptor_28.alignment() } }] } },
                                                                                             { push: { storage: false,
                                                                                                       value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_2),
                                                                                                                                                    alignment: _descriptor_0.alignment() }).encode() } },
                                                                                             'member',
                                                                                             { popeq: { cached: true,
                                                                                                        result: undefined } }]).value)),
                                'Service with a given id already exists');
      }
    }
    const tmp_3 = disclosedService_0.id;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } },
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(14n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp_3),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(disclosedService_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 2 } }]);
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _removeService_0(context, partialProofData, id_0) {
    this._assertControllerCanUpdate_0(context, partialProofData);
    const disclosedId_0 = id_0;
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(1n),
                                                                                                                  alignment: _descriptor_28.alignment() } },
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(14n),
                                                                                                                  alignment: _descriptor_28.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Service with a given id does not exist');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } },
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(14n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { rem: { cached: false } },
                                       { ins: { cached: true, n: 2 } }]);
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _deactivate_0(context, partialProofData) {
    this._assertController_0(context, partialProofData);
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(1n),
                                                                                                                  alignment: _descriptor_28.alignment() } },
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_28.toValue(5n),
                                                                                                                  alignment: _descriptor_28.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value),
                            'DID is already inactive');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(5n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(false),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_28.toValue(1n),
                                                                  alignment: _descriptor_28.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_28.toValue(4n),
                                                                                              alignment: _descriptor_28.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(true),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    this._recordUpdate_0(context, partialProofData);
    return [];
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
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
    get contractVersion() {
      return _descriptor_27.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(0n),
                                                                                                    alignment: _descriptor_28.alignment() } },
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(0n),
                                                                                                    alignment: _descriptor_28.alignment() } }] } },
                                                                         { popeq: { cached: false,
                                                                                    result: undefined } }]).value);
    },
    get controllerPublicKey() {
      return _descriptor_16.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(0n),
                                                                                                    alignment: _descriptor_28.alignment() } },
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(1n),
                                                                                                    alignment: _descriptor_28.alignment() } }] } },
                                                                         { popeq: { cached: false,
                                                                                    result: undefined } }]).value);
    },
    get id() {
      return _descriptor_26.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(0n),
                                                                                                    alignment: _descriptor_28.alignment() } },
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(2n),
                                                                                                    alignment: _descriptor_28.alignment() } }] } },
                                                                         { popeq: { cached: false,
                                                                                    result: undefined } }]).value);
    },
    alsoKnownAs: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(0n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(0n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(0n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[0];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    get version() {
      return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(1n),
                                                                                                    alignment: _descriptor_28.alignment() } },
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(1n),
                                                                                                    alignment: _descriptor_28.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get created() {
      return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(1n),
                                                                                                    alignment: _descriptor_28.alignment() } },
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(2n),
                                                                                                    alignment: _descriptor_28.alignment() } }] } },
                                                                         { popeq: { cached: false,
                                                                                    result: undefined } }]).value);
    },
    get updated() {
      return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(1n),
                                                                                                    alignment: _descriptor_28.alignment() } },
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(3n),
                                                                                                    alignment: _descriptor_28.alignment() } }] } },
                                                                         { popeq: { cached: false,
                                                                                    result: undefined } }]).value);
    },
    get deactivated() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_28.toValue(1n),
                                                                                                   alignment: _descriptor_28.alignment() } },
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_28.toValue(4n),
                                                                                                   alignment: _descriptor_28.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get active() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_28.toValue(1n),
                                                                                                   alignment: _descriptor_28.alignment() } },
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_28.toValue(5n),
                                                                                                   alignment: _descriptor_28.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get operationCount() {
      return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(1n),
                                                                                                    alignment: _descriptor_28.alignment() } },
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_28.toValue(6n),
                                                                                                    alignment: _descriptor_28.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    verificationMethods: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(7n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(7n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(7n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(7n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_0.toValue(key_0),
                                                                                                      alignment: _descriptor_0.alignment() } }] } },
                                                                           { popeq: { cached: false,
                                                                                      result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[7];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_15.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    schnorrJubjubVerificationMethods: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(8n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(8n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(8n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        return _descriptor_7.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(8n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_0.toValue(key_0),
                                                                                                     alignment: _descriptor_0.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[8];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_7.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    authenticationRelation: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(9n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(9n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(9n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[9];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    assertionMethodRelation: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(10n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(10n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(10n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[10];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    keyAgreementRelation: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(11n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(11n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(11n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[11];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    capabilityInvocationRelation: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(12n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(12n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(12n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[12];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    capabilityDelegationRelation: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(13n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(13n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(13n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[13];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    services: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(14n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_17.toValue(0n),
                                                                                                                                 alignment: _descriptor_17.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_17.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(1n),
                                                                                                      alignment: _descriptor_28.alignment() } },
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_28.toValue(14n),
                                                                                                      alignment: _descriptor_28.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(14n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(1n),
                                                                                                     alignment: _descriptor_28.alignment() } },
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_28.toValue(14n),
                                                                                                     alignment: _descriptor_28.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_0.toValue(key_0),
                                                                                                     alignment: _descriptor_0.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1].asArray()[14];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_1.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  getSchnorrReduction: (...args) => undefined,
  localSecretKey: (...args) => undefined,
  currentTimestamp: (...args) => undefined
});
export const pureCircuits = {};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
