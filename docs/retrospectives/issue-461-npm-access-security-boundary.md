# Issue #461 npm access and deployment-error boundary retrospective

Date: 2026-09-02
Canonical tracker: [midnightntwrk/midnight-did#461](https://github.com/midnightntwrk/midnight-did/issues/461)

## What worked

The implementation began with realistic fake-npm output and failed against the
old bare-string parser before the publisher changed. The fixture now emits npm
11's exact package-keyed object only when the complete ordered access-get
command matches the requested package, JSON/log-level flags, and configured
registry. Table-driven negative cases cover malformed JSON, bare strings,
arrays, null, missing or mismatched keys,
multiple keys, object-valued statuses, empty values, `restricted`, and unknown
statuses. Separate zero-byte and concatenated-document regressions prove that
empty producer output and multiple JSON documents fail under `set -e`. Mutation
assertions make the all-five read-only boundary observable, including a private
first package followed by invalid fifth-package evidence.

Keeping package identity as an explicit parser input made the registry evidence
strict in the repository-supported Node runtime without adding a dev-shell
command dependency. Using npm's actual `public`/`private` vocabulary made
private-to-public reconciliation reachable while preserving the existing
post-write read-back, package order,
immutable payload checks, and dist-tag sequencing. Five explicit read-only npm
11 probes returned one exact package-keyed `public` entry each. npmjs was
contacted only by those status reads; the publisher was not invoked against
npmjs. The focused publisher, API, docs, syntax, formatting, and diff checks and
the mandatory repository verification gate all passed.

The API security review identified that raw post-finality `cause` preservation
and provider-graph non-retention cannot both hold. The implementation retained
the existing boundary: any pre-target rejection keeps its exact identity, while
the post-finality typed error carries only controlled reconciliation fields.
Focused tests now exercise primitive and adversarial pre-finality values and
adversarial non-retention at every controlled setup stage.

## Read-only real-registry evidence

At `2026-09-02T16:59:55Z`, the repository's `nix develop` environment supplied
Node.js `v24.18.1`, npm `11.16.0`, and pnpm `10.34.4`. Each canonical inventory
package was probed separately with the exact command form
`npm access get status <package> --json --loglevel=error --registry https://registry.npmjs.org/`.
Every command exited zero, and each response was validated as a one-entry JSON
object whose sole key exactly matched the requested package and whose value was
in the supported `public`/`private` vocabulary:

- `@midnight-ntwrk/midnight-did-jubjub-schnorr`: `public`
- `@midnight-ntwrk/midnight-did-contract`: `public`
- `@midnight-ntwrk/midnight-did-domain`: `public`
- `@midnight-ntwrk/midnight-did`: `public`
- `@midnight-ntwrk/midnight-did-api`: `public`

These were real npmjs reads, not fake-registry tests and not a claim that npm
was uncontacted. No publisher, `npm access set`, publish, dist-tag, or other
registry mutation command was run. No credential or raw npm configuration
output is retained in this record.

## Failures and friction

The first worktree diagnostic could not find project-local pinned Pi packages
because this dedicated worktree had not been provisioned with `.pi/npm`; the
installed package from the isolated primary checkout had to supply read-only
workflow tooling. The first focused API test also failed before test discovery
because workspace dependency outputs were absent. Building the documented API
prerequisites resolved that environment failure without changing tracked source.
ShellCheck was not available in the environment, so focused shell validation
used Bash's parser (`bash -n`) rather than static shell analysis.

The original issue coupled a release-blocking npm parser defect with a request
to preserve raw provider errors. Security review showed that a raw `cause`, even
when non-enumerable and absent from the message, retains hidden properties,
symbols, transactions, private state, and signing keys. Normalizing that
criterion before coding prevented an observability change from silently
weakening the established secret non-retention contract.

## Process gaps

Release review had relied on a fake npm response shape that did not match the
npm 11 CLI contract. Registry-facing fixtures need to model the provider's
primary structured output and reject permissive compatibility shapes unless a
real supported version requires them. Release evidence also needs to distinguish
read-only registry probes from invoking a mutation-capable publisher; calling
the latter a dry run obscures the risk boundary.

The dev-loop bootstrap assumes pinned packages have been provisioned in every
worktree, but a clean worktree can contain only `.pi/settings.json`. Worktree
provisioning or diagnostics should provide a deterministic, documented fallback
without depending on another checkout's installed files.

## Tracked follow-up actions

- Issue #461 tracks the five explicit read-only npm registry probes, focused
  publisher/API/docs validation, mandatory repository gates, and exact
  `origin/main..HEAD` review before PR handoff.
- Issue #461's Definition of Done tracks exact-head review dispatch and feedback
  audit after a draft PR exists; these remain external lifecycle steps rather
  than claims made by local tests.
- Any proposal to expose post-finality provider diagnostics must be a separately
  approved security/API-risk change with an explicit redaction allowlist; it
  must not reintroduce raw `Error.cause` retention under issue #461.

## Residual risk

Read-only status evidence cannot prove a later package PUT will be authorized,
and five sequential access/publication operations are not transactional. A
successful access mutation can therefore precede a later publication failure;
the existing same-version immutable recovery path remains the mitigation.
Provider CLI output may evolve again, so exact-shape failures should prompt an
explicit compatibility decision rather than a permissive parser fallback. The
integration report skipped sibling VC reference checks because that checkout was
not present; this issue does not alter the cross-repository VC surface.
