import {
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  type JsonWebKey,
  type KeyObject,
  sign,
  verify,
} from "node:crypto";

import {
  createMidnightDIDString,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did/midnight";
import {
  createService,
  createVerificationMethod,
  CurveType,
  decodeBase64Url,
  DIDStringSchema,
  encodeBase64Url,
  KeyType,
  MidnightDIDSchema,
  MidnightDIDString,
  parseDIDKeyID,
  parseMidnightDID,
  parseMidnightDIDString,
  type PublicKeyJwk,
  ServiceIdSchema,
  type VerificationMethod,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import {
  deriveJubjubPublicKeyFromSeed,
  payloadToJubjubDigest,
  signJubjubPayloadFromSeed,
  verifyJubjubPayload,
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";
import { bls12_381 } from "@noble/curves/bls12-381";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { currentDir } from "../config.js";
import * as api from "../index.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "../index.js";
import { createLogger } from "../logger-utils.js";
import { TestEnvironment } from "./commons.js";

const logDir = path.resolve(
  currentDir,
  "..",
  "logs",
  "tests",
  `${new Date().toISOString()}.log`,
);
const logger = await createLogger(logDir);

const toFragmentId = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) return trimmed;
  const hashIndex = trimmed.indexOf("#");
  if (hashIndex >= 0) return `#${trimmed.slice(hashIndex + 1)}`;
  return `#${trimmed}`;
};

const hasSameMethodFragment = (left: string, right: string): boolean =>
  toFragmentId(left) === toFragmentId(right);

const payload = new TextEncoder().encode("midnight-did-real-key-flow");

const requireJwkPart = (
  jwk: JsonWebKey,
  key: "crv" | "d" | "kty" | "x" | "y",
): string => {
  const value = jwk[key];
  if (typeof value !== "string") {
    throw new Error(`Generated JWK is missing ${key}`);
  }
  return value;
};

const generatePublicJwkPair = (
  kind: "ed25519" | "x25519",
): { publicJwk: PublicKeyJwk; privateKey: KeyObject } => {
  const { publicKey, privateKey } =
    kind === "ed25519"
      ? generateKeyPairSync("ed25519")
      : generateKeyPairSync("x25519");
  const jwk = publicKey.export({ format: "jwk" });
  return {
    privateKey,
    publicJwk: {
      kty: requireJwkPart(jwk, "kty") as KeyType.OKP,
      crv: requireJwkPart(jwk, "crv") as CurveType.Ed25519 | CurveType.X25519,
      x: requireJwkPart(jwk, "x"),
    },
  };
};

const generateEcPublicJwkPair = (
  namedCurve: "P-256" | "secp256k1",
): { publicJwk: PublicKeyJwk; privateKey: KeyObject } => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve });
  const jwk = publicKey.export({ format: "jwk" });
  return {
    privateKey,
    publicJwk: {
      kty: requireJwkPart(jwk, "kty") as KeyType.EC,
      crv: requireJwkPart(jwk, "crv") as CurveType.P256 | CurveType.Secp256k1,
      x: requireJwkPart(jwk, "x"),
      y: requireJwkPart(jwk, "y"),
    },
  };
};

const bigintTo32Le = (value: bigint): Uint8Array => {
  const bytes = new Uint8Array(32);
  let remaining = value;
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
};

const bytesToBigintLe = (bytes: Uint8Array): bigint => {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    value = (value << 8n) + BigInt(bytes[i]);
  }
  return value;
};

const createJubjubPublicJwk = (seed: Uint8Array): PublicKeyJwk => {
  const publicKey = deriveJubjubPublicKeyFromSeed(seed);
  return {
    kty: KeyType.EC,
    crv: CurveType.Jubjub,
    x: encodeBase64Url(bigintTo32Le(publicKey.x)),
    y: encodeBase64Url(bigintTo32Le(publicKey.y)),
  };
};

