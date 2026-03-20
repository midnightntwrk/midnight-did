# Secret Storage Examples

Use `secret-storage` when you need reusable server-side key custody and derivation.

## Initialize a file-backed store

```ts
import { FileSecretStore } from "@midnight-ntwrk/midnight-did-secret-storage";

const store = new FileSecretStore();
await store.initialize({
  location: "/tmp/midnight-did-secrets.json",
  passphrase: "dev-secret",
});
```

## Generate a key

```ts
const { keyRef, publicJwk } = await store.generateKey({
  id: "auth-main",
  kty: "OKP",
  crv: "Ed25519",
  purpose: "authentication",
});
```

## Derive a key from a shared seed

```ts
const { keyRef } = await store.deriveKeyFromSeed({
  id: "web-main",
  seedHex: "11".repeat(32),
  kty: "EC",
  crv: "P-256",
  account: 0,
  index: 0,
});
```

## Sign and verify

```ts
const payload = new TextEncoder().encode("midnight-did");
const { signature } = await store.sign({ keyRef, payload });
const verified = await store.verify({ keyRef, payload, signature });
```

## When to use this package

- CLI and backend secret management
- shared-seed workflows
- reusable key lifecycle logic outside any single app
