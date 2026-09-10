# Issues #443 and #281 npm publication authority retrospective

Date: 2026-09-10
Canonical trackers: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443) and [midnightntwrk/midnight-did#281](https://github.com/midnightntwrk/midnight-did/issues/281)

## What prompted the work

Release readiness remained blocked because the intended npm identity and its
authority over all five publishable packages had not been established. The
publish workflow also consumed a repository-scoped credential without a
protected environment, and a branch-selectable manual dispatch could reach
checkout before rejecting an untrusted ref. Public package reads and the
presence of a secret name were not authority evidence.

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
the new environment-only `NPMJS_RELEASE_TOKEN`. Snapshot publication remains on
`develop`, RC publication remains on `main` or `develop`, and final publication
remains on `main`.

## Friction and failures

GitHub environment controls are configuration, not repository code. A workflow
can name `npm-release`, but it cannot prove that required reviewers, prevention
of self-review, exact selected deployment branches, and secret scope are set
correctly. Code and local tests therefore cannot complete the protection by
themselves.

Under host load, the fake-provider timeout can expire before the fixture records
its invocation. The test therefore verifies cleanup at the controlled temporary
parent boundary whether or not the child reached fixture initialization, while
the production timeout remains bounded. macOS also injects
`__CF_USER_TEXT_ENCODING` into spawned processes; assertions distinguish that
platform-added value from inherited ambient configuration while checking the
explicit child-environment allowlist.

## Decisions, limits, and follow-up

The actual trust boundary is the `npm-release` GitHub environment configured
with required reviewers, prevention of self-review, and exact selected branch
rules for `main` and `develop`, excluding tags and wildcard branches. Runtime
checks are defense in depth and are not substitutes. The pull request must stay
draft and held until an environment administrator attests those settings,
confirms `NPMJS_RELEASE_TOKEN` exists only at environment scope, and confirms
both `MIDNIGHTCI_NPMJS_TOKEN` and `NPMJS_RELEASE_TOKEN` are absent from
repository and organization secret scope.

The authority check is point-in-time read-only evidence. It does not prove that
a subsequent package PUT will be authorized, that authority cannot change, or
that five writes are transactional. The runner and npm executable remain
trusted; fake-npm containment tests do not claim to sandbox a malicious binary
that receives the credential. Publication, release creation, tags, GHCR, and
npm mutation remain outside this change and require their separate human gates.

Follow-up action: the environment administrator must record the configuration
attestation on the draft pull request before readiness or merge can be
considered. If any setting or secret scope differs, keep the pull request held
and correct the environment outside repository code.
