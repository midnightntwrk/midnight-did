# Domain Examples

Use the domain package when you need validation and canonicalization without any runtime/provider dependency.

## Parse a Midnight DID

```ts
import { parseMidnightDIDString } from "@midnight-ntwrk/midnight-did-domain";

const did = parseMidnightDIDString(
  "did:midnight:undeployed:08bd152a17007269ba97bb169268321b6f782d162e90be176df5ec5fcb896633",
);
```

## Parse and normalize a DID document

```ts
import { parseDIDDocument } from "@midnight-ntwrk/midnight-did-domain";

const document = parseDIDDocument({
  "@context": ["https://www.w3.org/ns/did/v1"],
  id: "did:midnight:preprod:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  verificationMethod: [
    {
      id: "#auth-main",
      type: "JsonWebKey",
      controller: "did:midnight:preprod:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      publicKeyJwk: {
        kty: "OKP",
        crv: "Ed25519",
        x: "11qYAYafhZMvwAoFKX4gN7QWQ4QwYQ2M7hFrkQ7f8mA",
      },
    },
  ],
  authentication: ["#auth-main"],
});
```

## When to stop here

Stay in `domain` when:

- you are validating payloads
- you are normalizing DID documents
- you do not yet need contract state or indexer integration
