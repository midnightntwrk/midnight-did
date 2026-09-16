# Adopt and migrate to 0.6

Version `0.6.0-rc1` is the currently published 0.6 prerelease. It is suitable
for consumer testing, but it is not the final `0.6.0` release. Keep every
Midnight DID package and the ZK artifact bundle on the same exact version; do
not combine `0.5.0`, snapshots, RCs, or a future final release in one runtime.

The 0.6 evidence is bounded to the repository's DID Core 1.0 profile. It is not
W3C certification and does not establish DID Core 1.1 or DID Resolution
support.

## Install the published RC

The documentation examples directly import the API, domain, DID, and Jubjub
Schnorr packages. The contract package is also published for consumers that
import its generated runtime types or Compact artifacts directly. Install the
exact RC versions required by the examples or application:

```bash
pnpm add \
  @midnight-ntwrk/midnight-did-api@0.6.0-rc1 \
  @midnight-ntwrk/midnight-did-domain@0.6.0-rc1 \
  @midnight-ntwrk/midnight-did@0.6.0-rc1 \
  @midnight-ntwrk/midnight-did-jubjub-schnorr@0.6.0-rc1 \
  @midnight-ntwrk/midnight-did-contract@0.6.0-rc1
```

These exact versions are public on npmjs:

- [`@midnight-ntwrk/midnight-did-api@0.6.0-rc1`](https://www.npmjs.com/package/@midnight-ntwrk/midnight-did-api/v/0.6.0-rc1)
- [`@midnight-ntwrk/midnight-did-domain@0.6.0-rc1`](https://www.npmjs.com/package/@midnight-ntwrk/midnight-did-domain/v/0.6.0-rc1)
- [`@midnight-ntwrk/midnight-did@0.6.0-rc1`](https://www.npmjs.com/package/@midnight-ntwrk/midnight-did/v/0.6.0-rc1)
- [`@midnight-ntwrk/midnight-did-jubjub-schnorr@0.6.0-rc1`](https://www.npmjs.com/package/@midnight-ntwrk/midnight-did-jubjub-schnorr/v/0.6.0-rc1)
- [`@midnight-ntwrk/midnight-did-contract@0.6.0-rc1`](https://www.npmjs.com/package/@midnight-ntwrk/midnight-did-contract/v/0.6.0-rc1)

The npmjs version pages expose each package's npm provenance. The matching
[`v0.6.0-rc1` GitHub prerelease](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.6.0-rc1)
contains the ZK archive, manifest, SHA-256 file, signatures, certificates, and
SLSA provenance. The same ZK bundle is available from the [GHCR package](https://github.com/orgs/midnightntwrk/packages/container/package/midnight-did-zk-artifacts)
as `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.6.0-rc1`. For the
existing artifact layout, checksum validation, signature/provenance behavior,
and helper API, see [Package Artifact
Metadata](/development/publishing#package-artifact-metadata).

## Bootstrap the matching ZK bundle

`configureProviders` constructs the ZK and proof providers. Before the
application process imports the API package and calls it, provide:

- a running indexer, node, and proof server selected through a documented
  [network profile](/guide/network-endpoints);
- a built and funded wallet context; and
- the unpacked `0.6.0-rc1` ZK bundle through
  `MIDNIGHT_DID_ZK_CONFIG_PATH`.

One way to prepare the bundle is to run this as a separate bootstrap process:

```bash
node --input-type=module <<'EOF'
import { downloadMidnightDidGithubReleaseZkArtifacts } from "@midnight-ntwrk/midnight-did-api";

const bundle = await downloadMidnightDidGithubReleaseZkArtifacts({
  version: "0.6.0-rc1",
  outputDir: ".midnight-did-zk/0.6.0-rc1",
});
console.log(bundle.zkConfigPath);
EOF
```

The helper verifies the release SHA-256 file, checks the downloaded manifest
against the archive manifest, and validates every circuit file checksum. Then
start the application with the path set **before its first API import**:

```bash
export MIDNIGHT_DID_ZK_CONFIG_PATH="$PWD/.midnight-did-zk/0.6.0-rc1"
node dist/app.js
```

The application can then create its profile and wallet before configuring
providers:

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

`buildFreshWallet` waits for funds, so the selected runtime must make funds
available to the new wallet. Use an application-owned persisted seed or wallet
restore flow outside disposable standalone testing. Key custody, resolver
services, and manager/product workflows are outside this DID package bootstrap.

## Future final 0.6.0

**Not yet published:** do not run the following command until all five exact
`0.6.0` package versions and the matching `0.6.0` ZK bundle are publicly
available:

```bash
# FUTURE FINAL 0.6.0 — NOT YET PUBLISHED
pnpm add \
  @midnight-ntwrk/midnight-did-api@0.6.0 \
  @midnight-ntwrk/midnight-did-domain@0.6.0 \
  @midnight-ntwrk/midnight-did@0.6.0 \
  @midnight-ntwrk/midnight-did-jubjub-schnorr@0.6.0 \
  @midnight-ntwrk/midnight-did-contract@0.6.0
```

When final `0.6.0` is published, use
`ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.6.0` or the `v0.6.0`
release asset with those packages. Do not reuse the RC1 ZK bundle with final
packages.

## Migrate from 0.5.0

Update every coordinated `@midnight-ntwrk/midnight-did-*` dependency and the ZK
bundle together. In addition to the installation and bootstrap changes above,
apply the following API behavior changes.

### Remove relationships before verification methods

Verification-method removal no longer purges DID verification relationships.
Remove the selected relationships first, one finalized transaction at a time,
and remove the method only after those removals are confirmed:

```ts
for (const relation of relationsToRemove) {
  await removeVerificationMethodRelation(
    didContract,
    providers,
    relation,
    methodId,
  );
}

await removeVerificationMethod(didContract, providers, methodId);
```

`removeVerificationMethod` and `removeSchnorrJubjubVerificationMethod` throw
`VerificationMethodReferencedError` while references remain. Inspect its
ordered `relations`. After an ambiguous or partial failure, re-read ledger
state, skip removals already reflected on-chain, and submit only outstanding
relationship removals before retrying method removal.

### Run one writer process per DID

The supported 0.6 baseline assumes one application process updates a given DID.
The API's fail-fast critical section coordinates overlapping controller
rotation, recovery, pending-state reconciliation, and protected
contract-binding lifecycle work in that process; it is neither a global
serializer for ordinary DID mutations nor a distributed lock. Ordinary
mutations continue to rely on contract expected-version checks. Applications
that intentionally use multiple writer processes must supply distributed
locking or equivalent fencing. See
[discussion #440](https://github.com/midnightntwrk/midnight-did/discussions/440)
for the decision and future considerations.

### Identify the DID during pending-state reconciliation

Pending controller-state recovery and discard now require the canonical
`contractAddress`. After connectivity is restored, obtain trusted finalized
ledger state, derive the replacement public key from the retained secret, and
compare the two public keys before retrying. Reconnection or the first available
read alone is not proof of non-finalization. Pass the address and the
authoritative confirmed outcome:

```ts
await recoverPendingControllerPrivateState(providers, {
  contractAddress,
  rotationFinalized: true,
});

await discardPendingControllerPrivateState(providers, {
  contractAddress,
  rotationFinalized: false,
});
```

`rotationFinalized` is an unchecked caller assertion; the helpers do not query
ledger state. `getMidnightDIDLedgerState` exposes the configured public data
provider's state without adding a finality or freshness guarantee. Use
provider-specific authoritative evidence before passing either value.

Promote when the finalized current controller key is derived from the retained
secret. Discard only after authoritative reconciliation confirms that the
operation did not finalize; otherwise retain the candidate. Do not infer the
outcome from elapsed time. After cancelling underlying work or restarting the
writer process, reconcile finalized ledger and private state before another
mutation.
