# Issue #443 npm Trusted Publishing migration retrospective

Date: 2026-09-11; finalization checkpoint updated 2026-09-14
Canonical trackers: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443) and [midnightntwrk/midnight-did#281](https://github.com/midnightntwrk/midnight-did/issues/281)

## Scope and outcome

The normal npmjs release path migrated from a long-lived npm token to npm
Trusted Publishing through GitHub Actions OIDC. Publication is now explicitly
on-demand: the workflow has no push trigger, so pushes and merges cannot start a
snapshot or any other publication job. Snapshot, RC, and final exact-ref/channel
rules remain strict, as do GHCR publication, npm/GHCR pull-back smoke tests,
Cosign signatures, SLSA provenance, immutable GitHub Releases, exact-ref gates,
and immutable-SHA checkout.

The obsolete token-based authority workflow and its `npm whoami` / `npm access`
checker were removed. Dependency installation, builds, packing, signing, and
GHCR publication now run outside the `npm-release` environment. A minimal
Trusted Publishing job sparsely checks out only the immutable publisher scripts
and Node version pin, downloads the package artifact by immutable ID, verifies
its producer archive digest, checksum-manifest digest, exact five-tarball
inventory, packed ownership metadata, and tarball checksums, then performs the
prerequisite check at the publication boundary. It installs no dependencies,
runs no build or package lifecycle scripts, rechecks npm CLI `>=11.5.1`
immediately before the first publish, and publishes the five prepacked tarballs
with `--provenance`, `--ignore-scripts`, the requested tag, and public access. No
npm publication secret is required.

## External npmjs setup

An npm administrator must configure a separate Trusted Publisher for every
package before the first manual publication:

| npm package                                   | Organization    | Repository     | Workflow      | Environment   |
| --------------------------------------------- | --------------- | -------------- | ------------- | ------------- |
| `@midnight-ntwrk/midnight-did-jubjub-schnorr` | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |
| `@midnight-ntwrk/midnight-did-contract`       | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |
| `@midnight-ntwrk/midnight-did-domain`         | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |
| `@midnight-ntwrk/midnight-did`                | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |
| `@midnight-ntwrk/midnight-did-api`            | `midnightntwrk` | `midnight-did` | `publish.yml` | `npm-release` |

Required configuration is: the protected GitHub environment has required
reviewers, self-review prevention, and exact `main`/`develop` deployment
branches. These are requirements, not verified facts: the external settings
were not inspected and remain unverified. An environment administrator must
attest the complete configuration before a publication is dispatched. No
additional secret is required. The existing organization secret may be retained
only if another
separately documented future npm-administration process needs it; this change
does not add that maintenance workflow or expose the secret to the normal path.

## What worked

- The workflow separates authority by job: the build has no write or OIDC
  permission; only `npm-release` combines its protected environment with
  `id-token: write`; signing uses OIDC without that environment; and GHCR uses
  `packages: write` without OIDC.
- The preflight checks observable repository/workflow/ref/environment/runner
  assumptions, OIDC request capability, npm version, canonical artifact
  manifests, and unauthenticated public package readability without requesting
  or decoding a JWT. The publisher independently rechecks the npm minimum at the
  mutation boundary.
- Provider subprocesses have bounded output/time, isolated auth-free npm
  configuration, and generic failure messages so hostile stdout/stderr is not
  copied into logs.
- The publisher completes all-five read-only inventory before its first publish,
  preserves dependency order, and verifies each successful payload/tag before
  the next dependent publish as well as in a final all-five pass. Registry
  subprocesses and tarball downloads are bounded.
- Adversarial fixtures exercise alternate tokens, credentials, OTP/client-cert
  configuration, registry redirects, `NODE_OPTIONS`, isolated child
  environments, command bounds, all three tags, absent/all-present/partial
  states, lost-response recovery, and first-package corruption/tag failures.

## Wallet-pattern comparison

The migration follows the established wallet-release pattern at the trust
boundary: GitHub's workflow identity is mapped directly in npmjs, the job has
`id-token: write`, a Trusted-Publishing-capable npm CLI performs `npm publish
--provenance`, and no npm token is supplied. The DID repository needs stricter
multi-package behavior than a single-package release: five immutable tarballs
must be inventoried before mutation, published in dependency order, and safely
recognized after a partial run. It therefore adds all-five payload/tag reads
and fails closed instead of using OIDC publication authority for npm
administration.

## What failed, drift, and follow-up

The superseded token-authority design depended on externally incorrect secret
placement and combined npm authorization checks with administration operations.
Repository policy, release documentation, and historical retrospectives had
drifted around that design; this change removes the obsolete workflow/checker,
updates the active policy, and labels the historical records as superseded.

The remaining process gap is external and intentionally fail-closed: repository
checks cannot inspect npmjs Trusted Publisher mappings or GitHub environment
review/deployment settings, and no non-mutating command can prove the complete
OIDC relationship. [Issue #281](https://github.com/midnightntwrk/midnight-did/issues/281)
tracks the protected publication boundary. Its required follow-up for this
change is administrator attestation of all five npm mappings and all
`npm-release` protections before the first manual publication. Issue #443
remains the release-readiness record and owns explicit authorization of any
later snapshot dispatch.

## Limits and residual risk

npmjs does not expose a cheap unauthenticated API that proves a Trusted
Publisher mapping. The preflight explicitly reports that npm-side mapping was
not verified and cannot be verified without an actual publish. Repository code
also cannot prove GitHub environment reviewers, self-review prevention, or
selected deployment branches. npm and GitHub environment administrator
attestations are therefore external gates.

Five package publishes are sequential and non-transactional. A bad mapping,
registry outage, or successful remote write followed by a lost response can
leave a partial version set. A same-SHA/version/tag retry accepts an existing
package only when both immutable payload and requested tag match, then publishes
only missing packages. Any wrong/missing tag, unexpected `latest`, payload
mismatch, or access problem requires separate npm administration; the normal
OIDC workflow never calls `npm access` or mutating `npm dist-tag` commands.

## Validation and hold

Finalization ran a frozen install and zero-vulnerability audit; the 49-test
Trusted Publishing, 60-test publisher, 24-test repository-policy, 133-test
release-context, and 16-test classifier suites; DID-surface,
workspace-manifest, package-content, formatting, shell-syntax, and diff checks;
`pnpm run verify`; docs validation/build/visual checks; and the full strict lane
with the bootstrapped proof-server image. All passed. The release-change
classifier is required to report `snapshotReleaseRelevant=true` for the exact
committed diff. A local preflight cannot pass outside the exact GitHub
Actions/OIDC context by design, and no test performs an npm publish or any
registry, GHCR, tag, workflow-dispatch, or release mutation. Validation ran
without npm/GitHub token variables, and no OIDC JWT or provider output was
requested, decoded, or retained.

Repository-policy and release-context tests prove the workflow is
`workflow_dispatch`-only and rejects push events, including pushes to
`refs/heads/develop`, before any publication boundary. Merging to `develop` is
therefore non-publishing. Before a later manual dispatch, npm and environment
administrators must attest all five npmjs mappings plus required `npm-release`
reviewers, self-review prevention, and exact `main`/`develop` deployment
branches, and the release owner must authorize that dispatch. No workflow was
dispatched and no npm, GHCR, tag, or release state was mutated during this
implementation.
