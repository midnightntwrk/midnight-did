# Midnight DID

Midnight DID is the reference implementation of the `did:midnight` method.

This site keeps the public documentation small and implementation-focused:

- the DID method specification
- the contract/API package boundaries
- the current key-storage model
- local build, test, and publishing commands

Resolver services, DID manager UI/backend, and secret storage live in
[`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver).
VC/VP packages live in
[`midnight-verifiable-credentials`](https://github.com/midnightntwrk/midnight-verifiable-credentials).

## Start Here

- [Method Specification](/spec/midnight-method)
- [Local Development](/guide/local-development)
- [Packages](/packages/)
- [GitHub Pages publishing](/guide/github-pages)
- [Architecture](/architecture/)
- [Use Cases](/use-cases/)

## Key Model

- Opaque W3C JWK keys are stored as canonical strings.
- Native SchnorrJubjub keys are stored as `JubjubPoint` values.
- Resolvers merge both key maps into the DID Document.
- SchnorrJubjub verification reads the key from ledger state by verification method id.
