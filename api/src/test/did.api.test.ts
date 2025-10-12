import { DIDOperation, DIDOperationType } from "@midnight-ntwrk/midnight-did";
import {
  ContractAddress as MidnightContractAddress,
  createMidnightDIDString,
  CurveType,
  DIDStringSchema,
  KeyType,
  MidnightDIDSchema,
  MidnightDIDString,
  parseContractAddress,
  parseDIDKeyID,
  parseMidnightDID,
  parseMidnightDIDString,
  parseService,
  ServiceIdSchema,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { type Resource } from "@midnight-ntwrk/wallet";
import { type Wallet } from "@midnight-ntwrk/wallet-api";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as api from "..";
import { DeployedMidnightDIDContract, type MidnightDIDProviders } from "..";
import { currentDir } from "../config";
import { BigIntReplacer, createLogger } from "../logger-utils";
import { TestEnvironment } from "./commons";

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

describe("Midnight DID method API", () => {
  let testEnvironment: TestEnvironment;
  let wallet: Wallet & Resource;
  let providers: MidnightDIDProviders;
  let contract: DeployedMidnightDIDContract;
  let contractAddress: MidnightContractAddress;
  let didString: MidnightDIDString;
  const serviceId = ServiceIdSchema.parse("service-1");
  const serviceFragmentId = `#${serviceId}`;

  beforeAll(
    async () => {
      api.setLogger(logger);
      testEnvironment = new TestEnvironment(logger);
      const testConfiguration = await testEnvironment.start();
      wallet = await testEnvironment.getWallet();
      providers = await api.configureProviders(
        wallet,
        testConfiguration.dappConfig,
      );
    },
    1000 * 60 * 45 * 10,
  );

  afterAll(async () => {
    await testEnvironment.saveWalletCache();
    await testEnvironment.shutdown();
  });

  it("should publish the associated smart-contract to the Midnight blockchain with an empty state", async () => {
    const privateState = await api.initPrivateState(providers);
    contract = await api.createDID(providers, privateState);
    expect(contract).not.toBeNull();

    contractAddress = parseContractAddress(
      contract.deployTxData.public.contractAddress,
    );
    logger.info(`MidnightDID contract address: ${contractAddress}`);

    didString = createMidnightDIDString(contractAddress, api.midnightNetwork);
    logger.info(`MidnightDID ID is: ${didString}`);

    const didLedger = await api.getMidnightDIDLedgerState(
      providers,
      contractAddress,
    );
    expect(didLedger?.active).toBeTruthy;
    expect(didLedger?.verificationMethods.isEmpty).toBeTruthy;
    expect(didLedger?.assertionMethodRelation.isEmpty).toBeTruthy;
    expect(didLedger?.authenticationRelation.isEmpty).toBeTruthy;
    expect(didLedger?.capabilityDelegationRelation.isEmpty).toBeTruthy;
    expect(didLedger?.capabilityInvocationRelation.isEmpty).toBeTruthy;
    expect(didLedger?.services.isEmpty).toBeTruthy;
  });

  it("should resolve the DID Document including a reference to the DID Core 1.0 specification in the `@context` property", async () => {
    const resolution = await api.resolve(providers, contract);
    expect(resolution).not.toBeNull();
    const didDoc = resolution?.didDocument;
    expect(Array.isArray(didDoc?.["@context"])).toBe(true);
    expect(didDoc?.["@context"]?.[0]).toBe("https://www.w3.org/ns/did/v1");
    expect(didDoc?.["@context"]?.[1]).toBe(
      "https://w3c.github.io/vc-jws-2020/contexts/v1",
    );
  });

  it("should resolve the DID Document with an `id` matching the format: `did:midnight:<network_id>:<contract_address>`", async () => {
    const resolution = await api.resolve(providers, contract);
    expect(resolution).not.toBeNull();
    const didDoc = resolution?.didDocument;
    expect(typeof didDoc?.id).toBe("string");
    expect(() => DIDStringSchema.parse(didDoc?.id)).not.toThrow();
    expect(() => MidnightDIDSchema.parse(didDoc?.id)).not.toThrow();

    const midnightDIDString = parseMidnightDIDString(didDoc?.id);
    const midnightDID = parseMidnightDID(midnightDIDString);

    expect(midnightDID.network).toBe(api.midnightNetwork.toString());
    expect(midnightDID.id).toBe(contractAddress);
  });

  it("should surface DID Document metadata with version and activation state", async () => {
    const resolution = await api.resolve(providers, contract);
    expect(resolution).not.toBeNull();
    expect(resolution?.didDocumentMetadata.versionId).toBeDefined();
    expect(resolution?.didDocumentMetadata.deactivated).toBe(false);
  });

  it(`should add the verification method with ${VerificationMethodType.JsonWebKey} public key`, async () => {
    const methodId = parseDIDKeyID(`${didString}#key-1`);
    const publicKeyJwk = {
      kty: KeyType.OKP,
      crv: CurveType.Ed25519,
      x: "Kg",
    };
    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.AddVerificationMethod,
        verificationMethod: {
          id: methodId,
          type: VerificationMethodType.JsonWebKey,
          controller: didString,
          publicKeyJwk: publicKeyJwk,
        },
      },
    ];
    await api.update(contract, operations);
    const resolution = await api.resolve(providers, contract);
    const didDocument = resolution?.didDocument;
    logger.info(
      `DIDDocument JSON: ${JSON.stringify(didDocument, BigIntReplacer, 2)}`,
    );

    expect(didDocument?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDocument?.verificationMethod?.find(
      (vm) => vm.id === toFragmentId(methodId),
    );
    expect(insertedVerificationMethod).not.toBeNull;
    expect(insertedVerificationMethod?.type).toEqual(
      VerificationMethodType.JsonWebKey,
    );
    expect(insertedVerificationMethod?.controller).toEqual(didString);
    expect(insertedVerificationMethod?.publicKeyJwk).toEqual(publicKeyJwk);
  });

  it("should add a JubJub verification method that retains the y coordinate", async () => {
    const methodId = parseDIDKeyID(`${didString}#key-3`);
    const publicKeyJwk = {
      kty: KeyType.EC,
      crv: CurveType.Jubjub,
      x: "Kg",
      y: "VA",
    };
    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.AddVerificationMethod,
        verificationMethod: {
          id: methodId,
          type: VerificationMethodType.JsonWebKey,
          controller: didString,
          publicKeyJwk,
        },
      },
    ];
    await api.update(contract, operations);
    const didDocument = (await api.resolve(providers, contract))?.didDocument;
    expect(didDocument?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDocument?.verificationMethod?.find(
      (vm) => vm.id === toFragmentId(methodId),
    );
    expect(insertedVerificationMethod?.publicKeyJwk).toEqual(publicKeyJwk);
  });

  it("should add the verification relation", async () => {
    const methodId = parseDIDKeyID(`${didString}#key-1`);
    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.AddVerificationMethodRelation,
        relation: VerificationMethodRelationType.Authentication,
        methodId: methodId,
      },
    ];
    await api.update(contract, operations);
    const didDoc = (await api.resolve(providers, contract))?.didDocument;
    logger.info(
      `DIDDocument JSON: ${JSON.stringify(didDoc, BigIntReplacer, 2)}`,
    );
    expect(
      didDoc?.authentication?.some(
        (authenticationMethodId) =>
          authenticationMethodId === toFragmentId(methodId),
      ),
    ).toBe(true);
  });

  it("should update the DID by adding a new verification method and its corresponding verification relation using a batch operation", async () => {
    const methodId = parseDIDKeyID(`${didString}#key-2`);
    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.AddVerificationMethod,
        verificationMethod: {
          id: methodId,
          type: VerificationMethodType.JsonWebKey,
          controller: didString,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            x: "Kg",
          },
        },
      },
      {
        type: DIDOperationType.AddVerificationMethodRelation,
        relation: VerificationMethodRelationType.AssertionMethod,
        methodId: methodId,
      },
    ];
    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);
    const didDoc = (await api.resolve(providers, contract))?.didDocument;
    logger.info(
      `DIDDocument JSON: ${JSON.stringify(didDoc, BigIntReplacer, 2)}`,
    );
    expect(didDoc?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDoc?.verificationMethod?.find(
      (vm) => vm.id === toFragmentId(methodId),
    );
    expect(insertedVerificationMethod).not.toBeNull;
    expect(insertedVerificationMethod?.type).toEqual(
      VerificationMethodType.JsonWebKey,
    );
  });

  it("should update the DID by adding a new service endpoint", async () => {
    const serviceToAdd = parseService({
      id: serviceFragmentId,
      type: "DIDCommV2",
      serviceEndpoint: [
        "https://localhost/didcomm/v2",
        "wss://localhost/didcomm/v2",
      ],
    });
    const operations: DIDOperation[] = [
      { type: DIDOperationType.AddService, service: serviceToAdd },
    ];
    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);
    const didDoc = (await api.resolve(providers, contract))?.didDocument;
    logger.info(
      `DIDDocument JSON: ${JSON.stringify(didDoc, BigIntReplacer, 2)}`,
    );
    expect(didDoc?.service).not.toBeNull();
    const service = didDoc?.service!;
    expect(service.length).toBe(1);
    expect(service[0].id).toBe(serviceToAdd.id);
    expect(service[0].type).toBe(serviceToAdd.type);
    expect(service[0].serviceEndpoint).toEqual(serviceToAdd.serviceEndpoint);
  });

  it("should update the DID by modifying the existing service endpoint", async () => {
    const serviceToUpdate = parseService({
      id: serviceFragmentId,
      type: "DIDCommV2",
      serviceEndpoint: ["https://localhost/updated", "wss://localhost/updated"],
    });
    const operations: DIDOperation[] = [
      { type: DIDOperationType.UpdateService, service: serviceToUpdate },
    ];
    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);
    const didDoc = (await api.resolve(providers, contract))?.didDocument;
    logger.info(
      `DIDDocument JSON (after update): ${JSON.stringify(didDoc, BigIntReplacer, 2)}`,
    );
    expect(didDoc?.service).not.toBeNull();
    const service = didDoc?.service!;
    expect(service.length).toBe(1);
    expect(service[0].id).toBe(serviceToUpdate.id);
    expect(service[0].serviceEndpoint).toEqual(serviceToUpdate.serviceEndpoint);
  });

  it("should update the DID by removing the service using its `id`", async () => {
    const operations: DIDOperation[] = [
      {
        type: DIDOperationType.RemoveService,
        serviceId,
      },
    ];
    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);
    const didDoc = (await api.resolve(providers, contract))?.didDocument;
    logger.info(
      `DIDDocument JSON (after removal): ${JSON.stringify(didDoc, BigIntReplacer, 2)}`,
    );
    expect(didDoc?.service?.length ?? 0).toBe(0);
  });

  it("should add alsoKnownAs alias", async () => {
    const operations: DIDOperation[] = [
      { type: DIDOperationType.AddAlsoKnownAs, aliasUri: didString },
    ];
    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);
    const didDoc = (await api.resolve(providers, contract))?.didDocument;
    logger.info(
      `DIDDocument JSON (after aka add): ${JSON.stringify(didDoc, BigIntReplacer, 2)}`,
    );
    expect(didDoc?.alsoKnownAs?.includes(didString)).toBe(true);
  });

  it("should add second alsoKnownAs alias", async () => {
    const operations: DIDOperation[] = [
      { type: DIDOperationType.AddAlsoKnownAs, aliasUri: "did:example:aka-2" },
    ];
    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);
    const didDoc = (await api.resolve(providers, contract))?.didDocument;
    logger.info(
      `DIDDocument JSON (after aka second add): ${JSON.stringify(didDoc, BigIntReplacer, 2)}`,
    );
    expect(didDoc?.alsoKnownAs?.includes(didString)).toBe(true);
    expect(didDoc?.alsoKnownAs?.includes("did:example:aka-2")).toBe(true);
  });

  it("should remove the first alsoKnownAs alias", async () => {
    let didDoc = (await api.resolve(providers, contract))?.didDocument;
    if (!didDoc?.alsoKnownAs?.includes(didString)) {
      const addOps: DIDOperation[] = [
        { type: DIDOperationType.AddAlsoKnownAs, aliasUri: didString },
      ];
      await api.update(contract, addOps);
      didDoc = (await api.resolve(providers, contract))?.didDocument;
      expect(didDoc?.alsoKnownAs?.includes(didString)).toBe(true);
    }
    const operations: DIDOperation[] = [
      { type: DIDOperationType.RemoveAlsoKnownAs, aliasUri: didString },
    ];
    const result = await api.update(contract, operations);
    expect(result.txId).toMatch(/[0-9a-f]{64}/);
    didDoc = (await api.resolve(providers, contract))?.didDocument;
    logger.info(
      `DIDDocument JSON (after aka remove): ${JSON.stringify(didDoc, BigIntReplacer, 2)}`,
    );
    expect(didDoc?.alsoKnownAs?.includes(didString)).toBe(false);
    expect(didDoc?.alsoKnownAs?.includes("did:example:aka-2")).toBe(true);
  });
});
