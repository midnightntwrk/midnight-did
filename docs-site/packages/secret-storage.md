# Secret Storage Package

`@midnight-ntwrk/midnight-did-secret-storage` is the key custody and derivation layer used by CLI and service-side flows.

## Focus

- generic `SecretStorage` abstraction
- encrypted file backend
- adapter path for external key managers
- HD derivation
- sign/verify support for Midnight DID key profiles

## Use it when

- you want file-backed, encrypted key custody in Node.js
- you need deterministic key derivation from a validated seed
- you want a reusable package instead of embedding key handling into an app

## Main repository paths

- `secret-storage/src/index.ts`
- `secret-storage/src/file-secret-store.ts`
- `secret-storage/src/hd-derivation.ts`
- `secret-storage/README.md`

## Full source doc

- [Embedded Secret Storage README](/source/secret-storage-readme)

## Important design constraints

- Node.js-focused backend package, not a browser keystore
- seed validation is part of the package contract
- key material is addressed through `keyRef`, not by returning decrypted secrets
- ledger compatibility checks are explicit because Compact field constraints matter

## API reference

- [Generated secret-storage API](/api/reference/secret-storage/)
