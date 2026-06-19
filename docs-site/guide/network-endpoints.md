# Network Endpoints

The API package owns the canonical endpoint profiles in
`packages/api/src/config-profiles.ts`. Use this page to choose a profile and to
see which API class configures each endpoint.

## Profile Matrix

| Runtime profile | API class | DID network segment | Runtime network id | Indexer HTTP GraphQL | Indexer WS | Node RPC | Proof server |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `standalone` | `StandaloneConfig` or `ProfileConfig("standalone")` | `undeployed` | `undeployed` | `http://127.0.0.1:8088/api/v3/graphql` | `ws://127.0.0.1:8088/api/v3/graphql/ws` | `http://127.0.0.1:9944` | `http://127.0.0.1:6300` |
| `testnet-local` | `TestnetLocalConfig` or `ProfileConfig("testnet-local")` | `testnet` | `testnet` | `http://127.0.0.1:8088/api/v3/graphql` | `ws://127.0.0.1:8088/api/v3/graphql/ws` | `http://127.0.0.1:9944` | `http://127.0.0.1:6300` |
| `testnet-remote` | `TestnetRemoteConfig` or `ProfileConfig("testnet-remote")` | `testnet` | `testnet` | `https://indexer.testnet-02.midnight.network/api/v3/graphql` | `wss://indexer.testnet-02.midnight.network/api/v3/graphql/ws` | `https://rpc.testnet-02.midnight.network` | `http://127.0.0.1:6300` |
| `preprod` | `PreprodConfig` or `ProfileConfig("preprod")` | `preprod` | `preprod` | `https://indexer.preprod.midnight.network/api/v4/graphql` | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` | `https://rpc.preprod.midnight.network` | `http://127.0.0.1:6300` |
| `mainnet` | `MainnetConfig` or `ProfileConfig("mainnet")` | `mainnet` | `mainnet` | `https://indexer.mainnet.midnight.network/api/v4/graphql` | `wss://indexer.mainnet.midnight.network/api/v4/graphql/ws` | `https://rpc.mainnet.midnight.network` | `http://127.0.0.1:6300` |

Standalone and local testnet use the current standalone indexer path
`/api/v3/graphql` and the local ports `8088`, `9944`, and `6300`.

## Ownership

`ProfileConfig` resolves the endpoint profile and applies the Midnight runtime
network id before wallet or contract operations start. The named classes are
thin profile-specific wrappers:

| API surface | Owns |
| --- | --- |
| `MIDNIGHT_NETWORK_PROFILES` | profile names, DID/runtime network ids, and default endpoint URLs |
| `ProfileConfig` | data-driven profile selection and endpoint overrides |
| `StandaloneConfig` | standalone local defaults for `did:midnight:undeployed` |
| `TestnetLocalConfig` | local services configured as the `testnet` runtime network |
| `TestnetRemoteConfig` | public testnet indexer and RPC with a local proof server |
| `PreprodConfig` | public preprod indexer and RPC with a local proof server |
| `MainnetConfig` | public mainnet indexer and RPC with a local proof server, plus optional endpoint overrides |

The proof server default is local for every shipped profile. If an application
uses a remote proof service, treat it as trusted with controller-secret witness
material unless the proving design changes.

## Preview

The DID method recognizes the `preview` network segment, but the API package
does not currently ship a `preview` endpoint profile. Do not infer preview
indexer, WebSocket, RPC, or proof-server URLs from other environments; add a
profile to `MIDNIGHT_NETWORK_PROFILES` when a canonical preview deployment is
available.
