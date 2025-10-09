import { CurveType, KeyType, VerificationMethodType } from "../../did-document";

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

export const exampleVerificationMethodInput = {
  id: exampleMethodId,
  type: VerificationMethodType.JsonWebKey,
  controller: exampleDid,
  publicKeyJwk: exampleJsonWebKey,
} as const;

export const exampleServiceInput = {
  id: `${exampleDid}#svc-1`,
  type: "LinkedDomains",
  serviceEndpoint: "https://example.com",
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
