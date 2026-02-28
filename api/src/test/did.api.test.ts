import {
  createMidnightDIDString,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did";
import {
  createService,
  createVerificationMethod,
  CurveType,
  DIDStringSchema,
  KeyType,
  MidnightDIDSchema,
  MidnightDIDString,
  parseDIDKeyID,
  parseMidnightDID,
  parseMidnightDIDString,
  ServiceIdSchema,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as api from "..";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "..";
import { currentDir } from "../config";
import { createLogger } from "../logger-utils";
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

let containerRuntimeAvailable = true;
let containerRuntimeError: string | undefined;
try {
  const { getContainerRuntimeClient } = await import(
    "testcontainers/build/container-runtime/clients/client.js"
  );
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
    contract = await api.createDID(providers, privateState);
    expect(contract).not.toBeNull();

    contractAddress = parseContractAddress(
      contract.deployTxData.public.contractAddress,
    );
    didString = createMidnightDIDString(contractAddress, api.midnightNetwork);
    didAsDid = DIDStringSchema.parse(didString);

    const didLedger = await api.getMidnightDIDLedgerState(
      providers,
      contractAddress,
    );
    expect(didLedger?.active).toBe(true);
    expect(didLedger?.verificationMethods.isEmpty()).toBe(true);
    expect(didLedger?.assertionMethodRelation.isEmpty()).toBe(true);
    expect(didLedger?.authenticationRelation.isEmpty()).toBe(true);
    expect(didLedger?.capabilityDelegationRelation.isEmpty()).toBe(true);
    expect(didLedger?.capabilityInvocationRelation.isEmpty()).toBe(true);
    expect(didLedger?.services.isEmpty()).toBe(true);
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

    expect(didDoc?.id).toBeDefined();
    const midnightDIDString = parseMidnightDIDString(didDoc!.id);
    const midnightDID = parseMidnightDID(midnightDIDString);

    expect(midnightDID.network).toBe(api.midnightNetwork.toString());
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
      x: "Kg",
    };
    const verificationMethod = createVerificationMethod({
      id: methodId,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk,
    });
    await api.addVerificationMethod(contract, verificationMethod);

    const didDocument = await resolveDocument();
    expect(didDocument?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDocument?.verificationMethod?.find(
      (vm) => vm.id === toFragmentId(methodId),
    );
    expect(insertedVerificationMethod).not.toBeNull();
    expect(insertedVerificationMethod?.type).toEqual(
      VerificationMethodType.JsonWebKey,
    );
    expect(insertedVerificationMethod?.controller).toEqual(didString);
    expect(insertedVerificationMethod?.publicKeyJwk).toEqual(publicKeyJwk);
  });

  it("should add a JubJub verification method that retains the y coordinate", async () => {
    const methodId = `${didString}#key-3`;
    const publicKeyJwk = {
      kty: KeyType.EC,
      crv: CurveType.Jubjub,
      x: "Kg",
      y: "VA",
    };
    const verificationMethod = createVerificationMethod({
      id: methodId,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk,
    });
    await api.addVerificationMethod(contract, verificationMethod);

    const didDocument = await resolveDocument();
    expect(didDocument?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDocument?.verificationMethod?.find(
      (vm) => vm.id === toFragmentId(methodId),
    );
    expect(insertedVerificationMethod?.publicKeyJwk).toEqual(publicKeyJwk);
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
        (authenticationMethodId) =>
          authenticationMethodId === toFragmentId(methodId),
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
        x: "Kg",
      },
    });
    await api.addVerificationMethod(contract, verificationMethod);
    await api.addVerificationMethodRelation(
      contract,
      providers,
      VerificationMethodRelationType.AssertionMethod,
      methodId,
    );

    const didDoc = await resolveDocument();
    expect(didDoc?.verificationMethod).not.toBeNull();
    const insertedVerificationMethod = didDoc?.verificationMethod?.find(
      (vm) => vm.id === toFragmentId(methodId),
    );
    expect(insertedVerificationMethod).not.toBeNull();
    expect(insertedVerificationMethod?.type).toEqual(
      VerificationMethodType.JsonWebKey,
    );
    const assertionId = parseDIDKeyID(toFragmentId(methodId));
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
    const assertionId = parseDIDKeyID(toFragmentId(methodId));
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
      didDoc?.verificationMethod?.some(
        (vm) => vm.id === toFragmentId(methodId),
      ),
    ).toBe(false);
    const authId = parseDIDKeyID(toFragmentId(methodId));
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
    await api.addService(contract, serviceToAdd);

    const didDoc = await resolveDocument();
    expect(didDoc?.service).not.toBeNull();
    const service = didDoc?.service!;
    expect(service.length).toBe(1);
    expect(service[0].id).toBe(serviceToAdd.id);
    expect(service[0].type).toBe(serviceToAdd.type);
    expect(service[0].serviceEndpoint).toEqual(serviceToAdd.serviceEndpoint);
  });

  it("should update the DID by modifying the existing service endpoint", async () => {
    const serviceToUpdate = createService({
      id: serviceId,
      type: "DIDCommV2",
      serviceEndpoint: ["https://localhost/updated", "wss://localhost/updated"],
    });
    await api.updateService(contract, serviceToUpdate);

    const didDoc = await resolveDocument();
    expect(didDoc?.service).not.toBeNull();
    const service = didDoc?.service!;
    expect(service.length).toBe(1);
    expect(service[0].id).toBe(serviceToUpdate.id);
    expect(service[0].serviceEndpoint).toEqual(serviceToUpdate.serviceEndpoint);
  });

  it("should update the DID by removing the service using its `id`", async () => {
    await api.removeService(contract, serviceId);
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
      await api.addService(contract, serviceToAdd);
    }

    const didDoc = await resolveDocument();
    expect(didDoc?.service?.length).toBeGreaterThanOrEqual(
      serviceDefinitions.length,
    );
    for (const { service, expectedEndpoint } of serviceDefinitions) {
      const fragmentId = toFragmentId(service.id);
      const actual = didDoc?.service?.find((svc) => svc.id === fragmentId);
      expect(actual).toBeDefined();
      expect(actual?.type).toBe(service.type);
      expect(actual?.serviceEndpoint).toEqual(expectedEndpoint);
    }

    for (const { service } of serviceDefinitions) {
      await api.removeService(contract, ServiceIdSchema.parse(service.id));
    }

    const finalDoc = await resolveDocument();
    for (const { service } of serviceDefinitions) {
      const fragmentId = toFragmentId(service.id);
      expect(
        finalDoc?.service?.find((svc) => svc.id === fragmentId),
      ).toBeUndefined();
    }
  });

  it("should add alsoKnownAs alias", async () => {
    await api.addAlsoKnownAs(contract, didAsDid);
    const didDoc = await resolveDocument();
    expect(didDoc?.alsoKnownAs?.includes(didAsDid)).toBe(true);
  });

  it("should add second alsoKnownAs alias", async () => {
    await api.addAlsoKnownAs(contract, secondAlias);
    const didDoc = await resolveDocument();
    expect(didDoc?.alsoKnownAs?.includes(didAsDid)).toBe(true);
    expect(didDoc?.alsoKnownAs?.includes(secondAlias)).toBe(true);
  });

  it("should remove the first alsoKnownAs alias", async () => {
    let didDoc = await resolveDocument();
    if (!didDoc?.alsoKnownAs?.includes(didAsDid)) {
      await api.addAlsoKnownAs(contract, didAsDid);
      didDoc = await resolveDocument();
      expect(didDoc?.alsoKnownAs?.includes(didAsDid)).toBe(true);
    }
    await api.removeAlsoKnownAs(contract, didAsDid);
    didDoc = await resolveDocument();
    expect(didDoc?.alsoKnownAs?.includes(didAsDid)).toBe(false);
    expect(didDoc?.alsoKnownAs?.includes(secondAlias)).toBe(true);
  });

  it("should reject invalid alsoKnownAs URI when adding", async () => {
    await expect(api.addAlsoKnownAs(contract, "not-a-uri")).rejects.toThrow(
      /aliasUri must be a valid absolute URI/,
    );
  });

  it("should reject invalid alsoKnownAs URI when removing", async () => {
    await expect(api.removeAlsoKnownAs(contract, " ")).rejects.toThrow(
      /aliasUri must not be empty/,
    );
  });

  it("should deactivate the DID", async () => {
    await api.deactivate(contract);
    const resolution = await api.resolve(providers, contract);
    expect(resolution?.didDocumentMetadata.deactivated).toBe(true);
  });
});