const createBlsPublicJwk = (
  crv: CurveType.BLS12381G1 | CurveType.BLS12381G2,
): PublicKeyJwk => {
  const secretKey = new Uint8Array(32);
  secretKey[31] = 1;
  const publicKey =
    crv === CurveType.BLS12381G1
      ? bls12_381.getPublicKey(secretKey)
      : bls12_381.getPublicKeyForShortSignatures(secretKey);
  return {
    kty: KeyType.OKP,
    crv,
    x: encodeBase64Url(publicKey),
  };
};

const publicKeyFromRetrievedJwk = (publicKeyJwk: PublicKeyJwk): KeyObject =>
  createPublicKey({
    key: publicKeyJwk as JsonWebKey,
    format: "jwk",
  });

const expectSignatureVerifiesWithRetrievedJwk = (
  algorithm: "ed25519" | "sha256",
  privateKey: KeyObject,
  publicKeyJwk: PublicKeyJwk,
): void => {
  const signature =
    algorithm === "ed25519"
      ? sign(null, payload, privateKey)
      : sign(algorithm, payload, privateKey);
  const publicKey = publicKeyFromRetrievedJwk(publicKeyJwk);

  expect(
    algorithm === "ed25519"
      ? verify(null, payload, publicKey, signature)
      : verify(algorithm, payload, publicKey, signature),
  ).toBe(true);
};

const findVerificationMethod = (
  methods: readonly VerificationMethod[] | null | undefined,
  methodId: string,
): VerificationMethod => {
  const method = methods?.find((vm) => hasSameMethodFragment(vm.id, methodId));
  expect(method).toBeDefined();
  return method!;
};

const createDidWithDustRetry = async (
  providers: MidnightDIDProviders,
  privateState: api.MidnightDIDPrivateState,
  retries = 2,
  delayMs = 8_000,
): Promise<DeployedMidnightDIDContract> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await api.createDID(providers, privateState);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt === retries ||
        !/Not enough Dust generated to pay the fee|could not balance dust/i.test(
          message,
        )
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

let containerRuntimeAvailable = true;
let containerRuntimeError: string | undefined;
try {
  const { getContainerRuntimeClient } =
    await import("testcontainers/build/container-runtime/clients/client.js");
  await getContainerRuntimeClient();
} catch (error) {
  containerRuntimeAvailable = false;
  containerRuntimeError =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : undefined;
  logger.warn(
    `Skipping API integration tests: ${
      containerRuntimeError ?? "container runtime unavailable"
    }`,
  );
}

const describeApi = containerRuntimeAvailable ? describe : describe.skip;

