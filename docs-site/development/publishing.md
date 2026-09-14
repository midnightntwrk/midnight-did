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

npmjs publication uses npm Trusted Publishing. Build, dependency installation,
packing, signing, GHCR publication, and GitHub Release work run outside the
`npm-release` environment. Only the minimal `npm-release` job has both that
environment and `id-token: write`; it sparsely checks out only immutable
publisher scripts plus the Node version pin, downloads the package artifact by
immutable ID, verifies the producer archive digest and exact checksummed
inventory, rechecks npm CLI `>=11.5.1` at the mutation boundary, and publishes
the already packed tarballs with lifecycle scripts disabled. No npm publication
secret is required. `GITHUB_TOKEN` remains
limited to repository-scoped operations; `packages: write` is held by the
separate GHCR job and is not available to the npm publisher.

Before this code is merged, npm administrators must add a Trusted Publisher to
each package:

| npm package                                   | Organization    | Repository     | Workflow      | Environment   |
| --------------------------------------------- | --------------- | -------------- | ------------- | ------------- |
| `@midnight-ntwrk/midnight-did-jubjub-schnorr` | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |
| `@midnight-ntwrk/midnight-did-contract`       | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |
| `@midnight-ntwrk/midnight-did-domain`         | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |
| `@midnight-ntwrk/midnight-did`                | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |
| `@midnight-ntwrk/midnight-did-api`            | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |

Repository administrators must configure required `npm-release` reviewers with
self-review prevention and exact selected deployment branches `main` and
`develop`, excluding tags, wildcard branches, and all other branches. Repository
code cannot inspect or prove those external settings; an environment
administrator must attest them. No additional secret is required. After
confirming no other workflow depends on the old organization credential, it can
be removed from this normal release path.

The environment deployment-branch restrictions and required reviewers are the
actual protection boundary. Workflow event/ref conditions, immutable-SHA
checkout, runtime assertions, and secret step scoping are defense in depth, not
substitutes for those GitHub settings. An environment administrator must attest
the complete configuration before this change is marked ready or merged.

Publication channels:

| Channel  | Trigger                  | Branches          | Version shape                | npm tag    | ZK artifacts                               |
| -------- | ------------------------ | ----------------- | ---------------------------- | ---------- | ------------------------------------------ |
| Snapshot | Push or manual dispatch  | `develop`         | `x.y.z-snapshot.<run>.<sha>` | `snapshot` | Workflow artifact and GHCR OCI artifact    |
| RC       | Manual workflow dispatch | `main`, `develop` | `x.y.z-rc{index}`            | `rc`       | GitHub Release asset and GHCR OCI artifact |
| Release  | Manual workflow dispatch | `main` only       | `x.y.z`                      | `latest`   | GitHub Release asset and GHCR OCI artifact |

Every manual dispatch requires `version` to be exactly one stable SemVer base,
such as `0.6.0`. Do not supply a leading `v`, prerelease/build suffix, whitespace,
or control characters. Snapshot and RC suffixes are generated by the workflow
from the selected channel, RC index, run number, and commit SHA. The process
environment itself cannot represent NUL: the operating-system process boundary
rejects an environment variable containing NUL before the resolver can run. The
same stable-SemVer rule rejects every representable control character before any
GitHub output record is written.

The workflow revalidates the event, exact full source ref, branch ref type,
channel, base version, resolved version, and RC index immediately before signing
or publishing. Snapshots require `refs/heads/develop`; RCs allow
`refs/heads/main` or `refs/heads/develop`; final releases require
`refs/heads/main`. A dispatch from another branch or a tag, even one named
`main` or `develop`, fails in a checkout-free, secret-free job before environment
approval or repository checkout. An eligible dispatch then checks out the
immutable dispatch SHA rather than a later-moving branch head. These checks
consume GitHub's full ref directly rather than trusting short ref names. A
release fix made directly on `main` must also be synchronized back to `develop`
before any later `develop` snapshot or RC.

Automated snapshot publication is intentionally gated. A push to `main` or
`develop` publishes a snapshot only when the diff contains Compact, TypeScript,
JavaScript, or shell-script changes under package/runtime paths. Markdown,
`docs-site`, W3C spec pages, GitHub workflow/configuration changes, Renovate or
Dependabot configuration, and manifest/lockfile-only dependency updates do not
publish snapshot packages or ZK artifacts. Manual snapshots from `develop`, RCs
from `main` or `develop`, and final releases from `main` are not gated by this
classifier.

