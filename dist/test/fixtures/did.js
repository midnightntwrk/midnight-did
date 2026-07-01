import { CurveType, KeyType, VerificationMethodType, } from "../../did-document.js";
export const exampleDid = "did:example:123";
export const exampleDidUrl = `${exampleDid}/path?query#frag`;
export const exampleMethodId = `${exampleDid}#key-1`;
export const exampleJsonWebKey = {
    kty: KeyType.OKP,
    crv: CurveType.Ed25519,
    x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};
export const exampleEcJsonWebKey = {
    kty: KeyType.EC,
    crv: CurveType.Jubjub,
    x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    y: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
};
export const exampleP256JsonWebKey = {
    kty: KeyType.EC,
    crv: CurveType.P256,
    x: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
    y: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
};
export const exampleX25519JsonWebKey = {
    kty: KeyType.OKP,
    crv: CurveType.X25519,
    x: "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM",
};
export const exampleSecp256k1JsonWebKey = {
    kty: KeyType.EC,
    crv: CurveType.Secp256k1,
    x: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
    y: "BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU",
};
export const exampleVerificationMethodInput = {
    id: exampleMethodId,
    type: VerificationMethodType.JsonWebKey,
    controller: exampleDid,
    publicKeyJwk: exampleJsonWebKey,
};
export const exampleRelativeVerificationMethodInput = {
    ...exampleVerificationMethodInput,
    id: "#key-rel",
};
export const exampleServiceInput = {
    id: `${exampleDid}#svc-1`,
    type: "LinkedDomains",
    serviceEndpoint: "https://example.com",
};
export const exampleRelativeServiceInput = {
    id: "#svc-relative",
    type: "LinkedDomains",
    serviceEndpoint: "https://example.com/relative",
};
export const examplePathServiceInput = {
    id: "/services/messaging",
    type: "DIDCommV2",
    serviceEndpoint: "https://example.com/messaging",
};
export const exampleServiceObjectInput = {
    id: `${exampleDid}#svc-object`,
    type: "LinkedDomains",
    serviceEndpoint: {
        uri: "https://example.com/object",
        routingKeys: ["did:example:mediator"],
    },
};
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
];
export const exampleSegmentServiceInput = {
    id: "service-1",
    type: "LinkedDomains",
    serviceEndpoint: "https://example.com/service-1",
};
export const exampleResolutionPayload = {
    "@context": "https://w3id.org/did-resolution/v1",
    didDocumentMetadata: {},
    didResolutionMetadata: {
        contentType: "application/did+json",
    },
};
export const invalidDidStrings = [
    "did:ex",
    "did:example:abc#frag",
    "example:xyz",
];
//# sourceMappingURL=did.js.map