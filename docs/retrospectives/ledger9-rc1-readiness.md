# Ledger9 RC1 readiness preparation

Date: 2026-11-13
Related implementation: [issue #520](https://github.com/midnightntwrk/midnight-did/issues/520), [PR #521](https://github.com/midnightntwrk/midnight-did/pull/521), and [promotion PR #523](https://github.com/midnightntwrk/midnight-did/pull/523).
Delivery artifact: the draft `codex/prepare-1.0.0-rc1` preparation PR targeting `develop`.

## Scope and successful preparation

The source was frozen at protected `develop` commit
`5953d1f9e28e6849828016ca2faccf8453a524f6`. The release-note extractor rejected
base version `1.0.0` because the Ledger9 notes existed only under Unreleased.
The preparation creates the supported `1.0.0` section, retains Unreleased and
all migration notes, and states the replacement-deployment, indexed-time
readiness, lifecycle-snapshot and coordinated package/ZK requirements. Source
manifest version `0.6.0` remains unchanged; the existing version-preparation
script owns candidate and publication version rewrites.

Frozen installation and `pnpm run verify` passed in the repository Nix
cohort: Node 24.18.1, pnpm 10.34.5 and Compact 0.36.0, preserving Turbo's
Compact environment selectors. Package test/coverage counts were Jubjub 9,
contract 65, domain 190, DID 163 and API 364. Repeated lanes do not increase
unique coverage. All eight protected API-module thresholds passed. Docs build,
visual checks, validation and 35 focused docs/runner regression tests passed.

## Published-link failure and bounded repair

Original Published Docs Links run 43464110970 attempt 1 had no completed JSON
and terminated with Node's unsettled top-level await warning and exit 13.
Logs, workflow identity and the zero-byte artifact were preserved before tests.
A single authorized hosted diagnostic rerun, attempt 2 at the same source,
reproduced that symptom. Neither run proved broken URLs.

The first local experiment completed normally with exit 1: 140 results,
138 OK and two HTTP 404s. The compatibility renderer linked a tag through
GitHub's commit endpoint; its reviewed baseline now records the tag's actual
commit SHA. A private GHCR UI hyperlink was not a public download path; the
exact GHCR coordinate and access warning remain, alongside the public GitHub
Release download path. No URL exclusions were added.

The final local experiment injected early delivery of one timer into the exact
Linkinator 8.0.1 queue implementation. The original process exited 13 with one
queued task, zero active tasks and no execution. An otherwise identical process
with a referenced handle completed the task once and exited 0. The queue's
unreferenced rescue interval explains this matching failure mechanism, but the
precise hosted URL/timing trigger remains unproven.

The runner retains a referenced ten-minute deadline while importing the same
pinned checker CLI. This allows the rescue interval to service stranded work;
it does not change the checker, runtime version, retries, URL rules, result
bytes or exit status. Genuine hangs exit 124. The hosted job has a 15-minute
bound and rejects incomplete JSON explicitly. Tests reproduce exit 13 without
the runner and cover completion, preserved arguments/broken results/exit 1,
exceptions, deadline failure and missing executables. A first CLI-help smoke
exposed pnpm's shell shim; resolution now uses the package manifest's JavaScript
bin, with a realistic shim fixture. The corrected pinned CLI-help smoke passed.
The diagnostics budget was two local experiments and one hosted rerun; none
remain. Current merged-head deployment/link validation is still required.

## Physical candidate evidence and honest limits

A separate disposable build tree matched the preparation source tree before
version preparation. Only the normal version script rewrote its manifests and
embedded API version to `1.0.0-rc1`. Builds, publishable-content inspection,
actual five-tarball inventory and a production 12-circuit ZK archive check
passed. These are local candidate artifacts, not registry publication evidence.

An isolated consumer installed all five actual tarballs, including transitive
DID dependencies pinned to that same inventory. Nine entry points resolved
physically inside the consumer, not through workspace links. Source-cohort
overrides and the exact reviewed trust/age policy were retained; the results do
not establish arbitrary downstream lockfile compatibility. SDK5 default-integrity
providers fetched every circuit over runtime HTTP and injected fetch, matching
all 72 payload hashes across the two modes. The installed public unpacker,
version-mismatch rejection and public download API passed with the real candidate
archive/checksum/manifest supplied through injected fetch. Eight missing/empty
lifecycle snapshot cases across two installed public wallet entry points rejected
before configuration/startup. Installed API type assertions enforce required
indexed-time readiness and transaction lifecycle data.

Unrestricted strict TypeScript consumer checking failed with 32 errors in
upstream SDK, Polkadot and supporting declarations. The same consumer and API
assertions passed with `skipLibCheck`; full dependency-declaration compatibility
is not claimed. No dependency changes or new broad overrides were introduced.
The first scratch install omitted `packageManager`, causing Corepack to select
an incompatible native pnpm version; the isolated consumer now pins source
pnpm 10.34.5. No user/global package-manager configuration changed.

Full `./run.sh --strict` passed, including all 31 live integration tests with
zero live skips. The official 9.0.1 proof-server image was warmed into an owned
local bootstrap image with a 600-second allowance, completing in 14 seconds;
node and indexer images/topology remained pinned. The physically installed
candidate's unchanged repository-generated standalone operation script also
passed: deploy/resolve, verification-method and authentication-relation creation,
service addition/update and final resolution. Both its smoke command and overall
script exited 0. This is candidate-package acceptance, not a registry release.

The first standalone scratch harness emitted the successful operation result,
but its EXIT trap retained the consumer working directory, so relative log and
cleanup paths failed and the shell exit was not captured. Only that owned
project was cleaned up explicitly; the trap was corrected to restore its root
and capture the smoke exit separately. A bounded rerun supplied the exact exit-0
evidence above. Actual resource readback confirmed no test containers, consumer
networks or volumes remain; only an intentionally stopped bootstrap container
and local artifacts are retained. Product inputs did not change. Final
notes/retrospective-only changes reuse the passing immutable product-input
coverage rather than repeat the full suite.

Other disclosed baseline limits: one harness isolation fixture skips without
verified platform sandbox support; the verify light lane omits live integration;
the sibling VC checkout is absent; existing optional-build/auth-setting notices,
six API lint warnings and docs chunk warnings remain. No companion runtime or
browser-runtime compatibility is inferred from these checks.

## External prerequisites, review and tracked follow-ups

All five target npm versions were absent at preflight, with `latest=0.7.0` and
`rc=0.6.0-rc2`. GitHub's `npm-release` environment permitted protected branches
and required the `ex-identus` team. Its observed self-review setting is not
permission for agent approval. All five read-only `npm trust list` inspections
returned E401: mappings are unknown, not missing. An npm administrator must
attest each exact organization/repository/workflow/environment mapping before
publication; no credentials, configuration changes or publication probes are
requested.

The maintainer's existing agent-peer-review waiver applies; no agent review or
routed Pat evidence is claimed. Ordinary GitHub/CODEOWNERS review, full-range
signature/DCO verification and human-only merge remain required. Publication
requires a separately accepted exact merged-head readiness record, explicit
supervisor authorization pinned to source/ref/inputs, and human environment
approval. This PR does not merge, dispatch publication, self-approve, promote
main, or publish a final/latest release.

Follow-ups tracked by this preparation PR, with issue #520 as implementation
context: retain the upstream
declaration limitation, verify the merged-head deployed links and all current CI,
obtain external mapping attestation, and require actual registry/assets/provenance
and downstream readback before claiming a release. No final success is inferred
from local candidates or historic published versions.