## Trusted Publishing prerequisite check

After the unprivileged build job has uploaded the package artifact, the separate
`npm-release` job downloads it by immutable artifact ID and verifies the
producer's archive digest, checksum-manifest digest, exact five-tarball
inventory, packed manifest ownership metadata, and all tarball checksums. It
then runs a fail-closed prerequisite check directly at the publication boundary.
It installs no repository dependencies and runs no package, Compact, or
lifecycle build. The checker verifies the
exact repository, `publish.yml` workflow ref, allowed branch ref, GitHub-hosted
runner, `npm-release` environment expectation, and presence of both GitHub OIDC
request-capability variables. It does not request, decode, or log an OIDC JWT or
any environment secret. Ambient `NODE_AUTH_TOKEN`, `NPM_TOKEN`, `NPM_ID_TOKEN`,
npm credential/client-certificate settings, registry redirects, and
`NODE_OPTIONS` runtime injection are rejected before npm is invoked.

The checker requires npm CLI `>=11.5.1`, derives the canonical five-package
inventory from `did-workspace-catalog.mjs`, and performs bounded unauthenticated
public metadata reads. Artifact inventory validation separately checks every
packed package's npmjs registry, public access, package name, version, and
repository ownership metadata. The publisher rechecks the npm minimum
immediately before the first mutation. npm runs without a
shell, with isolated auth-free configuration, bounded output/time, and raw
provider output suppressed on failure. The publisher repeats the input guard
immediately before each mutation and launches npm with a narrowly allowlisted
environment containing only isolated npm paths plus required GitHub
OIDC/provenance context.

A successful prerequisite check proves only observable repository, workflow,
runner, CLI, manifest, and public-readability prerequisites. npm exposes no
cheap unauthenticated API for this relationship, so the npm-side Trusted
Publisher mapping is **not verified and cannot be verified without an actual
publish**. Five sequential publishes also remain non-transactional.

## Distribution Use Cases

Publication supports these consumer paths:

| Use case                      | Source                                      | Intended consumer                                                                 |
| ----------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| Snapshot validation           | npmjs packages plus GHCR OCI artifact       | CI, release engineers, downstream repository smoke tests                          |
| RC/release validation         | npmjs packages plus GitHub Release asset    | Release engineers and users who want stable HTTPS assets                          |
| Public npm consumption        | npmjs packages plus GitHub Release asset    | Public users who install packages from `registry.npmjs.org`                       |
| Server-side runtime bootstrap | GHCR OCI artifact or unpacked release asset | Node services, DID resolver/manager services, and CI jobs that cache proving keys |

The publish workflow rebuilds the packages and managed Compact artifacts,
checks package contents, creates a ZK artifact bundle, validates the bundle,
publishes packages to npmjs, smoke-tests the exact package version from npmjs,
pushes the bundle to GHCR, pulls it back, validates it, and fetches every
circuit through `FetchZkConfigProvider` over runtime HTTP. RC and release runs
also upload the bundle to a GitHub Release and download the asset back for the
same validation.

Concrete release-train examples in this page are validated against the root
`package.json` version so package versions, package examples, and artifact names
move together.

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

const locations = createMidnightDidZkArtifactLocations(
  MIDNIGHT_DID_API_VERSION,
);

console.log(locations.ghcr.reference);
console.log(locations.githubRelease?.archiveUrl);
```

For snapshot versions, `githubRelease` is `null` because snapshots are published
as workflow artifacts and GHCR OCI artifacts. For RC and final release versions,
`githubRelease` contains the expected release tag and asset URLs.

Exact npm package versions are immutable. The publication flow is designed for
safe reruns after partial failure:

- npm skips an existing version only after verifying its immutable payload and
  confirming that it already owns the requested dist-tag;
- GHCR preserves an existing version tag, pulls it back, and verifies the bundle
  payload and manifest instead of overwriting it;
- GitHub Release assets are immutable: existing payloads are verified, missing
  assets are uploaded, and existing signatures are preserved;
- SLSA subjects are calculated from the assets actually present in the GitHub
  Release, so reruns cannot attest newly generated files that were not uploaded;
- ZK archives use a reproducible timestamp, ordering, ownership, and gzip header
  so equivalent builds produce the same payload.

A remote artifact with a different payload fails closed rather than being
replaced. RC and final releases receive their SLSA provenance before the
immutable GitHub Release is created, and all release assets are supplied in the
initial creation request. This keeps a partial publication recoverable without
making an immutable release mutable.

### npm preflight, partial failure, and retry

Before the first publish, the npm publisher:

1. requires the exact `https://registry.npmjs.org/` registry and rejects every
   ambient npm token, credential, OTP, client-certificate input, registry
   redirect, and `NODE_OPTIONS` injection before any npm invocation;
