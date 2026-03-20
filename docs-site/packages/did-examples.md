# DID Examples

Use the DID package when you already have ledger state and need DID Core-compatible output.

## Convert ledger state into a DID document

```ts
import { LedgerToDomain, MidnightNetwork } from "@midnight-ntwrk/midnight-did";

const didDocument = LedgerToDomain.ledgerStateToDIDDocument(
  ledgerState,
  MidnightNetwork.Preprod,
  contractAddress,
);
```

## Resolve through the reusable resolver

```ts
import {
  MidnightDIDResolver,
  MidnightNetwork,
} from "@midnight-ntwrk/midnight-did";

const resolver = new MidnightDIDResolver({
  expectedNetwork: MidnightNetwork.Preprod,
  ledgerReader: async (contractAddress) => {
    return readLedgerStateSomehow(contractAddress);
  },
});

const result = await resolver.resolveResult(
  "did:midnight:preprod:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
);
```

## When to use this package

- resolver implementation work
- indexer-backed DID resolution
- ledger-to-domain mapping outside the main API package
