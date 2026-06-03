# Publishing

The repository publishes a VitePress site from `docs-site/`.

## Local Build

```bash
pnpm install
pnpm run docs:build
```

Preview the built site:

```bash
pnpm run docs:preview
```

Run the same docs lane used by CI:

```bash
./run.sh docs
```

## What The Default Build Does

The default docs build is intentionally small:

1. synchronize the published specification pages from `w3c-spec/`
2. build VitePress static output into `docs-site/.vitepress/dist/`

It does not compile Compact contracts, rebuild managed artifacts, run TypeDoc,
or start Docker-backed tests.

## Optional API Reference

Generated TypeDoc pages remain available as a local maintenance tool:

```bash
pnpm run docs:api
```

This is not part of the default Pages build because it compiles package outputs
and is too heavy for docs-only CI.

## Pages Deployment

See [GitHub Pages](/guide/github-pages) for the repository setting and workflow
behavior.

## Package And ZK Artifact Publication

The `Publish Packages and ZK Artifacts` workflow is the prototype release path
for the five DID packages:

- `@midnight-ntwrk/midnight-did-jubjub-schnorr`
- `@midnight-ntwrk/midnight-did-contract`
- `@midnight-ntwrk/midnight-did-domain`
- `@midnight-ntwrk/midnight-did`
- `@midnight-ntwrk/midnight-did-api`

The root workspace and `docs-site` remain private. The package workspaces are
publishable and use GitHub Packages with the `https://npm.pkg.github.com`
registry.

Publication channels:

| Channel | Trigger | Branches | Version shape | npm tag | ZK artifacts |
| --- | --- | --- | --- | --- | --- |
| Snapshot | Push | `main`, `develop` | `x.y.z-snapshot.<run>.<sha>` | `snapshot` | Workflow artifact and GHCR OCI artifact |
| RC | Manual workflow dispatch | `main`, `develop` | `x.y.z-rc{index}` | `rc` | GitHub Release asset and GHCR OCI artifact |
| Release | Manual workflow dispatch | `main` only | `x.y.z` | `latest` | GitHub Release asset and GHCR OCI artifact |

Each run rebuilds the packages and managed Compact artifacts, checks package
contents, creates a ZK artifact bundle, validates the bundle, publishes packages,
smoke-tests the exact package version from GitHub Packages, pushes the bundle to
GHCR, pulls it back, validates it, and fetches every circuit through
`FetchZkConfigProvider`. RC and release runs also upload the bundle to a GitHub
Release and download the asset back for the same validation.

## ORAS and GHCR artifacts

The workflow installs ORAS before the GHCR step because GHCR stores the ZK bundle
as a generic OCI artifact. `npm publish` handles TypeScript packages, and
`gh release upload` handles release assets, but neither pushes arbitrary
provider-key archives to an OCI registry. ORAS provides the registry protocol
client for `oras push` and `oras pull`.

The publish workflow downloads the configured `ORAS_VERSION`, verifies the ORAS
release checksum, installs the `oras` binary, pushes the ZK archive and manifest
to `ghcr.io/<owner>/midnight-did-zk-artifacts:<version>`, pulls it back, and
then runs bundle validation plus the `FetchZkConfigProvider` smoke test.

Local developers need ORAS only when manually testing the GHCR artifact path.
Install it with Homebrew or the upstream release instructions:

```bash
brew install oras
oras version
```

The local bundle and GitHub Release asset checks do not require ORAS.

Exact npm package versions are immutable. If a workflow is rerun after a partial
publish, the npm publication step skips packages whose exact version already
exists and continues with missing packages plus artifact verification.

The ZK bundle preserves the provider layout used by Midnight JS:

```text
manifest.json
keys/<circuit>.prover
keys/<circuit>.verifier
zkir/<circuit>.bzkir
```

After unpacking the bundle, the directory can be used as the root passed to
`NodeZkConfigProvider`. A future archive-backed provider can download a GitHub
Release asset or GHCR OCI artifact once, unpack it into a cache, and delegate to
the same layout used by `FetchZkConfigProvider` or `NodeZkConfigProvider`.

Local checks:

```bash
pnpm run build:all
pnpm run packages:check-contents
pnpm run zk-artifacts:bundle -- --version 0.4.0-snapshot.local
pnpm run zk-artifacts:check -- artifacts/zk/midnight-did-zk-artifacts-0.4.0-snapshot.local.tar.gz
pnpm run published-artifacts:smoke -- --skip-npm --zk-archive artifacts/zk/midnight-did-zk-artifacts-0.4.0-snapshot.local.tar.gz
```
