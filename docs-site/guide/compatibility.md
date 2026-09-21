# Compatibility and Release Baselines

This page records **tested release baselines**, not open-ended compatibility
ranges. **Current** means the latest published DID package and ZK artifact set
that this repository release-tested. **Compatibility reference** records a
legacy release for migration comparison only; it does not imply continuing
support.

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

## Evidence-backed matrix

<!-- prettier-ignore -->
| Evidence-backed baseline | DID 0.5.0 | DID 0.6.0 |
| --- | --- | --- |
| Recommended status wording | Compatibility reference / legacy; no continuing-support implication | Current published and release-tested baseline |
| Coordinated package set | `@midnight-ntwrk/midnight-did-api@0.5.0`<br>`@midnight-ntwrk/midnight-did-domain@0.5.0`<br>`@midnight-ntwrk/midnight-did@0.5.0`<br>`@midnight-ntwrk/midnight-did-jubjub-schnorr@0.5.0`<br>`@midnight-ntwrk/midnight-did-contract@0.5.0` | `@midnight-ntwrk/midnight-did-api@0.6.0`<br>`@midnight-ntwrk/midnight-did-domain@0.6.0`<br>`@midnight-ntwrk/midnight-did@0.6.0`<br>`@midnight-ntwrk/midnight-did-jubjub-schnorr@0.6.0`<br>`@midnight-ntwrk/midnight-did-contract@0.6.0` |
| Release tag / source commit | [`v0.5.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.5.0) → [`a14267cec3c1ab7e00bb0f058a54267d913a321b`](https://github.com/midnightntwrk/midnight-did/commit/a14267cec3c1ab7e00bb0f058a54267d913a321b) | [`v0.6.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.6.0) → [`8f788e2ef5652fa7f9cfdc71a3cac40d5f3683bf`](https://github.com/midnightntwrk/midnight-did/commit/8f788e2ef5652fa7f9cfdc71a3cac40d5f3683bf) |
| Node CI selector | Major `24` | Major `24` |
| Node release-tested runtime | Exact patch not retained | [`24.20.0`](https://github.com/midnightntwrk/midnight-did/actions/runs/35322501440) |
| pnpm tested baseline | `10.34.1` | `10.34.5` |
| Compact compiler | `0.30.0` | `0.31.1` |
| DID Compact pragma | `>= 0.20` | `>= 0.20` |
| Jubjub wrapper pragma | `0.22` | `>= 0.22` |
| `compact-runtime` | `0.16.0` | `0.16.0` |
| `compact-js` | `2.5.0` | `2.5.0` |
| Ledger generation/package | `@midnight-ntwrk/ledger-v8@8.1.0` | `@midnight-ntwrk/ledger-v8@8.1.0` |
| Midnight JS package family | `4.0.2` | `4.0.2` |
| Wallet SDK baseline | `@midnight-ntwrk/wallet-sdk-address-format@3.1.0`<br>`@midnight-ntwrk/wallet-sdk-dust-wallet@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-facade@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-hd@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-shielded@2.1.0`<br>`@midnight-ntwrk/wallet-sdk-unshielded-wallet@2.1.0` | `@midnight-ntwrk/wallet-sdk-address-format@3.1.0`<br>`@midnight-ntwrk/wallet-sdk-dust-wallet@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-facade@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-hd@3.0.0`<br>`@midnight-ntwrk/wallet-sdk-shielded@2.1.0`<br>`@midnight-ntwrk/wallet-sdk-unshielded-wallet@2.1.0` |
| Proof-server source image | `midnightntwrk/proof-server:8.0.3` | `midnightntwrk/proof-server:8.0.3` |
| Public ZK release | [`v0.5.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.5.0) / [`midnight-did-zk-artifacts-0.5.0.tar.gz`](https://github.com/midnightntwrk/midnight-did/releases/download/v0.5.0/midnight-did-zk-artifacts-0.5.0.tar.gz) | [`v0.6.0`](https://github.com/midnightntwrk/midnight-did/releases/tag/v0.6.0) / [`midnight-did-zk-artifacts-0.6.0.tar.gz`](https://github.com/midnightntwrk/midnight-did/releases/download/v0.6.0/midnight-did-zk-artifacts-0.6.0.tar.gz) |
| GHCR coordinate | `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.5.0` | `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.6.0` |

The GHCR coordinates identify matching generic OCI artifacts. Registry access
requires Midnight organization access and GitHub Container Registry
authentication; the linked GitHub Release archives are the public download
path.

## 0.5.0 publication-manifest caveat

The `v0.5.0` source tag reports version
`0.4.0` in the root and workspace manifests,
while npm and the immutable GitHub Release artifacts identify all five packages
as `0.5.0`. The publication pipeline rewrites root/workspace versions before
packing without committing those rewrites. This matrix therefore uses npm
metadata and release artifacts as authority for the published `0.5.0` package
identities, and uses tagged source only for its release-tested toolchain and
runtime pins. Dependency similarity, `engines`, and language pragmas must not
be read as broader compatibility guarantees.

## Keeping the matrix current

The generator derives the 0.6.0 row's repository-owned pins from
the `.nvmrc` CI selector, the exact pnpm package-manager pin,
root/workspace manifests, CI, quality, and publish workflow constants, both
Compact language pragmas, and every runtime-owned
`midnightntwrk/proof-server` fallback. The exact Node release runtime is
retained separately as historical run evidence.
Generation fails when those inputs drift from the reviewed machine-readable
baseline. Add or
update a reviewed release baseline rather than silently carrying old evidence
forward.
