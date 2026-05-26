# DID API examples

These examples are package-level Node/TypeScript snippets for direct API usage.
They do not import resolver service, manager service, or UI code.

Run the examples from the repository root with development dependencies
installed; the commands use the root `ts-node` dev dependency.

## Deploy a DID

Run against a funded standalone wallet seed and local standalone network:

```bash
MIDNIGHT_WALLET_SEED=<hex-seed> \
pnpm exec -- ts-node --esm packages/api/examples/deploy-did.ts
```

The example builds a wallet, configures providers, initializes DID private state,
deploys the DID contract, and resolves the resulting DID document.

## Update a DID

Run after deployment with the deployed contract address:

```bash
MIDNIGHT_WALLET_SEED=<hex-seed> \
MIDNIGHT_DID_CONTRACT_ADDRESS=<contract-address> \
pnpm exec -- ts-node --esm packages/api/examples/update-did.ts
```

The example joins an existing DID contract, adds a verification method and
authentication relation, adds a DIDComm service, updates the service endpoint,
and resolves the final DID document.

The verification method key value in `update-did.ts` is placeholder key material
for a disposable standalone flow. Replace it with a real verification method key
before using the example against any shared or persistent network.
