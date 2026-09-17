#!/usr/bin/env node
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const did = `did:midnight:devnet:${"a".repeat(64)}`;
const mediaTypes = ["application/did+json", "application/did+ld+json"];

const canonical = (value) => {
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [key, sort(item[key])]),
      );
    }
    return item;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};
const digest = (value) => createHash("sha256").update(value).digest("hex");

const ledgerDefinition = Object.freeze({
  active: true,
  alsoKnownAs: Object.freeze(["https://example.com/midnight-subject"]),
  assertionMethodRelation: Object.freeze(["key-1"]),
  authenticationRelation: Object.freeze(["key-1"]),
  capabilityDelegationRelation: Object.freeze(["key-1"]),
  capabilityInvocationRelation: Object.freeze(["key-1"]),
  created: "1700000000000",
  deactivated: false,
  idByte: 170,
  keyAgreementRelation: Object.freeze([]),
  operationCount: "3",
  schnorrJubjubVerificationMethods: Object.freeze([]),
  services: Object.freeze([
    Object.freeze([
      "service-1",
      Object.freeze({
        id: "service-1",
        serviceEndpoint: '"https://example.com/midnight"',
        typ: "LinkedDomains",
      }),
    ]),
  ]),
  updated: "1700000001000",
  verificationMethods: Object.freeze([
    Object.freeze([
      "key-1",
      Object.freeze({
        publicKeyJwk: Object.freeze({
          crv: 0,
          kty: 3,
          x: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
          y: "",
        }),
        typ: 1,
      }),
    ]),
  ]),
  version: "1",
});

const iterable = (items) => ({
  *[Symbol.iterator]() {
    yield* items;
  },
  isEmpty: () => items.length === 0,
});

const ledgerState = () => ({
  id: { bytes: new Uint8Array(32).fill(ledgerDefinition.idByte) },
  version: BigInt(ledgerDefinition.version),
  active: ledgerDefinition.active,
  created: BigInt(ledgerDefinition.created),
  updated: BigInt(ledgerDefinition.updated),
  deactivated: ledgerDefinition.deactivated,
  operationCount: BigInt(ledgerDefinition.operationCount),
  alsoKnownAs: iterable(ledgerDefinition.alsoKnownAs),
  verificationMethods: iterable(ledgerDefinition.verificationMethods),
  schnorrJubjubVerificationMethods: iterable(
    ledgerDefinition.schnorrJubjubVerificationMethods,
  ),
  authenticationRelation: iterable(ledgerDefinition.authenticationRelation),
  assertionMethodRelation: iterable(ledgerDefinition.assertionMethodRelation),
  keyAgreementRelation: iterable(ledgerDefinition.keyAgreementRelation),
  capabilityInvocationRelation: iterable(
    ledgerDefinition.capabilityInvocationRelation,
  ),
  capabilityDelegationRelation: iterable(
    ledgerDefinition.capabilityDelegationRelation,
  ),
  services: iterable(ledgerDefinition.services),
});

const decodeRepresentation = (result, expectedType) => {
  if (result.didDocumentStream === null) {
    throw new Error(
      `Public resolver returned no ${expectedType} representation`,
    );
  }
  if (result.didResolutionMetadata.contentType !== expectedType) {
    throw new Error(
      `Public resolver returned unexpected content type for ${expectedType}`,
    );
  }
  const representation = new TextDecoder().decode(result.didDocumentStream);
  return { parsed: JSON.parse(representation), representation };
};

export const generateFixture = async (publicApi) => {
  const ledgerReader = async (contractAddress) => {
    if (contractAddress !== "a".repeat(64)) {
      throw new Error(
        `Unexpected deterministic ledger read: ${contractAddress}`,
      );
    }
    return ledgerState();
  };
  const resolver = new publicApi.MidnightDIDResolver({
    expectedNetwork: publicApi.MidnightNetwork.DevNet,
    ledgerReader,
  });
  const envelope = await resolver.resolveDIDResolutionResult(did);
  if (envelope.didDocument === null || envelope.didResolutionMetadata.error) {
    throw new Error(
      "Public resolver did not produce the deterministic DID Document",
    );
  }

  const representations = {};
  for (const mediaType of mediaTypes) {
    const result = await resolver.resolveRepresentation(did, {
      accept: mediaType,
    });
    representations[mediaType] = {
      ...decodeRepresentation(result, mediaType),
      metadata: result.didDocumentMetadata,
    };
  }

  const consumed = publicApi.parseMidnightDIDDocument(
    representations["application/did+ld+json"].parsed,
  );
  if (canonical(consumed) !== canonical(envelope.didDocument)) {
    throw new Error(
      "parseMidnightDIDDocument did not preserve the generated document",
    );
  }

  const properties = structuredClone(envelope.didDocument);
  delete properties["@context"];
  const cases = Object.fromEntries(
    mediaTypes.map((mediaType) => {
      const generated = representations[mediaType];
      return [
        mediaType,
        {
          didDocumentDataModel: {
            representationSpecificEntries:
              mediaType === "application/did+ld+json"
                ? { "@context": generated.parsed["@context"] }
                : {},
          },
          didDocumentMetadata: generated.metadata,
          didResolutionMetadata: { contentType: mediaType },
          representation: generated.representation,
        },
      ];
    }),
  );

  return {
    conformingConsumers: mediaTypes.map((mediaType) => {
      const generated = representations[mediaType];
      const representationSpecificEntries =
        mediaType === "application/did+ld+json"
          ? { "@context": generated.parsed["@context"] }
          : {};
      return {
        input: {
          mediaType,
          options: {},
          representation: generated.representation,
        },
        name:
          mediaType === "application/did+ld+json"
            ? "Midnight public package JSON-LD parser round trip"
            : "Midnight public package-generated DID JSON representation",
        output: {
          didDocumentDataModel: properties,
          errors: [],
          representationSpecificEntries,
        },
      };
    }),
    didMethod: "did:midnight",
    didParameters: {},
    dids: [did],
    generation: {
      ledgerFixtureSha256: digest(canonical(ledgerDefinition)),
      packageCalls: [
        "MidnightDIDResolver.resolveDIDResolutionResult",
        "MidnightDIDResolver.resolveRepresentation(application/did+json)",
        "MidnightDIDResolver.resolveRepresentation(application/did+ld+json)",
        "parseMidnightDIDDocument(application/did+ld+json)",
      ],
      source: "built-public-package-exports",
    },
    implementation: "@midnight-ntwrk/midnight-did",
    implementer: "Midnight",
    supportedContentTypes: mediaTypes,
    [did]: {
      didDocumentDataModel: { properties },
      ...cases,
    },
  };
};

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex === -1 ? undefined : process.argv[outputIndex + 1];
  if (!output)
    throw new Error("Usage: generate-w3c-fixture.mjs --output <path>");
  const publicApi = await import(new URL("../dist/index.js", import.meta.url));
  const fixture = await generateFixture(publicApi);
  await writeFile(output, canonical(fixture), { flag: "wx" });
}
