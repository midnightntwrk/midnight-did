import { CompactTypeBoolean, CompactTypeOpaqueString, CompactTypeUnsignedInteger, CompactTypeVector, } from "@midnight-ntwrk/compact-runtime";
import { blake2s } from "@noble/hashes/blake2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { z } from "zod/v4-mini";
import { decodeBase64Url, encodeBase64Url } from "./crypto-codecs.js";
import { createService, createVerificationMethod, CurveType, KeyType, PublicKeyJwkSchema, VerificationMethodType, } from "./did-document.js";
import { createMidnightDIDString, MidnightNetwork, OffchainStateHashHexSchema, parseMidnightDIDString, } from "./midnight.js";
const MAX_VERIFICATION_METHODS = 4;
const MAX_SERVICES = 4;
const MAGIC = new Uint8Array([0x4d, 0x4f, 0x44, 0x31]); // MOD1
const HEADER_LENGTH = MAGIC.length + 4;
const CHUNK_LENGTH_BYTES = 4;
const BASE64URL_TEXT = /^[A-Za-z0-9_-]+$/u;
const uint8 = new CompactTypeUnsignedInteger(255n, 1);
const uint16 = new CompactTypeUnsignedInteger(65535n, 2);
export const OFFCHAIN_STATE_ENCODING = "midnight-offchain-did-state-v1.base64url";
export const OffchainStateHashSchema = OffchainStateHashHexSchema;
export const OffchainVerificationRelationshipsSchema = z.object({
    authentication: z.boolean(),
    assertionMethod: z.boolean(),
    keyAgreement: z.boolean(),
    capabilityInvocation: z.boolean(),
    capabilityDelegation: z.boolean(),
});
export const OffchainVerificationMethodSchema = z.object({
    id: z.string().check(z.minLength(1), z.refine((value) => value.startsWith("#"), "Verification method id must be a fragment reference")),
    publicKeyJwk: PublicKeyJwkSchema,
    relationships: OffchainVerificationRelationshipsSchema,
});
export const OffchainServiceSchema = z.object({
    id: z.string().check(z.minLength(1), z.refine((value) => value.startsWith("#"), "Service id must be a fragment reference")),
    type: z.string().check(z.minLength(1)),
    serviceEndpoint: z.string().check(z.minLength(1)),
});
export const OffchainMidnightDIDStateSchema = z.object({
    version: z.number().check(z.int(), z.gte(1), z.lte(65535)),
    alsoKnownAs: z
        .array(z.string())
        .check(z.refine((value) => value.length <= 4, "alsoKnownAs must contain at most 4 entries")),
    verificationMethod: z.array(OffchainVerificationMethodSchema).check(z.refine((value) => value.length >= 1, "At least one verification method is required"), z.refine((value) => value.length <= MAX_VERIFICATION_METHODS, `verificationMethod must contain at most ${MAX_VERIFICATION_METHODS} entries`)),
    service: z
        .array(OffchainServiceSchema)
        .check(z.refine((value) => value.length <= MAX_SERVICES, `service must contain at most ${MAX_SERVICES} entries`)),
});
var OffchainKeyKind;
(function (OffchainKeyKind) {
    // Offchain state tags are independent from ledger CurveType integer tags and
    // append new profiles to keep the portable offchain wire format stable.
    OffchainKeyKind[OffchainKeyKind["Jubjub"] = 1] = "Jubjub";
    OffchainKeyKind[OffchainKeyKind["Ed25519"] = 2] = "Ed25519";
    OffchainKeyKind[OffchainKeyKind["P256"] = 3] = "P256";
    OffchainKeyKind[OffchainKeyKind["X25519"] = 4] = "X25519";
    OffchainKeyKind[OffchainKeyKind["Secp256k1"] = 5] = "Secp256k1";
})(OffchainKeyKind || (OffchainKeyKind = {}));
const opaqueString = CompactTypeOpaqueString;
const toBase64Url = (bytes) => encodeBase64Url(bytes);
const fromBase64Url = (value) => {
    if (!BASE64URL_TEXT.test(value) || value.length % 4 === 1) {
        throw new Error("Offchain Midnight DID state is not valid unpadded base64url");
    }
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = decodeBase64Url(`${normalized}${padding}`);
    if (toBase64Url(decoded) !== value) {
        throw new Error("Offchain Midnight DID state is not canonical unpadded base64url");
    }
    return decoded;
};
const assertUint32 = (value, label) => {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new Error(`${label} must fit into uint32`);
    }
};
const writeUint32 = (target, offset, value) => {
    assertUint32(value, "uint32 value");
    target[offset] = (value >>> 24) & 0xff;
    target[offset + 1] = (value >>> 16) & 0xff;
    target[offset + 2] = (value >>> 8) & 0xff;
    target[offset + 3] = value & 0xff;
};
const readUint32 = (source, offset) => {
    if (offset + CHUNK_LENGTH_BYTES > source.length) {
        throw new Error("Offchain Midnight DID state ended before uint32 field");
    }
    return new DataView(source.buffer, source.byteOffset, source.byteLength).getUint32(offset, false);
};
const compactValueToBytes = (value) => {
    assertUint32(value.length, "Compact value chunk count");
    const bodyLength = value.reduce((total, chunk) => {
        assertUint32(chunk.length, "Compact value chunk length");
        return total + CHUNK_LENGTH_BYTES + chunk.length;
    }, 0);
    const result = new Uint8Array(HEADER_LENGTH + bodyLength);
    result.set(MAGIC, 0);
    writeUint32(result, MAGIC.length, value.length);
    let offset = HEADER_LENGTH;
    for (const chunk of value) {
        writeUint32(result, offset, chunk.length);
        offset += CHUNK_LENGTH_BYTES;
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
};
const compactValueFromBytes = (bytes) => {
    if (bytes.length < HEADER_LENGTH) {
        throw new Error("Offchain Midnight DID state is shorter than the header");
    }
    for (let i = 0; i < MAGIC.length; i += 1) {
        if (bytes[i] !== MAGIC[i]) {
            throw new Error("Offchain Midnight DID state has an unexpected magic header");
        }
    }
    const chunkCount = readUint32(bytes, MAGIC.length);
    const maxChunkCount = Math.floor((bytes.length - HEADER_LENGTH) / CHUNK_LENGTH_BYTES);
    if (chunkCount > maxChunkCount) {
        throw new Error("Offchain Midnight DID state declares too many chunks");
    }
    const chunks = [];
    let offset = HEADER_LENGTH;
    for (let i = 0; i < chunkCount; i += 1) {
        const length = readUint32(bytes, offset);
        offset += CHUNK_LENGTH_BYTES;
        if (offset + length > bytes.length) {
            throw new Error("Offchain Midnight DID chunk exceeds payload length");
        }
        chunks.push(bytes.slice(offset, offset + length));
        offset += length;
    }
    if (offset !== bytes.length) {
        throw new Error("Offchain Midnight DID state contains trailing bytes");
    }
    return chunks;
};
const relationshipsToMask = (relationships) => (relationships.authentication ? 1 : 0) |
    (relationships.assertionMethod ? 2 : 0) |
    (relationships.keyAgreement ? 4 : 0) |
    (relationships.capabilityInvocation ? 8 : 0) |
    (relationships.capabilityDelegation ? 16 : 0);
const maskToRelationships = (mask) => ({
    authentication: (mask & 1) !== 0,
    assertionMethod: (mask & 2) !== 0,
    keyAgreement: (mask & 4) !== 0,
    capabilityInvocation: (mask & 8) !== 0,
    capabilityDelegation: (mask & 16) !== 0,
});
const keyKindFromJwk = (jwk) => {
    if (jwk.kty === KeyType.EC && jwk.crv === CurveType.Jubjub) {
        return OffchainKeyKind.Jubjub;
    }
    if (jwk.kty === KeyType.OKP && jwk.crv === CurveType.Ed25519) {
        return OffchainKeyKind.Ed25519;
    }
    if (jwk.kty === KeyType.OKP && jwk.crv === CurveType.X25519) {
        return OffchainKeyKind.X25519;
    }
    if (jwk.kty === KeyType.EC && jwk.crv === CurveType.P256) {
        return OffchainKeyKind.P256;
    }
    if (jwk.kty === KeyType.EC && jwk.crv === CurveType.Secp256k1) {
        return OffchainKeyKind.Secp256k1;
    }
    throw new Error(`Unsupported offchain Midnight DID key type ${jwk.kty}/${jwk.crv}`);
};
const jwkFromKeyKind = (keyKind, x, y) => {
    if (keyKind === OffchainKeyKind.Jubjub) {
        return PublicKeyJwkSchema.parse({
            kty: KeyType.EC,
            crv: CurveType.Jubjub,
            x,
            y,
        });
    }
    if (keyKind === OffchainKeyKind.P256) {
        return PublicKeyJwkSchema.parse({
            kty: KeyType.EC,
            crv: CurveType.P256,
            x,
            y,
        });
    }
    if (keyKind === OffchainKeyKind.Secp256k1) {
        return PublicKeyJwkSchema.parse({
            kty: KeyType.EC,
            crv: CurveType.Secp256k1,
            x,
            y,
        });
    }
    if (keyKind === OffchainKeyKind.Ed25519) {
        return PublicKeyJwkSchema.parse({
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            x,
        });
    }
    if (keyKind === OffchainKeyKind.X25519) {
        return PublicKeyJwkSchema.parse({
            kty: KeyType.OKP,
            crv: CurveType.X25519,
            x,
        });
    }
    throw new Error(`Unsupported offchain Midnight DID key kind ${keyKind}`);
};
const verificationMethodDescriptor = {
    alignment: () => CompactTypeBoolean.alignment()
        .concat(opaqueString.alignment())
        .concat(uint8.alignment())
        .concat(opaqueString.alignment())
        .concat(opaqueString.alignment())
        .concat(uint8.alignment()),
    fromValue: (value) => ({
        present: CompactTypeBoolean.fromValue(value),
        id: opaqueString.fromValue(value),
        keyKind: Number(uint8.fromValue(value)),
        x: opaqueString.fromValue(value),
        y: opaqueString.fromValue(value),
        relationshipsMask: Number(uint8.fromValue(value)),
    }),
    toValue: (value) => CompactTypeBoolean.toValue(value.present)
        .concat(opaqueString.toValue(value.id))
        .concat(uint8.toValue(BigInt(value.keyKind)))
        .concat(opaqueString.toValue(value.x))
        .concat(opaqueString.toValue(value.y))
        .concat(uint8.toValue(BigInt(value.relationshipsMask))),
};
const serviceDescriptor = {
    alignment: () => CompactTypeBoolean.alignment()
        .concat(opaqueString.alignment())
        .concat(opaqueString.alignment())
        .concat(opaqueString.alignment()),
    fromValue: (value) => ({
        present: CompactTypeBoolean.fromValue(value),
        id: opaqueString.fromValue(value),
        type: opaqueString.fromValue(value),
        serviceEndpoint: opaqueString.fromValue(value),
    }),
    toValue: (value) => CompactTypeBoolean.toValue(value.present)
        .concat(opaqueString.toValue(value.id))
        .concat(opaqueString.toValue(value.type))
        .concat(opaqueString.toValue(value.serviceEndpoint)),
};
const verificationMethodsVector = new CompactTypeVector(MAX_VERIFICATION_METHODS, verificationMethodDescriptor);
const servicesVector = new CompactTypeVector(MAX_SERVICES, serviceDescriptor);
const alsoKnownAsVector = new CompactTypeVector(4, opaqueString);
const stateDescriptor = {
    alignment: () => uint16
        .alignment()
        .concat(alsoKnownAsVector.alignment())
        .concat(verificationMethodsVector.alignment())
        .concat(servicesVector.alignment()),
    fromValue: (value) => ({
        version: Number(uint16.fromValue(value)),
        alsoKnownAs: alsoKnownAsVector.fromValue(value),
        verificationMethod: verificationMethodsVector.fromValue(value),
        service: servicesVector.fromValue(value),
    }),
    toValue: (value) => uint16
        .toValue(BigInt(value.version))
        .concat(alsoKnownAsVector.toValue(Array.from(value.alsoKnownAs)))
        .concat(verificationMethodsVector.toValue(Array.from(value.verificationMethod)))
        .concat(servicesVector.toValue(Array.from(value.service))),
};
const emptyVerificationMethodSlot = () => ({
    present: false,
    id: "",
    keyKind: 0,
    x: "",
    y: "",
    relationshipsMask: 0,
});
const emptyServiceSlot = () => ({
    present: false,
    id: "",
    type: "",
    serviceEndpoint: "",
});
const padFixedArray = (source, length, filler) => {
    const result = source.slice(0, length);
    while (result.length < length) {
        result.push(filler());
    }
    return result;
};
const encodeStateShape = (state) => {
    const parsed = OffchainMidnightDIDStateSchema.parse(state);
    return {
        version: parsed.version,
        alsoKnownAs: padFixedArray(parsed.alsoKnownAs, 4, () => ""),
        verificationMethod: padFixedArray(parsed.verificationMethod.map((method) => ({
            present: true,
            id: method.id,
            keyKind: keyKindFromJwk(method.publicKeyJwk),
            x: method.publicKeyJwk.x,
            y: method.publicKeyJwk.y ?? "",
            relationshipsMask: relationshipsToMask(method.relationships),
        })), MAX_VERIFICATION_METHODS, emptyVerificationMethodSlot),
        service: padFixedArray(parsed.service.map((service) => ({
            present: true,
            id: service.id,
            type: service.type,
            serviceEndpoint: service.serviceEndpoint,
        })), MAX_SERVICES, emptyServiceSlot),
    };
};
const decodeStateShape = (encoded) => OffchainMidnightDIDStateSchema.parse({
    version: encoded.version,
    alsoKnownAs: encoded.alsoKnownAs.filter((value) => value.length > 0),
    verificationMethod: encoded.verificationMethod
        .filter((method) => method.present)
        .map((method) => ({
        id: method.id,
        publicKeyJwk: jwkFromKeyKind(method.keyKind, method.x, method.y),
        relationships: maskToRelationships(method.relationshipsMask),
    })),
    service: encoded.service
        .filter((service) => service.present)
        .map((service) => ({
        id: service.id,
        type: service.type,
        serviceEndpoint: service.serviceEndpoint,
    })),
});
const bytesToStateHash = (bytes) => OffchainStateHashSchema.parse(bytesToHex(blake2s(bytes, { dkLen: 32 })));
export const parseOffchainStateHash = (input) => OffchainStateHashSchema.parse(input);
const encodeAndHashState = (state) => {
    const encodedState = encodeOffchainMidnightDIDState(state);
    const stateBytes = fromBase64Url(encodedState.payload);
    return {
        encodedState,
        stateHash: bytesToStateHash(stateBytes),
    };
};
export const encodeOffchainMidnightDIDState = (state) => ({
    encoding: OFFCHAIN_STATE_ENCODING,
    payload: toBase64Url(compactValueToBytes(stateDescriptor.toValue(encodeStateShape(state)))),
});
export const decodeOffchainMidnightDIDState = (encoded) => {
    if (encoded.encoding !== OFFCHAIN_STATE_ENCODING) {
        throw new Error(`Unsupported offchain Midnight DID state encoding "${encoded.encoding}"`);
    }
    const value = compactValueFromBytes(fromBase64Url(encoded.payload));
    const decoded = stateDescriptor.fromValue(value);
    if (value.length !== 0) {
        throw new Error("Offchain Midnight DID state contains trailing chunks for descriptor");
    }
    return decodeStateShape(decoded);
};
export const createOffchainMidnightDIDString = (stateHash) => createMidnightDIDString(stateHash, MidnightNetwork.Offchain);
export const createOffchainMidnightDIDStringFromState = (state) => {
    const { stateHash } = encodeAndHashState(state);
    return createOffchainMidnightDIDString(stateHash);
};
export const createLongFormOffchainMidnightDIDString = (state) => {
    const { encodedState, stateHash } = encodeAndHashState(state);
    const did = createOffchainMidnightDIDString(stateHash);
    return parseMidnightDIDString(`${did}:${encodedState.payload}`);
};
export const parseLongFormOffchainMidnightDIDString = (input) => {
    const did = parseMidnightDIDString(input);
    const parsedDid = input.split(":");
    if (parsedDid[2] !== "offchain") {
        throw new Error("Long-form offchain Midnight DID must use offchain network");
    }
    if (parsedDid.length !== 5) {
        throw new Error("Long-form offchain Midnight DID must include encoded state");
    }
    const stateHash = parseOffchainStateHash(parsedDid[3]);
    const statePayload = parsedDid[4];
    const encodedState = {
        encoding: OFFCHAIN_STATE_ENCODING,
        payload: statePayload,
    };
    const computedHash = bytesToStateHash(fromBase64Url(statePayload));
    if (computedHash !== stateHash) {
        throw new Error("Long-form offchain Midnight DID state does not match the DID state hash");
    }
    return { did, stateHash, encodedState };
};
export const offchainVerificationMethodToDidDocumentMethod = (did, method) => createVerificationMethod({
    id: method.id,
    type: VerificationMethodType.JsonWebKey,
    controller: did,
    publicKeyJwk: method.publicKeyJwk,
});
export const offchainServiceToDidDocumentService = (service) => createService({
    id: service.id,
    type: service.type,
    serviceEndpoint: service.serviceEndpoint,
});
export const offchainStateToDidDocument = (did, state) => {
    const parsed = OffchainMidnightDIDStateSchema.parse(state);
    const authentication = parsed.verificationMethod
        .filter((method) => method.relationships.authentication)
        .map((method) => method.id);
    const assertionMethod = parsed.verificationMethod
        .filter((method) => method.relationships.assertionMethod)
        .map((method) => method.id);
    const keyAgreement = parsed.verificationMethod
        .filter((method) => method.relationships.keyAgreement)
        .map((method) => method.id);
    const capabilityInvocation = parsed.verificationMethod
        .filter((method) => method.relationships.capabilityInvocation)
        .map((method) => method.id);
    const capabilityDelegation = parsed.verificationMethod
        .filter((method) => method.relationships.capabilityDelegation)
        .map((method) => method.id);
    return {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3c.github.io/vc-jws-2020/contexts/v1",
        ],
        id: did,
        alsoKnownAs: parsed.alsoKnownAs.length > 0 ? parsed.alsoKnownAs : null,
        controller: did,
        verificationMethod: parsed.verificationMethod.map((method) => offchainVerificationMethodToDidDocumentMethod(did, method)),
        authentication: authentication.length > 0 ? authentication : null,
        assertionMethod: assertionMethod.length > 0 ? assertionMethod : null,
        keyAgreement: keyAgreement.length > 0 ? keyAgreement : null,
        capabilityInvocation: capabilityInvocation.length > 0 ? capabilityInvocation : null,
        capabilityDelegation: capabilityDelegation.length > 0 ? capabilityDelegation : null,
        service: parsed.service.length > 0
            ? parsed.service.map(offchainServiceToDidDocumentService)
            : null,
    };
};
export const createOffchainMidnightDidDocumentMetadata = (state) => ({
    deactivated: false,
    versionId: String(OffchainMidnightDIDStateSchema.parse(state).version),
});
//# sourceMappingURL=offchain-midnight.js.map