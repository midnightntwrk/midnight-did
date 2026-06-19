# Quickstart

This flow creates a DID in the standalone environment, publishes key material,
resolves the DID Document, and verifies a SchnorrJubjub signature against the key
stored in ledger state.

## Prerequisites

- Node.js 24 and pnpm 10.
- Midnight Compact compiler `0.30.0`.
- The standalone Midnight services required by `./run.sh api --light --strict`.

```bash
pnpm install
compact update 0.30.0
```

## Prefer A Runnable Issuer Bootstrap

Use the issuer bootstrap example when you want a complete TypeScript flow with
real key creation and ledger publication:

```bash
ISSUER_BOOTSTRAP_SEED=<hex-seed> \
ISSUER_KEYSTORE_OUT="$PWD/issuer-keystore.json" \
INDEXER_URL=http://127.0.0.1:8088/api/v3/graphql \
NODE_RPC_URL=http://127.0.0.1:9944 \
PROOF_SERVER_URL=http://127.0.0.1:6300 \
pnpm exec ts-node --esm packages/api/examples/bootstrap-issuer-did.ts
```

The script creates and publishes an Ed25519 authentication verification method
and a SchnorrJubjub `assertionMethod` verification method, resolves the DID
Document to confirm both relations, and writes the local signing secrets to the
issuer keystore. See [API Examples](/packages/api-examples#bootstrap-an-issuer-did)
for the output shape and source link. See
[Network Endpoints](/guide/network-endpoints) for the canonical profile matrix
and standalone endpoint defaults.

The rest of this page shows the same API surface as smaller steps.

## Create Providers And Deploy

```ts
import {
  StandaloneConfig,
  buildFreshWallet,
  configureProviders,
  deploy,
  initPrivateState,
} from "@midnight-ntwrk/midnight-did-api";

const config = new StandaloneConfig();
const walletContext = await buildFreshWallet(config);
const providers = await configureProviders(walletContext, config);

await initPrivateState(providers);
const didContract = await deploy(providers);
```

The deployed contract address is the DID subject:

```ts
const contractAddress = didContract.deployTxData.public.contractAddress;
const did = `did:midnight:undeployed:${contractAddress}`;
```

## Add An Interoperable JWK Key

Use `addVerificationMethod` for Ed25519, X25519, P-256, secp256k1,
BLS12381G1, and BLS12381G2 `publicKeyJwk` entries.

```ts
import { addVerificationMethod } from "@midnight-ntwrk/midnight-did-api";
import {
  createVerificationMethod,
  CurveType,
  KeyType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";

const ed25519Method = createVerificationMethod({
  id: "#ed25519-1",
  type: VerificationMethodType.JsonWebKey,
  controller: did,
  publicKeyJwk: {
    kty: KeyType.OKP,
    crv: CurveType.Ed25519,
    x: "11qYAYdkWdtN8H1V1hdY9zFQd9Kq4o2P4pX8zM1xL3A",
  },
});

await addVerificationMethod(didContract, ed25519Method);
```

## Add A SchnorrJubjub Key

Use the SchnorrJubjub helper when the key must be usable by Midnight-native
proof circuits.

```ts
import { addSchnorrJubjubVerificationMethod } from "@midnight-ntwrk/midnight-did-api";
import { deriveJubjubPublicKeyFromSeed } from "@midnight-ntwrk/midnight-did-jubjub-schnorr";

const jubjubSeed = crypto.getRandomValues(new Uint8Array(32));
const jubjubPublicKey = deriveJubjubPublicKeyFromSeed(jubjubSeed);

await addSchnorrJubjubVerificationMethod(didContract, {
  id: "#jubjub-1",
  publicKey: jubjubPublicKey,
});
```

Persist `jubjubSeed` in your application key store. The DID contract stores only
the public `JubjubPoint`.

## Link A Key To A Relationship

```ts
import { addVerificationMethodRelation } from "@midnight-ntwrk/midnight-did-api";
import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";

await addVerificationMethodRelation(
  didContract,
  providers,
  VerificationMethodRelationType.Authentication,
  "#ed25519-1",
);
```

## Resolve The DID

```ts
import { resolve } from "@midnight-ntwrk/midnight-did-api";

const resolution = await resolve(providers, did);
console.log(resolution.didDocument);
```

The resolver returns one DID Document with both key maps merged into
`verificationMethod`.

## Verify A SchnorrJubjub Signature

```ts
import { verifySchnorrJubjubDigestSignature } from "@midnight-ntwrk/midnight-did-api";
import {
  payloadToJubjubDigest,
  signJubjubDigestFromSeed,
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";

const payload = new TextEncoder().encode("example payload");
const digest = payloadToJubjubDigest(payload);
const signature = signJubjubDigestFromSeed(jubjubSeed, digest);

await verifySchnorrJubjubDigestSignature(
  didContract,
  "#jubjub-1",
  digest,
  signature,
);
```

The verifier reads `#jubjub-1` from ledger state. The caller does not supply a
public key, so the proof is tied to the current DID Document state.

## Next Steps

- Review the [Key Model](/guide/key-model) before choosing key profiles.
- Use [Network Endpoints](/guide/network-endpoints) when selecting a runtime
  profile.
- Use [Compact Contract Surface](/compact/) before changing circuits.
- Use [Local Development](/development/local-development) when preparing a PR.
