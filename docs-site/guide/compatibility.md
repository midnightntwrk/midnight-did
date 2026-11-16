# Compatibility and Release Baselines

This page records **tested release baselines** and, separately, an explicitly
labelled **candidate** row for an unpublished migration. The candidate records
local Ledger9 integration evidence; it is not a published support claim. It is
not an open-ended compatibility range. A **published historical baseline**
records the exact DID package and ZK artifact set this repository release-tested;
it is superseded and does not imply continuing Ledger8 support. A **Candidate**
row records the pins and local integration evidence for an unreleased migration;
it must not be read as published support or as a published artifact set. **Compatibility reference** records a legacy release for migration
comparison only; it does not imply continuing support.

Published npm manifests and matching release artifacts are authoritative for
published package identities. Manifest `engines`, Compact language pragmas,
and similar constraints describe admissible inputs; this matrix does not infer
support for newer Node, pnpm, Compact, Midnight JS, wallet SDK, ledger, or
proof-server versions. A major-only Node CI selector is not an exact patch-level
runtime claim. Re-test the complete integration before moving any component
beyond its recorded baseline or selector below.

This page is generated from
[`docs-site/data/compatibility-baselines.json`](https://github.com/midnightntwrk/midnight-did/blob/main/docs-site/data/compatibility-baselines.json)
and current repository pins. Edit the source data or owning manifests and run
`pnpm --filter docs-site docs:sync-compatibility`; do not edit this page by
hand.

## Compatibility matrix

<!-- prettier-ignore -->
| Evidence-backed baseline | DID 0.5.0 | DID 0.6.0 | DID 0.7.0 | DID 1.0.0 |
| --- | --- | --- | --- | --- |
| Recommended status wording | Compatibility reference / legacy; no continuing-support implication | Published historical baseline — no continuing Ledger8 support | Published historical baseline — no continuing Ledger8 support | Candidate — local Ledger9 integration validated; not published |
| Coordinated package set | `@midnight-ntwrk/midnight-did-api@0.5.0`<br>`@midnight-ntwrk/midnight-did-domain@0.5.0`<br>`@midnight-ntwrk/midnight-did@0.5.0`<br>`@midnight-ntwrk/midnight-did-jubjub-schnorr@0.5.0`<br>`@midnight-ntwrk/midnight-did-contract@0.5.0` | `@midnight-ntwrk/midnight-did-api@0.6.0`<br>`@midnight-ntwrk/midnight-did-domain@0.6.0`<br>`@midnight-ntwrk/midnight-did@0.6.0`<br>`@midnight-ntwrk/midnight-did-jubjub-schnorr@0.6.0`<br>`@midnight-ntwrk/midnight-did-contract@0.6.0` | `@midnight-ntwrk/midnight-did-api@0.7.0`<br>`@midnight-ntwrk/midnight-did-domain@0.7.0`<br>`@midnight-ntwrk/midnight-did@0.7.0`<br>`@midnight-ntwrk/midnight-did-jubjub-schnorr@0.7.0`<br>`@midnight-ntwrk/midnight-did-contract@0.7.0` | `@midnight-ntwrk/midnight-did-api@source 0.6.0`<br>`@midnight-ntwrk/midnight-did-domain@source 0.6.0`<br>`@midnight-ntwrk/midnight-did@source 0.6.0`<br>`@midnight-ntwrk/midnight-did-jubjub-schnorr@source 0.6.0`<br>`@midnight-ntwrk/midnight-did-contract@source 0.6.0` |
| Release tag / source commit | [`v0.5.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.5.0) → [`a14267cec3c1ab7e00bb0f058a54267d913a321b`](https://github.com/midnightntwrk/midnight-did/commit/a14267cec3c1ab7e00bb0f058a54267d913a321b) | [`v0.6.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.6.0) → [`8f788e2ef5652fa7f9cfdc71a3cac40d5f3683bf`](https://github.com/midnightntwrk/midnight-did/commit/8f788e2ef5652fa7f9cfdc71a3cac40d5f3683bf) | [`v0.7.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.7.0) → [`4e7f6b0f69bf4e2c8506a9693f8d0c3dfe68e550`](https://github.com/midnightntwrk/midnight-did/commit/4e7f6b0f69bf4e2c8506a9693f8d0c3dfe68e550) | Not released — candidate source `Ledger9 migration for issue #520 (unreleased)` |
| Node CI selector | Major `24` | Major `24` | Major `24` | Major `24` |
| Node release-tested runtime | Exact patch not retained | [`24.20.0`](https://github.com/midnightntwrk/midnight-did/actions/runs/35322501440) | Exact patch not retained | Exact patch not retained |
| pnpm tested baseline | `10.34.1` | `10.34.5` | `10.34.5` | `10.34.5` |
| Compact compiler | `0.30.0` | `0.31.1` | `0.31.1` | `0.36.0` |
| DID Compact pragma | `>= 0.20` | `>= 0.20` | `>= 0.20` | `>= 0.20` |
| Jubjub wrapper pragma | `0.22` | `>= 0.22` | `>= 0.22` | `>= 0.22` |
| `compact-runtime` | `0.16.0` | `0.16.0` | `0.16.0` | `0.21.0` |
| `compact-js` | `2.5.0` | `2.5.0` | `2.5.0` | `3.0.0` |
| Ledger generation/package | `@midnight-ntwrk/ledger-v8@8.1.0` | `@midnight-ntwrk/ledger-v8@8.1.0` | `@midnight-ntwrk/ledger-v8@8.1.0` | `@midnightntwrk/ledger-v9@1.0.0` |
| Midnight JS package family | `4.0.2` | `4.0.2` | `4.0.2` | `5.0.0` |
| Wallet SDK baseline | `@midnight-ntwrk/wallet-sdk-address-format@3.1.0`<br>`@midnight-ntwrk/wallet-sdk-dust-wallet@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-facade@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-hd@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-shielded@2.1.0`<br>`@midnight-ntwrk/wallet-sdk-unshielded-wallet@2.1.0` | `@midnight-ntwrk/wallet-sdk-address-format@3.1.0`<br>`@midnight-ntwrk/wallet-sdk-dust-wallet@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-facade@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-hd@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-shielded@2.1.0`<br>`@midnight-ntwrk/wallet-sdk-unshielded-wallet@2.1.0` | `@midnight-ntwrk/wallet-sdk-address-format@3.1.0`<br>`@midnight-ntwrk/wallet-sdk-dust-wallet@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-facade@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-hd@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-shielded@2.1.0`<br>`@midnight-ntwrk/wallet-sdk-unshielded-wallet@2.1.0` | `@midnight-ntwrk/wallet-sdk-abstractions@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-address-format@4.0.0`<br>`@midnight-ntwrk/wallet-sdk-capabilities@4.0.0`<br>`@midnight-ntwrk/wallet-sdk-dust-wallet@5.0.0`<br>`@midnight-ntwrk/wallet-sdk-facade@5.0.0`<br>`@midnight-ntwrk/wallet-sdk-hd@4.0.0`<br>`@midnight-ntwrk/wallet-sdk-shielded@4.0.0`<br>`@midnight-ntwrk/wallet-sdk-unshielded-wallet@4.0.0` |
| Proof-server source image | `midnightntwrk/proof-server:8.0.3` | `midnightntwrk/proof-server:8.0.3` | `midnightntwrk/proof-server:8.0.3` | `midnightntwrk/proof-server:9.0.1` |
| Midnight node image | Not retained | Not retained | Not retained | `midnightntwrk/midnight-node:2.1.101` |
| Indexer source image | Not retained | Not retained | Not retained | `midnightntwrk/indexer-standalone:4.4.101` |
| Tested topology | Not retained | Not retained | Not retained | `Disposable local standalone (node + indexer + proof server)` |
| Tested network | Not retained | Not retained | Not retained | `undeployed` |
| Local Node runtime evidence | Not retained | Not retained | Not retained | `24.18.1` (local) |
| Public ZK release | [`v0.5.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.5.0) / [`midnight-did-zk-artifacts-0.5.0.tar.gz`](https://github.com/midnightntwrk/midnight-did/releases/download/v0.5.0/midnight-did-zk-artifacts-0.5.0.tar.gz) | [`v0.6.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.6.0) / [`midnight-did-zk-artifacts-0.6.0.tar.gz`](https://github.com/midnightntwrk/midnight-did/releases/download/v0.6.0/midnight-did-zk-artifacts-0.6.0.tar.gz) | [`v0.7.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.7.0) / [`midnight-did-zk-artifacts-0.7.0.tar.gz`](https://github.com/midnightntwrk/midnight-did/releases/download/v0.7.0/midnight-did-zk-artifacts-0.7.0.tar.gz) | Not published (candidate artifacts only) |
| GHCR coordinate | `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.5.0` | `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.6.0` | `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.7.0` | Not published |

The GHCR coordinates identify matching generic OCI artifacts. Registry access
requires Midnight organization access and GitHub Container Registry
authentication; the linked GitHub Release archives are the public download
path.

## Publication-manifest caveats

The `v0.5.0` source tag reports version
`0.4.0` in the root and workspace manifests,
while npm and the immutable GitHub Release artifacts identify all five packages
as `0.5.0`. The publication pipeline rewrites root/workspace versions before
packing without committing those rewrites. This matrix therefore uses npm
metadata and release artifacts as authority for the published `0.5.0` package
identities, and uses tagged source only for its release-tested toolchain and
runtime pins. Dependency similarity, `engines`, and language pragmas must not
be read as broader compatibility guarantees.

The `v0.7.0` source keeps version
`0.6.0` in the root and workspace manifests. The
manual publication pipeline rewrites the five package manifests and
`MIDNIGHT_DID_API_VERSION` to `0.7.0` before packing, then verifies the
coordinated tarball inventory without committing those release-only rewrites.
The immutable `v0.7.0` tag target and published manifests are therefore the
authority for 0.7 package identity; the tagged repository inputs remain the
authority for the toolchain and runtime pins in this matrix.

## Keeping the matrix current

The generator derives the 1.0.0 row's repository-owned pins from
the `.nvmrc` CI selector, the exact pnpm package-manager pin,
root/workspace manifests, CI, quality, and publish workflow constants, both
Compact language pragmas, and every runtime-owned node, indexer, and
`midnightntwrk/proof-server` image pin in both standalone compose files. The
exact CI Node release runtime and local Node patch are retained separately as
evidence.
Generation fails when those inputs drift from the reviewed machine-readable
baseline. Add or
update a reviewed release baseline rather than silently carrying old evidence
forward.