2. derives the dependency-ordered workspace inventory from
   `did-workspace-catalog.mjs --publish-workspaces` and requires exactly the five
   canonical pre-packed tarballs;
3. verifies every packed manifest name/version and records each local tarball
   integrity; and
4. completes all-five public package-name, exact-version, immutable-payload, and
   dist-tag reads.

An exact-version E404 is considered absent only after package-level public
readability succeeds. Missing, extra, malformed, ambiguous, or mismatched
evidence fails closed. Before any missing package is published, every existing
exact version must already match both the packed payload and requested tag. For
non-`latest` channels, the target version must not own `latest`.

Missing packages are published in catalog dependency order with the npm CLI:

```bash
npm publish --provenance --ignore-scripts --tag "${NPM_TAG}" --access public \
  --registry "https://registry.npmjs.org/" "<prepacked-tarball>"
```

`npm publish --tag` creates the initial requested tag. The normal Trusted
Publishing workflow never invokes `npm access` or mutating `npm dist-tag`
commands. Existing wrong/missing tags or access requiring repair therefore fail
closed; an npm administrator must repair them through a separately authorized,
documented maintenance process outside this normal OIDC workflow. No such
maintenance workflow is currently provided.

Every npm registry command has a strict output and wall-clock bound. Fallback
tarball identity downloads have connect/overall timeouts and a 100 MiB size
limit. After every successful publish, payload and requested-tag read-back must
succeed before the next dependent package can publish; a final all-five read-back
is retained. This reduces partial-publication risk but cannot make five writes
transactional. If a run fails:

- Record the workflow SHA, exact version, channel/tag, first failing package, and
  final publisher evidence. Do not replace a version merely to hide a partial
  snapshot.
- Retry the same workflow SHA/version/tag. A publish that succeeded despite a
  lost response is recognized only when its immutable payload and requested tag
  both match; only missing packages continue in dependency order.
- Stop when any existing payload/tag differs or any read is ambiguous. Do not
  overwrite, unpublish, change access, or mutate tags in automated recovery.
- Treat npm publication as complete only after final all-five public metadata,
  payload, and tag read-back plus the public npmjs smoke test succeeds. Continue
  using the existing GHCR/GitHub Release pull-back checks for ZK artifacts.

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

export VERSION="0.6.0-snapshot.local"
export ZK_ARCHIVE="artifacts/zk/midnight-did-zk-artifacts-${VERSION}.tar.gz"

pnpm run zk-artifacts:bundle -- --version "${VERSION}"
pnpm run zk-artifacts:check -- "${ZK_ARCHIVE}"
pnpm run published-artifacts:smoke -- --skip-npm --zk-archive "${ZK_ARCHIVE}"
```

## Testing Publication

PR CI validates package contents, ZK bundle structure, package imports, docs, and
the normal core/API lanes. It does not publish packages or push GHCR artifacts.

After this branch lands on `develop`, a code-impacting push to `develop` should
trigger the snapshot publication path. Use the version printed by the workflow
summary:

```bash
export VERSION="0.6.0-snapshot.<run>.<sha>"
export GH_TOKEN="<github-token-with-repo-read>"
export OCI_REF="ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${VERSION}"

pnpm run published-artifacts:smoke -- \
  --version "${VERSION}" \
  --registry https://registry.npmjs.org \
  --oci-ref "${OCI_REF}"
```

For an RC or final release, smoke-test both public distribution paths:

```bash
export VERSION="0.6.0-rc1"
export GH_TOKEN="<github-token-with-repo-read>"
export OCI_REF="ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${VERSION}"

pnpm run published-artifacts:smoke -- \
  --version "${VERSION}" \
  --oci-ref "${OCI_REF}"

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
export VERSION="0.6.0-rc1"
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
