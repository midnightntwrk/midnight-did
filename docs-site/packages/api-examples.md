# API Examples

The API examples are runnable Node/TypeScript entry points under
`packages/api/examples/`. Run them from the repository root with development
dependencies installed.

Use them when you need a concrete standalone flow instead of small API snippets.

## Bootstrap An Issuer DID

[`bootstrap-issuer-did.ts`](https://github.com/midnightntwrk/midnight-did/blob/develop/packages/api/examples/bootstrap-issuer-did.ts)
is the end-to-end example for creating an issuer DID with real key material. It
deploys a DID contract, creates an Ed25519 authentication key, creates a
SchnorrJubjub assertion key, publishes both verification methods, attaches their
verification relationships, resolves the DID Document, and writes a downstream
issuer keystore.

```bash
ISSUER_BOOTSTRAP_SEED=<hex-seed> \
ISSUER_KEYSTORE_OUT="$PWD/issuer-keystore.json" \
INDEXER_URL=http://localhost:18088/api/v1/graphql \
NODE_RPC_URL=http://localhost:19944 \
PROOF_SERVER_URL=http://localhost:16300 \
pnpm exec ts-node --esm packages/api/examples/bootstrap-issuer-did.ts
```

The script expects a funded standalone wallet seed. `ISSUER_BOOTSTRAP_SEED` may
be 32 bytes of hex, with or without `0x`, or any string that can be hashed into a
wallet seed. The output path must not already exist.

Output keystore shape:

```json
{
  "did": "did:midnight:undeployed:...",
  "ed25519": {
    "kid": "did:midnight:...#key-auth",
    "secret_hex": "..."
  },
  "jubjub": {
    "kid": "did:midnight:...#key-assert",
    "secret_hex": "..."
  }
}
```

Use this example when a downstream issuer needs a DID plus local signing secrets
for Ed25519 authentication and SchnorrJubjub `assertionMethod` flows.

## Deploy A DID

Run against a funded standalone wallet seed and local standalone network:

```bash
MIDNIGHT_WALLET_SEED=<hex-seed> \
pnpm exec ts-node --esm packages/api/examples/deploy-did.ts
```

The deploy example builds a wallet, configures providers, initializes DID
private state, deploys the DID contract, and resolves the resulting DID
Document.

The underlying provider setup looks like this:

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

## Read DID Ledger State

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

## Update A DID

Run after deployment with the deployed contract address:

```bash
MIDNIGHT_WALLET_SEED=<hex-seed> \
MIDNIGHT_DID_CONTRACT_ADDRESS=<contract-address> \
pnpm exec ts-node --esm packages/api/examples/update-did.ts
```

The update example joins an existing DID contract, adds a verification method
and authentication relation, adds a DIDComm service, updates the service
endpoint, and resolves the final DID Document.

The key value in `update-did.ts` is placeholder material for a disposable
standalone flow. Replace it before using the example against any shared or
persistent network.

## Resolve a DID

```ts
import { resolve } from "@midnight-ntwrk/midnight-did-api";

const resolution = await resolve(
  providers,
  "did:midnight:preprod:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
);
```

## Validate Examples

```bash
pnpm --filter ./packages/api typecheck:examples
```

## When to use this package

- service/backend implementation
- automated DID lifecycle scripts
- integration tests with real providers
