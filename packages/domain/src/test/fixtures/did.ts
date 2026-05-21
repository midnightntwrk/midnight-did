import {
  CurveType,
  KeyType,
  VerificationMethodType,
} from "../../did-document.js";

export const exampleDid = "did:example:123";
export const exampleDidUrl = `${exampleDid}/path?query#frag`;
export const exampleMethodId = `${exampleDid}#key-1`;

export const exampleJsonWebKey = {
  kty: KeyType.OKP,
  crv: CurveType.Ed25519,
  x: "AA",
} as const;

export const exampleEcJsonWebKey = {
  kty: KeyType.EC,
  crv: CurveType.Jubjub,
  x: "AA",
  y: "AQ",
} as const;

export const exampleP256JsonWebKey = {
  kty: KeyType.EC,
  crv: CurveType.P256,
  x: "AQ",
  y: "Ag",
} as const;

export const exampleVerificationMethodInput = {
  id: exampleMethodId,
  type: VerificationMethodType.JsonWebKey,
  controller: exampleDid,
  publicKeyJwk: exampleJsonWebKey,
} as const;

export const exampleRelativeVerificationMethodInput = {
  ...exampleVerificationMethodInput,
  id: "#key-rel",
} as const;

export const exampleServiceInput = {
  id: `${exampleDid}#svc-1`,
  type: "LinkedDomains",
  serviceEndpoint: "https://example.com",
} as const;

export const exampleRelativeServiceInput = {
  id: "#svc-relative",
  type: "LinkedDomains",
  serviceEndpoint: "https://example.com/relative",
} as const;

export const examplePathServiceInput = {
  id: "/services/messaging",
  type: "DIDCommV2",
  serviceEndpoint: "https://example.com/messaging",
} as const;

export const exampleServiceObjectInput = {
  id: `${exampleDid}#svc-object`,
  type: "LinkedDomains",
  serviceEndpoint: {
    uri: "https://example.com/object",
    routingKeys: ["did:example:mediator"],
  },
} as const;

export const exampleServiceSet = [
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

export const exampleSegmentServiceInput = {
  id: "service-1",
  type: "LinkedDomains",
  serviceEndpoint: "https://example.com/service-1",
} as const;

export const exampleResolutionPayload = {
  "@context": "https://w3id.org/did-resolution/v1",
  didDocumentMetadata: {},
  didResolutionMetadata: {
    contentType: "application/did+json",
  },
} as const;

export const invalidDidStrings = [
  "did:ex",
  "did:example:abc#frag",
  "example:xyz",
];
