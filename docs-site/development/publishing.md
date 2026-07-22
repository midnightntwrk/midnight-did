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

The synchronized specification pages are generated build outputs and are not
committed. The build does not compile Compact contracts, rebuild managed
artifacts, run TypeDoc, or start Docker-backed tests.

## Optional API Reference

Generated TypeDoc pages remain available as a local maintenance tool:

```bash
pnpm run docs:api
```

This is not part of the default Pages build because it compiles package outputs
and is too heavy for docs-only CI.

## Pages Deployment

See [GitHub Pages](/development/github-pages) for the repository setting and workflow
behavior.

## Package And ZK Artifact Publication

The `Publish npmjs Packages and ZK Artifacts` workflow publishes the five DID
packages to npmjs and publishes the matching ZK artifact bundle to GHCR and, for
RC/final releases, GitHub Release assets.

The workflow publishes these package workspaces in dependency order:

- `@midnight-ntwrk/midnight-did-jubjub-schnorr`
- `@midnight-ntwrk/midnight-did-contract`
- `@midnight-ntwrk/midnight-did-domain`
- `@midnight-ntwrk/midnight-did`
- `@midnight-ntwrk/midnight-did-api`

The root workspace and `docs-site` remain private. The package workspaces are
publishable and keep `publishConfig.registry` pointed at
`https://registry.npmjs.org/` with `publishConfig.access: "public"`.

The workflow uses `MIDNIGHTCI_NPMJS_TOKEN` for the npmjs publish and post-publish
package smoke steps. `GITHUB_TOKEN` is used for repository-scoped operations such
as creating/updating GitHub Release assets and for publishing the GHCR ZK
artifact. The workflow keeps `packages: write` only because GHCR generic OCI
artifact publication requires it; npmjs publication is authenticated by the npm
token.

Publication channels:

| Channel | Trigger | Branches | Version shape | npm tag | ZK artifacts |
| --- | --- | --- | --- | --- | --- |
| Snapshot | Push or manual dispatch | `develop` | `x.y.z-snapshot.<run>.<sha>` | `snapshot` | Workflow artifact and GHCR OCI artifact |
| RC | Manual workflow dispatch | `main`, `develop` | `x.y.z-rc{index}` | `rc` | GitHub Release asset and GHCR OCI artifact |
| Release | Manual workflow dispatch | `main` only | `x.y.z` | `latest` | GitHub Release asset and GHCR OCI artifact |

Automated snapshot publication is intentionally gated. A push to `main` or
`develop` publishes a snapshot only when the diff contains Compact, TypeScript,
JavaScript, or shell-script changes under package/runtime paths. Markdown,
`docs-site`, W3C spec pages, GitHub workflow/configuration changes, Renovate or
Dependabot configuration, and manifest/lockfile-only dependency updates do not
publish snapshot packages or ZK artifacts. Manual RC and release dispatches are
not gated by this classifier.

## Distribution Use Cases

Publication supports these consumer paths:

| Use case | Source | Intended consumer |
| --- | --- | --- |
| Snapshot validation | npmjs packages plus GHCR OCI artifact | CI, release engineers, downstream repository smoke tests |
| RC/release validation | npmjs packages plus GitHub Release asset | Release engineers and users who want stable HTTPS assets |
| Public npm consumption | npmjs packages plus GitHub Release asset | Public users who install packages from `registry.npmjs.org` |
| Server-side runtime bootstrap | GHCR OCI artifact or unpacked release asset | Node services, DID resolver/manager services, and CI jobs that cache proving keys |

The publish workflow rebuilds the packages and managed Compact artifacts,
checks package contents, creates a ZK artifact bundle, validates the bundle,
publishes packages to npmjs, smoke-tests the exact package version from npmjs,
pushes the bundle to GHCR, pulls it back, validates it, and fetches every
circuit through `FetchZkConfigProvider` over runtime HTTP. RC and release runs
also upload the bundle to a GitHub Release and download the asset back for the
same validation.

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
The Nix development shell includes ORAS. Outside the Nix shell, install it with
Homebrew or the upstream release instructions:

