# DID API examples

These examples are package-level Node/TypeScript snippets for direct API usage.
They do not import resolver service, manager service, or UI code.

Run the examples from the repository root with development dependencies
installed; the commands use the root `ts-node` dev dependency.

## Deploy a DID

Run against a funded standalone wallet seed and local standalone network:

```bash
MIDNIGHT_WALLET_SEED=<hex-seed> \
pnpm exec ts-node --esm packages/api/examples/deploy-did.ts
```

The example builds a wallet, configures providers, initializes DID private state,
deploys the DID contract, and resolves the resulting DID document.

## Update a DID

Run after deployment with the deployed contract address:

```bash
MIDNIGHT_WALLET_SEED=<hex-seed> \
MIDNIGHT_DID_CONTRACT_ADDRESS=<contract-address> \
pnpm exec ts-node --esm packages/api/examples/update-did.ts
```

The example joins an existing DID contract, adds a verification method and
authentication relation, adds a DIDComm service, updates the service endpoint,
and resolves the final DID document.

The verification method key value in `update-did.ts` is placeholder key material
for a disposable standalone flow. Replace it with a real verification method key
before using the example against any shared or persistent network.

## Bootstrap an issuer DID

Run against any standalone Midnight environment to deploy an issuer DID with
both Ed25519 authentication and Jubjub assertionMethod verification methods,
emitting a JSON keystore consumable by downstream issuers:

```bash
ISSUER_BOOTSTRAP_SEED=<hex-seed> \
ISSUER_KEYSTORE_OUT=./issuer-keystore.json \
INDEXER_URL=<indexer-url> \
NODE_RPC_URL=<node-rpc-url> \
PROOF_SERVER_URL=<proof-server-url> \
pnpm exec ts-node --esm packages/api/examples/bootstrap-issuer-did.ts
```

The example builds a funded wallet from the genesis seed, calls
`createDID` → `addVerificationMethod` (Ed25519) →
`addVerificationMethodRelation` (authentication) →
`addSchnorrJubjubVerificationMethod` (Jubjub) →
`addVerificationMethodRelation` (assertionMethod), wraps each chain write in a
dust-shortage retry, and writes the resulting keystore to
`ISSUER_KEYSTORE_OUT`.