describeApi("Midnight DID method API", () => {
  let testEnvironment: TestEnvironment;
  let walletCtx: api.MidnightDIDWalletContext;
  let providers: MidnightDIDProviders;
  let contract: DeployedMidnightDIDContract;
  let contractAddress: ReturnType<typeof parseContractAddress>;
  let didString: MidnightDIDString;
  let didAsDid: ReturnType<typeof DIDStringSchema.parse>;
  const serviceId = ServiceIdSchema.parse("#service-1");
  const secondAlias = DIDStringSchema.parse("did:example:aka-2");

  const resolveDocument = async () =>
    (await api.resolve(providers, contract))?.didDocument;

  beforeAll(
    async () => {
      if (!containerRuntimeAvailable) return;
      api.setLogger(logger);
      testEnvironment = new TestEnvironment(logger);
      const testConfiguration = await testEnvironment.start();
      walletCtx = await testEnvironment.getWallet();
      providers = await api.configureProviders(
        walletCtx,
        testConfiguration.dappConfig,
      );
    },
    1000 * 60 * 45 * 10,
  );

  afterAll(async () => {
    if (!containerRuntimeAvailable) {
      logger.warn(
        `Skipped API integration tests because container runtime is unavailable${
          containerRuntimeError !== undefined
            ? `: ${containerRuntimeError}`
            : ""
        }`,
      );
      return;
    }
    await testEnvironment.shutdown();
  });

  it("should publish the associated smart-contract to the Midnight blockchain with an empty state", async () => {
    const privateState = await api.initPrivateState(providers);
    contract = await createDidWithDustRetry(providers, privateState);
    expect(contract).not.toBeNull();

    contractAddress = parseContractAddress(
      contract.deployTxData.public.contractAddress,
    );
    didString = createMidnightDIDString(
      contractAddress,
      api.getMidnightNetwork(),
    );
    didAsDid = DIDStringSchema.parse(didString);

    const didLedger = await api.getMidnightDIDLedgerState(
      providers,
      contractAddress,
    );
    expect(didLedger?.active).toBe(true);
    expect(didLedger?.verificationMethods.isEmpty()).toBe(true);
    expect(didLedger?.schnorrJubjubVerificationMethods.isEmpty()).toBe(true);
    expect(didLedger?.assertionMethodRelation.isEmpty()).toBe(true);
    expect(didLedger?.authenticationRelation.isEmpty()).toBe(true);
    expect(didLedger?.capabilityDelegationRelation.isEmpty()).toBe(true);
    expect(didLedger?.capabilityInvocationRelation.isEmpty()).toBe(true);
    expect(didLedger?.services.isEmpty()).toBe(true);
  });

  it("should rotate the controller key and keep subsequent updates authorized", async () => {
    const beforeRotation = await api.getMidnightDIDLedgerState(
      providers,
      contractAddress,
    );

    await expect(
      api.rotateControllerKey(contract, providers),
    ).resolves.toBeDefined();

    const afterRotation = await api.getMidnightDIDLedgerState(
      providers,
      contractAddress,
    );
    expect(afterRotation!.controllerPublicKey).not.toEqual(
      beforeRotation!.controllerPublicKey,
    );

    const alias = "did:example:rotated-controller";
    await api.addAlsoKnownAs(contract, providers, alias);
    await api.removeAlsoKnownAs(contract, providers, alias);
  });

  it("should resolve the DID Document including a reference to the DID Core 1.0 specification in the `@context` property", async () => {
    const resolution = await api.resolve(providers, contract);
    expect(resolution).not.toBeNull();
    const didDoc = resolution?.didDocument;
    expect(Array.isArray(didDoc?.["@context"])).toBe(true);
    expect(didDoc?.["@context"]?.[0]).toBe("https://www.w3.org/ns/did/v1");
    expect(didDoc?.["@context"]?.[1]).toBe("https://w3id.org/security/jwk/v1");
  });

  it("should resolve the DID Document with an `id` matching the format: `did:midnight:<network_id>:<contract_address>`", async () => {
    const resolution = await api.resolve(providers, contract);
    expect(resolution).not.toBeNull();
    const didDoc = resolution?.didDocument;
    expect(typeof didDoc?.id).toBe("string");
    expect(() => DIDStringSchema.parse(didDoc?.id)).not.toThrow();
    expect(() => MidnightDIDSchema.parse(didDoc?.id)).not.toThrow();

    expect(didDoc?.id).toBeDefined();
    const midnightDIDString = parseMidnightDIDString(didDoc!.id);
    const midnightDID = parseMidnightDID(midnightDIDString);

    expect(midnightDID.network).toBe(api.getMidnightNetwork().toString());
    expect(midnightDID.id).toBe(contractAddress);
  });

  it("should surface DID Document metadata with version and activation state", async () => {
    const resolution = await api.resolve(providers, contract);
    expect(resolution).not.toBeNull();
    expect(resolution?.didDocumentMetadata.versionId).toBeDefined();
    expect(resolution?.didDocumentMetadata.deactivated).toBeUndefined();
    expect(resolution?.didDocumentMetadata.created).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
  });

  it(`should add the verification method with ${VerificationMethodType.JsonWebKey} public key`, async () => {
    const methodId = `${didString}#key-1`;
    const publicKeyJwk = {
      kty: KeyType.OKP,
      crv: CurveType.Ed25519,
      x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };
    const verificationMethod = createVerificationMethod({
      id: methodId,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk,
    });
    await api.addVerificationMethod(contract, providers, verificationMethod);

    const didDocument = await resolveDocument();
    expect(didDocument?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDocument?.verificationMethod?.find(
      (vm) => hasSameMethodFragment(vm.id, methodId),
    );
    expect(insertedVerificationMethod).not.toBeNull();
    expect(insertedVerificationMethod?.type).toEqual(
      VerificationMethodType.JsonWebKey,
    );
    expect(insertedVerificationMethod?.controller).toEqual(didString);
    expect(insertedVerificationMethod?.publicKeyJwk).toEqual(publicKeyJwk);
  });

  it("should add a SchnorrJubjub verification method and resolve it as JWK", async () => {
    const methodId = `${didString}#key-3`;
    const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
    const publicKey = deriveJubjubPublicKeyFromSeed(seed);
    const expectedPublicKeyJwk = createJubjubPublicJwk(seed);

    await api.addSchnorrJubjubVerificationMethod(contract, providers, {
      id: methodId,
      publicKey,
    });

    const didDocument = await resolveDocument();
    expect(didDocument?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDocument?.verificationMethod?.find(
      (vm) => hasSameMethodFragment(vm.id, methodId),
    );
    expect(insertedVerificationMethod?.type).toEqual(
      VerificationMethodType.JsonWebKey,
    );
    expect(insertedVerificationMethod?.controller).toEqual(didString);
    expect(insertedVerificationMethod?.publicKeyJwk).toEqual(
      expectedPublicKeyJwk,
    );
  });

  it("should reject Jubjub keys in the opaque JWK verification method map", async () => {
    const methodId = `${didString}#opaque-jubjub`;
    const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
    const verificationMethod = createVerificationMethod({
      id: methodId,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk: createJubjubPublicJwk(seed),
    });

    await expect(
      api.addVerificationMethod(contract, providers, verificationMethod),
    ).rejects.toThrow(/Jubjub keys must use addSchnorrJubjub/);
  });

  it("should add a P-256 verification method", async () => {
    const methodId = `${didString}#key-p256`;
    const publicKeyJwk = {
      kty: KeyType.EC,
      crv: CurveType.P256,
      x: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
      y: "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM",
    };
    const verificationMethod = createVerificationMethod({
      id: methodId,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk,
    });
    await api.addVerificationMethod(contract, providers, verificationMethod);

    const didDocument = await resolveDocument();
    const insertedVerificationMethod = didDocument?.verificationMethod?.find(
      (vm) => hasSameMethodFragment(vm.id, methodId),
    );
    expect(insertedVerificationMethod?.publicKeyJwk).toEqual(publicKeyJwk);
  });

  it("should add X25519 and secp256k1 verification methods as byte-native storage keys", async () => {
    const x25519 = createVerificationMethod({
      id: `${didString}#key-x25519`,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk: {
        kty: KeyType.OKP,
        crv: CurveType.X25519,
        x: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
      },
    });
    const secp256k1 = createVerificationMethod({
      id: `${didString}#key-secp256k1`,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk: {
        kty: KeyType.EC,
        crv: CurveType.Secp256k1,
        x: "BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU",
        y: "BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY",
      },
    });

    await api.addVerificationMethod(contract, providers, x25519);
    await api.addVerificationMethod(contract, providers, secp256k1);

    const didDocument = await resolveDocument();
    expect(
      didDocument?.verificationMethod?.find((vm) =>
        hasSameMethodFragment(vm.id, x25519.id),
      )?.publicKeyJwk,
    ).toEqual(x25519.publicKeyJwk);
    expect(
      didDocument?.verificationMethod?.find((vm) =>
        hasSameMethodFragment(vm.id, secp256k1.id),
      )?.publicKeyJwk,
    ).toEqual(secp256k1.publicKeyJwk);
  });

  it("should publish and resolve real keys for every supported profile", async () => {
    const privateState = await api.initPrivateState(providers);
    const realKeyContract = await createDidWithDustRetry(
      providers,
      privateState,
    );
    const realKeyDidString = createMidnightDIDString(
      parseContractAddress(realKeyContract.deployTxData.public.contractAddress),
      api.getMidnightNetwork(),
    );
    const resolveRealKeyDocument = async () =>
      (await api.resolve(providers, realKeyContract))?.didDocument;

    const ed25519 = generatePublicJwkPair("ed25519");
    const x25519 = generatePublicJwkPair("x25519");
    const p256 = generateEcPublicJwkPair("P-256");
    const secp256k1 = generateEcPublicJwkPair("secp256k1");
    const bls12381G1 = createBlsPublicJwk(CurveType.BLS12381G1);
    const bls12381G2 = createBlsPublicJwk(CurveType.BLS12381G2);
    const jubjubSeed = new Uint8Array(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
    const jubjubMethodId = `${realKeyDidString}#real-jubjub`;

    const realKeys = [
      {
        id: `${realKeyDidString}#real-ed25519`,
        publicKeyJwk: ed25519.publicJwk,
      },
      {
        id: `${realKeyDidString}#real-x25519`,
        publicKeyJwk: x25519.publicJwk,
      },
      { id: `${realKeyDidString}#real-p256`, publicKeyJwk: p256.publicJwk },
      {
        id: `${realKeyDidString}#real-secp256k1`,
        publicKeyJwk: secp256k1.publicJwk,
      },
      {
        id: `${realKeyDidString}#real-bls12381-g1`,
        publicKeyJwk: bls12381G1,
      },
      {
        id: `${realKeyDidString}#real-bls12381-g2`,
        publicKeyJwk: bls12381G2,
      },
    ].map(({ id, publicKeyJwk }) =>
      createVerificationMethod({
        id,
        type: VerificationMethodType.JsonWebKey,
        controller: realKeyDidString,
        publicKeyJwk,
      }),
    );

    for (const verificationMethod of realKeys) {
      await api.addVerificationMethod(
        realKeyContract,
        providers,
        verificationMethod,
      );
    }
    await api.addSchnorrJubjubVerificationMethod(realKeyContract, providers, {
      id: jubjubMethodId,
      publicKey: deriveJubjubPublicKeyFromSeed(jubjubSeed),
    });

    const didDocument = await resolveRealKeyDocument();
    for (const verificationMethod of realKeys) {
      expect(
        findVerificationMethod(
          didDocument?.verificationMethod,
          verificationMethod.id,
        ).publicKeyJwk,
      ).toEqual(verificationMethod.publicKeyJwk);
    }
    expect(
      findVerificationMethod(didDocument?.verificationMethod, jubjubMethodId)
        .publicKeyJwk,
    ).toEqual(createJubjubPublicJwk(jubjubSeed));

    expectSignatureVerifiesWithRetrievedJwk(
      "ed25519",
      ed25519.privateKey,
      findVerificationMethod(
        didDocument?.verificationMethod,
        `${realKeyDidString}#real-ed25519`,
      ).publicKeyJwk,
    );
    expectSignatureVerifiesWithRetrievedJwk(
      "sha256",
      p256.privateKey,
      findVerificationMethod(
        didDocument?.verificationMethod,
        `${realKeyDidString}#real-p256`,
      ).publicKeyJwk,
    );
    expectSignatureVerifiesWithRetrievedJwk(
      "sha256",
      secp256k1.privateKey,
      findVerificationMethod(
        didDocument?.verificationMethod,
        `${realKeyDidString}#real-secp256k1`,
      ).publicKeyJwk,
    );

    const retrievedX25519 = publicKeyFromRetrievedJwk(
      findVerificationMethod(
        didDocument?.verificationMethod,
        `${realKeyDidString}#real-x25519`,
      ).publicKeyJwk,
    );
    const peerX25519 = generateKeyPairSync("x25519");
    expect(
      diffieHellman({
        privateKey: x25519.privateKey,
        publicKey: peerX25519.publicKey,
      }),
    ).toEqual(
      diffieHellman({
        privateKey: peerX25519.privateKey,
        publicKey: retrievedX25519,
      }),
    );

    const retrievedJubjub = findVerificationMethod(
      didDocument?.verificationMethod,
      jubjubMethodId,
    ).publicKeyJwk;
    const jubjubPublicKey = {
      x: bytesToBigintLe(decodeBase64Url(retrievedJubjub.x)),
      y: bytesToBigintLe(decodeBase64Url(retrievedJubjub.y!)),
    };
    const jubjubSignature = signJubjubPayloadFromSeed(jubjubSeed, payload);
    expect(verifyJubjubPayload(jubjubPublicKey, payload, jubjubSignature)).toBe(
      true,
    );
    await expect(
      api.verifySchnorrJubjubDigestSignature(
        realKeyContract,
        jubjubMethodId,
        payloadToJubjubDigest(payload),
        jubjubSignature,
      ),
    ).resolves.toBeDefined();
  });

  it("should add the verification relation", async () => {
    const methodId = `${didString}#key-1`;
    await api.addVerificationMethodRelation(
      contract,
      providers,
      VerificationMethodRelationType.Authentication,
      methodId,
    );

    const didDoc = await resolveDocument();
    expect(
      didDoc?.authentication?.some(
        (authenticationMethodId) => authenticationMethodId === methodId,
      ),
    ).toBe(true);
  });

  it("should fail to add duplicate verification relation", async () => {
    const methodId = `${didString}#key-1`;
    await expect(
      api.addVerificationMethodRelation(
        contract,
        providers,
        VerificationMethodRelationType.Authentication,
        methodId,
      ),
    ).rejects.toThrow(/already contains verification method/);
  });

  it("should update the DID by adding a new verification method and its corresponding verification relation", async () => {
    const methodId = `${didString}#key-2`;
    const verificationMethod = createVerificationMethod({
      id: methodId,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk: {
        kty: KeyType.OKP,
        crv: CurveType.Ed25519,
        x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    });
    await api.addVerificationMethod(contract, providers, verificationMethod);
    await api.addVerificationMethodRelation(
      contract,
      providers,
      VerificationMethodRelationType.AssertionMethod,
      methodId,
    );

    const didDoc = await resolveDocument();
    expect(didDoc?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDoc?.verificationMethod?.find((vm) =>
      hasSameMethodFragment(vm.id, methodId),
    );
    expect(insertedVerificationMethod).not.toBeNull();
    expect(insertedVerificationMethod?.type).toEqual(
      VerificationMethodType.JsonWebKey,
    );
    const assertionId = parseDIDKeyID(methodId);
    expect(didDoc?.assertionMethod?.includes(assertionId)).toBe(true);
  });

  it("should remove the verification relation", async () => {
    const methodId = `${didString}#key-2`;
    await api.removeVerificationMethodRelation(
      contract,
      providers,
      VerificationMethodRelationType.AssertionMethod,
      methodId,
    );

    const didDoc = await resolveDocument();
    const assertionId = parseDIDKeyID(methodId);
    expect((didDoc?.assertionMethod ?? []).includes(assertionId)).toBe(false);
  });

  it("should fail removing a missing verification relation", async () => {
    const methodId = `${didString}#key-2`;
    await expect(
      api.removeVerificationMethodRelation(
        contract,
        providers,
        VerificationMethodRelationType.AssertionMethod,
        methodId,
      ),
    ).rejects.toThrow(/does not contain verification method/);
  });

  it("should remove the verification method and its relations", async () => {
    const methodId = `${didString}#key-1`;
    await api.removeVerificationMethod(contract, providers, methodId);
    const didDoc = await resolveDocument();
    expect(
      didDoc?.verificationMethod?.some((vm) =>
        hasSameMethodFragment(vm.id, methodId),
      ),
    ).toBe(false);
    const authId = parseDIDKeyID(methodId);
    expect((didDoc?.authentication ?? []).includes(authId)).toBe(false);
  });

  it("should update the DID by adding a new service endpoint", async () => {
    const serviceToAdd = createService({
      id: serviceId,
      type: "DIDCommV2",
      serviceEndpoint: [
        "https://localhost/didcomm/v2",
        "wss://localhost/didcomm/v2",
      ],
    });
    await api.addService(contract, providers, serviceToAdd);

    const didDoc = await resolveDocument();
    expect(didDoc?.service).not.toBeNull();
    const service = didDoc?.service!;
    expect(service.length).toBe(1);
    expect(service[0].id).toBe(`${didString}${serviceToAdd.id}`);
    expect(service[0].type).toBe(serviceToAdd.type);
    expect(service[0].serviceEndpoint).toEqual(serviceToAdd.serviceEndpoint);
  });

  it("should update the DID by modifying the existing service endpoint", async () => {
    const serviceToUpdate = createService({
      id: serviceId,
      type: "DIDCommV2",
      serviceEndpoint: ["https://localhost/updated", "wss://localhost/updated"],
    });
    await api.updateService(contract, providers, serviceToUpdate);

    const didDoc = await resolveDocument();
    expect(didDoc?.service).not.toBeNull();
    const service = didDoc?.service!;
    expect(service.length).toBe(1);
    expect(service[0].id).toBe(`${didString}${serviceToUpdate.id}`);
    expect(service[0].serviceEndpoint).toEqual(serviceToUpdate.serviceEndpoint);
  });

  it("should update the DID by removing the service using its `id`", async () => {
    await api.removeService(contract, providers, serviceId);
    const didDoc = await resolveDocument();
    expect(didDoc?.service?.length ?? 0).toBe(0);
  });

  it("should register services with all DID Core endpoint variations", async () => {
    const serviceDefinitions = [
      {
        service: {
          id: "#linked-domain-1",
          type: "LinkedDomains",
          serviceEndpoint: "https://example.com",
        },
        expectedEndpoint: "https://example.com",
      },
      {
        service: {
          id: "#msg-1",
          type: "Messaging",
          serviceEndpoint: [
            "https://example.org/inbox",
            "https://backup.example.org/inbox",
          ],
        },
        expectedEndpoint: [
          "https://example.org/inbox",
          "https://backup.example.org/inbox",
        ],
      },
      {
        service: {
          id: "#agent-legacy",
          type: "AgentService",
          serviceEndpoint: {
            endpoint: "https://legacy-agent.example.net/",
            routingKeys: ["did:example:456#key-routing"],
            accept: ["didcomm/v1"],
          },
        },
        expectedEndpoint: {
          endpoint: "https://legacy-agent.example.net/",
          routingKeys: ["did:example:456#key-routing"],
          accept: ["didcomm/v1"],
        },
      },
      {
        service: {
          id: "#agent",
          type: "AgentService",
          serviceEndpoint: {
            uri: "https://agent.example.com/",
            routingKeys: ["did:example:456#key-agency"],
            accept: ["didcomm/v2"],
          },
        },
        expectedEndpoint: {
          uri: "https://agent.example.com/",
          routingKeys: ["did:example:456#key-agency"],
          accept: ["didcomm/v2"],
        },
      },
      {
        service: {
          id: "#linked-domain",
          type: "LinkedDomains",
          serviceEndpoint: {
            origins: ["https://example.org", "https://sub.example.org"],
          },
        },
        expectedEndpoint: {
          origins: ["https://example.org", "https://sub.example.org"],
        },
      },
      {
        service: {
          id: "#combo",
          type: "Messaging",
          serviceEndpoint: [
            "https://example.com/inbox",
            {
              uri: "https://backup.example.com/inbox",
              routingKeys: ["did:example:789#routing"],
            },
          ],
        },
        expectedEndpoint: [
          "https://example.com/inbox",
          {
            uri: "https://backup.example.com/inbox",
            routingKeys: ["did:example:789#routing"],
          },
        ],
      },
      {
        service: {
          id: "#normalized",
          type: "LinkedDomains",
          serviceEndpoint: "HTTPS://Example.COM:443/path/../home",
        },
        expectedEndpoint: "https://example.com/home",
      },
    ] as const;

    for (const { service } of serviceDefinitions) {
      const serviceToAdd = createService({
        id: service.id,
        type: service.type,
        serviceEndpoint: Array.isArray(service.serviceEndpoint)
          ? service.serviceEndpoint.map((entry) =>
              typeof entry === "string" ? entry : { ...entry },
            )
          : typeof service.serviceEndpoint === "object"
            ? { ...service.serviceEndpoint }
            : service.serviceEndpoint,
      });
      await api.addService(contract, providers, serviceToAdd);
    }

    const didDoc = await resolveDocument();
    expect(didDoc?.service?.length).toBeGreaterThanOrEqual(
      serviceDefinitions.length,
    );
    for (const { service, expectedEndpoint } of serviceDefinitions) {
      const canonicalId = `${didString}${toFragmentId(service.id)}`;
      const actual = didDoc?.service?.find((svc) => svc.id === canonicalId);
      expect(actual).toBeDefined();
      expect(actual?.type).toBe(service.type);
      expect(actual?.serviceEndpoint).toEqual(expectedEndpoint);
    }

    for (const { service } of serviceDefinitions) {
      await api.removeService(
        contract,
        providers,
        ServiceIdSchema.parse(service.id),
      );
    }

    const finalDoc = await resolveDocument();
    for (const { service } of serviceDefinitions) {
      const canonicalId = `${didString}${toFragmentId(service.id)}`;
      expect(
        finalDoc?.service?.find((svc) => svc.id === canonicalId),
      ).toBeUndefined();
    }
  });

  it("should add alsoKnownAs alias", async () => {
    await api.addAlsoKnownAs(contract, providers, didAsDid);
    const didDoc = await resolveDocument();
    expect(didDoc?.alsoKnownAs?.includes(didAsDid)).toBe(true);
  });

  it("should add second alsoKnownAs alias", async () => {
    await api.addAlsoKnownAs(contract, providers, secondAlias);
    const didDoc = await resolveDocument();
    expect(didDoc?.alsoKnownAs?.includes(didAsDid)).toBe(true);
    expect(didDoc?.alsoKnownAs?.includes(secondAlias)).toBe(true);
  });

  it("should remove the first alsoKnownAs alias", async () => {
    let didDoc = await resolveDocument();
    if (!didDoc?.alsoKnownAs?.includes(didAsDid)) {
      await api.addAlsoKnownAs(contract, providers, didAsDid);
      didDoc = await resolveDocument();
      expect(didDoc?.alsoKnownAs?.includes(didAsDid)).toBe(true);
    }
    await api.removeAlsoKnownAs(contract, providers, didAsDid);
    didDoc = await resolveDocument();
    expect(didDoc?.alsoKnownAs?.includes(didAsDid)).toBe(false);
    expect(didDoc?.alsoKnownAs?.includes(secondAlias)).toBe(true);
  });

  it("should reject invalid alsoKnownAs URI when adding", async () => {
    await expect(
      api.addAlsoKnownAs(contract, providers, "not-a-uri"),
    ).rejects.toThrow(/aliasUri must be a valid absolute URI/);
  });

  it("should reject invalid alsoKnownAs URI when removing", async () => {
    await expect(
      api.removeAlsoKnownAs(contract, providers, " "),
    ).rejects.toThrow(/aliasUri must not be empty/);
  });

  it("should deactivate the DID", async () => {
    await api.deactivate(contract, providers);
    const resolution = await api.resolve(providers, contract);
    expect(resolution?.didDocumentMetadata.deactivated).toBe(true);
  });
});