```bash
nix develop
oras version

brew install oras
oras version
```

The local bundle and GitHub Release asset checks do not require ORAS.

## Package Artifact Metadata

`@midnight-ntwrk/midnight-did-api` embeds release-artifact metadata for the same
version as the published package. Use it when a service or downstream test needs
to derive the matching ZK artifact location instead of hard-coding URLs:

```ts
import {
  MIDNIGHT_DID_API_VERSION,
  createMidnightDidZkArtifactLocations,
} from "@midnight-ntwrk/midnight-did-api";

const locations = createMidnightDidZkArtifactLocations(MIDNIGHT_DID_API_VERSION);

console.log(locations.ghcr.reference);
console.log(locations.githubRelease?.archiveUrl);
```

For snapshot versions, `githubRelease` is `null` because snapshots are published
as workflow artifacts and GHCR OCI artifacts. For RC and final release versions,
`githubRelease` contains the expected release tag and asset URLs.

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

## Local Checks

```bash
pnpm run build:all
pnpm run packages:check-contents
pnpm run zk-artifacts:bundle -- --version 0.4.0-snapshot.local
pnpm run zk-artifacts:check -- artifacts/zk/midnight-did-zk-artifacts-0.4.0-snapshot.local.tar.gz
pnpm run published-artifacts:smoke -- --skip-npm --zk-archive artifacts/zk/midnight-did-zk-artifacts-0.4.0-snapshot.local.tar.gz
```

## Testing Publication

PR CI validates package contents, ZK bundle structure, package imports, docs, and
the normal core/API lanes. It does not publish packages or push GHCR artifacts.

After this branch lands on `develop`, a code-impacting push to `develop` should
trigger the snapshot publication path. Use the version printed by the workflow
summary:

```bash
export VERSION="0.4.0-snapshot.<run>.<sha>"
export GH_TOKEN="<github-token-with-repo-read>"

pnpm run published-artifacts:smoke -- \
  --version "${VERSION}" \
  --registry https://registry.npmjs.org \
  --oci-ref "ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${VERSION}"
```

For an RC or final release, smoke-test both public distribution paths:

```bash
export VERSION="0.4.0-rc1"
export GH_TOKEN="<github-token-with-repo-read>"

pnpm run published-artifacts:smoke -- \
  --version "${VERSION}" \
  --oci-ref "ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${VERSION}"

pnpm run published-artifacts:smoke -- \
  --version "${VERSION}" \
  --github-release-tag "v${VERSION}"
```

The smoke test installs the exact package version from the selected registry,
imports all package entry points, verifies the API package's embedded artifact
metadata matches the requested version, downloads or pulls the ZK bundle,
validates the bundle manifest, and fetches every circuit through
`FetchZkConfigProvider` over runtime HTTP.

## Standalone Release Smoke

Use the `Published Release Standalone Smoke` workflow after publishing an RC or
release when you need end-to-end confirmation that the published packages and
GitHub Release ZK assets work together. The workflow installs the exact
`@midnight-ntwrk/*` package version from npmjs, downloads the matching
release archive, unpacks it, boots the standalone Midnight environment, deploys
a DID contract, adds a verification method, adds an authentication relation,
adds and updates a service, and resolves the updated DID document.

Local equivalent:

```bash
export VERSION="0.4.0-rc1"
export GH_TOKEN="<github-token-with-repo-read>"

pnpm run published-standalone:smoke -- \
  --version "${VERSION}" \
  --github-release-tag "v${VERSION}"
```

`GH_TOKEN` must be able to read the repository release asset. The script starts
Docker Compose from `packages/api/standalone.yml` by default. If a standalone
environment is already running, pass `--use-existing-standalone` and set
`INDEXER_URL`, `INDEXER_WS_URL`, `NODE_RPC_URL`, and `PROOF_SERVER_URL` as
needed.

Published API packages can use unpacked release keys by setting
`MIDNIGHT_DID_ZK_CONFIG_PATH` to the bundle root containing `manifest.json`,
`keys/`, and `zkir/`. The API also prefers the installed contract package's
`dist/managed/did` directory when bundled managed artifacts are available.
