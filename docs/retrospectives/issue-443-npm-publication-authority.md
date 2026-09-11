# Issues #443 and #281 npm organization credential compatibility retrospective

Date: 2026-09-11
Canonical trackers: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443) and [midnightntwrk/midnight-did#281](https://github.com/midnightntwrk/midnight-did/issues/281)

## What prompted the work

Release readiness remained blocked because the intended npm identity and its
authority over all five publishable packages had not been established. The
release controls were then written for a new environment-scoped credential,
but SRE confirmed that `MIDNIGHTCI_NPMJS_TOKEN` is the permanent managed
organization credential. Compatibility therefore required adapting the code to
that external constraint without exposing the token or testing it through
publication. Public package reads and the presence of a secret name were not
authority evidence.

## What worked

The implementation separates read-only authority evidence from publication. A
small Node checker derives the five packages from the canonical workspace
catalog, requires npm identity `ntwrk-bot`, and accepts only `read-write`
package evidence from the exact npmjs registry. It runs only `npm whoami` and
`npm access list packages`, invokes npm without a shell, supplies an allowlisted
environment, isolates npm configuration and cache state in a permission-limited
temporary directory, and bounds process time and output.

Adversarial fake-provider tests made malformed and hostile conditions
deterministic without contacting npm. They cover identity mismatch or absence,
missing and read-only packages, duplicate decoded JSON keys, invalid UTF-8,
trailing and concatenated JSON, invalid value shapes, oversized output,
timeout and command failure, ambient Node/shell/npm configuration stripping,
exact argv/environment, temporary permissions and cleanup, redaction, and the
absence of mutating command selection.

The authority workflow rejects every manual ref except exact `refs/heads/main`,
and the publish workflow rejects dispatches outside the existing channel policy,
in checkout-free, secret-free jobs. Eligible jobs retain exact event/ref
conditions, runtime assertions, immutable dispatch-SHA checkout, pinned actions,
and `persist-credentials: false`. Publishing and authority verification both
name the `npm-release` environment, and only one step in each workflow receives
`NODE_AUTH_TOKEN`, sourced from `secrets.MIDNIGHTCI_NPMJS_TOKEN`. Snapshot
publication remains on `develop`, RC publication remains on `main` or `develop`,
and final publication remains on `main`.

## Friction and failures

GitHub environment and organization-secret controls are configuration, not
repository code. The `npm-release` environment has no environment-scoped
secret, and the organization credential does not appear in its secret list. It
is available only if the organization secret's selected-repository policy
includes `midnightntwrk/midnight-did`. Code and local tests cannot prove that
selection. More importantly, an environment cannot scope an organization
secret against a malicious branch workflow change that references it outside
an environment-gated job.

Under host load, the fake-provider timeout can expire before the fixture records
its invocation. The test therefore verifies cleanup at the controlled temporary
parent boundary whether or not the child reached fixture initialization, while
the production timeout remains bounded. macOS also injects
`__CF_USER_TEXT_ENCODING` into spawned processes; assertions distinguish that
platform-added value from inherited ambient configuration while checking the
explicit child-environment allowlist.

## Develop replay provenance

The reviewed credential-compatibility patch from draft main PR #475 was replayed
from exact source commit `31ae85ae2b489cca3d846cc2c16b83cf4b2c7d22`
onto `origin/develop` at `dc12902e0b96a9d860d802052a6d42f753dc32bd`
without merging the divergent branches. Conflict resolution retained the exact
merged #473 authority, release-context, publisher, provenance, and policy
controls while applying the complete credential compatibility semantics.

The replay also preserved develop-only W3C #468 evidence, pnpm 10.34.5,
`js-yaml` 4.3.2, the unconditional low-threshold audit, and all unrelated
package and lockfile state. The source retrospective's main-specific pnpm 10.34.4
history was not copied as current develop state. Frozen installation, the clean
audit, focused authority/policy/release-context/publisher suites, mandatory
verification, full strict validation, documentation validation/build/visual
checks, external-conformance guards, and the release-relevant classifier were
rerun for the new develop commit rather than inherited from PR #475.

## Decisions, limits, and follow-up

The `npm-release` GitHub environment remains the approval gate for the intended
publish and read-only authority jobs, with required reviewers, prevention of
self-review, and exact selected branch rules for `main` and `develop`, excluding
tags and wildcard branches. It is not the credential-scope boundary. SRE's
permanent `MIDNIGHTCI_NPMJS_TOKEN` organization secret is available only when
its selected-repository policy includes `midnightntwrk/midnight-did`, is absent
from the environment secret list, and can be referenced by a malicious branch
workflow change without the environment gate. That broader repository-level
availability is an externally accepted residual organization-secret trust
boundary.

The compatibility change deliberately retains exact-ref runtime checks,
immutable-SHA checkout, the authority workflow's `contents: read`, the
`npm-release` environment gate, read-only npm commands, strict evidence parsing,
credential redaction, and no authority-check mutation. Publish permissions and
provenance controls are unchanged. Runtime checks remain defense in depth and
are not substitutes for protected workflow review and organization-secret
policy administration.

The authority check is point-in-time read-only evidence. It does not prove that
a subsequent package PUT will be authorized, that authority cannot change, or
that five writes are transactional. The runner and npm executable remain
trusted; fake-npm containment tests do not claim to sandbox a malicious binary
that receives the credential. Publication, release creation, tags, GHCR, and
npm mutation remain outside this change and require their separate human gates.

The draft has a mandatory hold: do not merge it until PR #475 is merged to
`main`, the read-only authority workflow on `main` proves identity `ntwrk-bot`
and `read-write` authority for all five packages, and the release owner confirms
that this exact develop merge should trigger automatic snapshot publication.
No workflow dispatch, ready-for-review transition, merge, publication, access
change, dist-tag change, or other registry/release mutation is authorized.

Follow-up action: SRE must continue to manage the organization secret's
selected-repository policy and repository administrators must protect workflow
changes and retain the `npm-release` reviewers and exact branch rules. Any
configuration correction remains outside this repository change.
