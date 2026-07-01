import { CurveType, KeyType, VerificationMethodType } from "../../did-document.js";
export declare const exampleDid = "did:example:123";
export declare const exampleDidUrl = "did:example:123/path?query#frag";
export declare const exampleMethodId = "did:example:123#key-1";
export declare const exampleJsonWebKey: {
    readonly kty: KeyType.OKP;
    readonly crv: CurveType.Ed25519;
    readonly x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
};
export declare const exampleEcJsonWebKey: {
    readonly kty: KeyType.EC;
    readonly crv: CurveType.Jubjub;
    readonly x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    readonly y: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
};
export declare const exampleP256JsonWebKey: {
    readonly kty: KeyType.EC;
    readonly crv: CurveType.P256;
    readonly x: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
    readonly y: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI";
};
export declare const exampleX25519JsonWebKey: {
    readonly kty: KeyType.OKP;
    readonly crv: CurveType.X25519;
    readonly x: "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM";
};
export declare const exampleSecp256k1JsonWebKey: {
    readonly kty: KeyType.EC;
    readonly crv: CurveType.Secp256k1;
    readonly x: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ";
    readonly y: "BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU";
};
export declare const exampleVerificationMethodInput: {
    readonly id: "did:example:123#key-1";
    readonly type: VerificationMethodType.JsonWebKey;
    readonly controller: "did:example:123";
    readonly publicKeyJwk: {
        readonly kty: KeyType.OKP;
        readonly crv: CurveType.Ed25519;
        readonly x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    };
};
export declare const exampleRelativeVerificationMethodInput: {
    readonly id: "#key-rel";
    readonly type: VerificationMethodType.JsonWebKey;
    readonly controller: "did:example:123";
    readonly publicKeyJwk: {
        readonly kty: KeyType.OKP;
        readonly crv: CurveType.Ed25519;
        readonly x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    };
};
export declare const exampleServiceInput: {
    readonly id: "did:example:123#svc-1";
    readonly type: "LinkedDomains";
    readonly serviceEndpoint: "https://example.com";
};
export declare const exampleRelativeServiceInput: {
    readonly id: "#svc-relative";
    readonly type: "LinkedDomains";
    readonly serviceEndpoint: "https://example.com/relative";
};
export declare const examplePathServiceInput: {
    readonly id: "/services/messaging";
    readonly type: "DIDCommV2";
    readonly serviceEndpoint: "https://example.com/messaging";
};
export declare const exampleServiceObjectInput: {
    readonly id: "did:example:123#svc-object";
    readonly type: "LinkedDomains";
    readonly serviceEndpoint: {
        readonly uri: "https://example.com/object";
        readonly routingKeys: readonly ["did:example:mediator"];
    };
};
export declare const exampleServiceSet: readonly [{
    readonly service: {
        readonly id: "#linked-domain-1";
        readonly type: "LinkedDomains";
        readonly serviceEndpoint: "https://example.com";
    };
    readonly expectedEndpoint: "https://example.com";
}, {
    readonly service: {
        readonly id: "#msg-1";
        readonly type: "Messaging";
        readonly serviceEndpoint: readonly ["https://example.org/inbox", "https://backup.example.org/inbox"];
    };
    readonly expectedEndpoint: readonly ["https://example.org/inbox", "https://backup.example.org/inbox"];
}, {
    readonly service: {
        readonly id: "#agent-legacy";
        readonly type: "AgentService";
        readonly serviceEndpoint: {
            readonly endpoint: "https://legacy-agent.example.net/";
            readonly routingKeys: readonly ["did:example:456#key-routing"];
            readonly accept: readonly ["didcomm/v1"];
        };
    };
    readonly expectedEndpoint: {
        readonly endpoint: "https://legacy-agent.example.net/";
        readonly routingKeys: readonly ["did:example:456#key-routing"];
        readonly accept: readonly ["didcomm/v1"];
    };
}, {
    readonly service: {
        readonly id: "#agent";
        readonly type: "AgentService";
        readonly serviceEndpoint: {
            readonly uri: "https://agent.example.com/";
            readonly routingKeys: readonly ["did:example:456#key-agency"];
            readonly accept: readonly ["didcomm/v2"];
        };
    };
    readonly expectedEndpoint: {
        readonly uri: "https://agent.example.com/";
        readonly routingKeys: readonly ["did:example:456#key-agency"];
        readonly accept: readonly ["didcomm/v2"];
    };
}, {
    readonly service: {
        readonly id: "#linked-domain";
        readonly type: "LinkedDomains";
        readonly serviceEndpoint: {
            readonly origins: readonly ["https://example.org", "https://sub.example.org"];
        };
    };
    readonly expectedEndpoint: {
        readonly origins: readonly ["https://example.org", "https://sub.example.org"];
    };
}, {
    readonly service: {
        readonly id: "#combo";
        readonly type: "Messaging";
        readonly serviceEndpoint: readonly ["https://example.com/inbox", {
            readonly uri: "https://backup.example.com/inbox";
            readonly routingKeys: readonly ["did:example:789#routing"];
        }];
    };
    readonly expectedEndpoint: readonly ["https://example.com/inbox", {
        readonly uri: "https://backup.example.com/inbox";
        readonly routingKeys: readonly ["did:example:789#routing"];
    }];
}, {
    readonly service: {
        readonly id: "#normalized";
        readonly type: "LinkedDomains";
        readonly serviceEndpoint: "HTTPS://Example.COM:443/path/../home";
    };
    readonly expectedEndpoint: "https://example.com/home";
}];
export declare const exampleSegmentServiceInput: {
    readonly id: "service-1";
    readonly type: "LinkedDomains";
    readonly serviceEndpoint: "https://example.com/service-1";
};
export declare const exampleResolutionPayload: {
    readonly "@context": "https://w3id.org/did-resolution/v1";
    readonly didDocumentMetadata: {};
    readonly didResolutionMetadata: {
        readonly contentType: "application/did+json";
    };
};
export declare const invalidDidStrings: string[];
//# sourceMappingURL=did.d.ts.map