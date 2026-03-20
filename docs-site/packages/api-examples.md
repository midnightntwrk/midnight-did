# API Examples

The API package is the highest-level reusable runtime facade in the repository.

## Build a wallet and providers

```ts
import {
  StandaloneConfig,
  buildFreshWallet,
  configureProviders,
} from "@midnight-ntwrk/midnight-did-api";

const config = new StandaloneConfig();
const walletContext = await buildFreshWallet(config);
const providers = await configureProviders(walletContext, config);
```

## Deploy and read a DID contract

```ts
import {
  deploy,
  getMidnightDIDLedgerState,
  initPrivateState,
} from "@midnight-ntwrk/midnight-did-api";

await initPrivateState(providers);
const didContract = await deploy(providers);
const ledgerState = await getMidnightDIDLedgerState(
  providers,
  didContract.deployTxData.public.contractAddress,
);
```

## Resolve a DID

```ts
import { resolve } from "@midnight-ntwrk/midnight-did-api";

const resolution = await resolve(
  providers,
  "did:midnight:preprod:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
);
```

## When to use this package

- service/backend implementation
- automated DID lifecycle scripts
- integration tests with real providers
