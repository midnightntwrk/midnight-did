# Issue #281 npm publish preflight retrospective

Date: 2026-08-28
Canonical tracker: [midnightntwrk/midnight-did#281](https://github.com/midnightntwrk/midnight-did/issues/281)

## What prompted the work

Sequential snapshot publication could mutate one package and then fail during
redundant access administration, while later attempts failed on the first
package with npm's permission-hidden E404. The five package writes cannot be
made transactional, so the controlled 0.6 unfreeze needed complete evidence
before mutation and explicit immutable recovery behavior.

## What worked

Temporary fake npm, pnpm, and curl executables made registry state and mutation
ordering deterministic without contacting a registry. The tests exercise local
inventory failure, a late all-package read failure, ambiguous E404 and malformed
access evidence, mismatched immutable payloads, none/partial/all-present states,
publish order, access reconciliation, complete post-publish verification,
temporary npmrc cleanup, and token redaction.

A small Node helper owns only local archive inspection: it derives catalog order,
requires exactly the five canonical tarballs, validates workspace and packed
manifest identities, and computes SHA-512 evidence. The existing Bash publisher
continues to own the remote state machine. This split kept package production in
pnpm with provenance while allowing direct npm only for audited view, access,
and dist-tag administration.

The resulting phases are explicit: complete local inventory, complete read-only
remote inventory, evidence-gated access reconciliation, publish only missing
packages, all-five payload verification, dist-tag reconciliation, and final
all-five payload/access/tag read-back. Public access and already-correct tags are
no-ops. No temporary authority probe was added because it would itself mutate
registry state and would not prove a later package-version PUT.

## Friction and failures

The installed local-implementation skill referenced a pre-flight script absent
from this repository version. The repository harness diagnostic, explicit git
ancestry check, dedicated-worktree check, branch check, and clean-tree check
provided equivalent safety evidence before implementation. Repository defaults
are GitHub-first, so the explicitly authorized local route required a canonical
local-state input to the startup resolver. The installed environment also did
not expose a subagent command, preventing local parallel review fan-out; routed
review remains a post-draft-PR action.

The broad repository gate reached and passed the new publication and policy
checks, then failed in an unrelated Compact baseline mismatch: generated Jubjub
code expects runtime 0.15.0 while the installed package is 0.16.0. Release pack
integration separately exposed an existing API/domain mismatch where the API
imports `normalizeBoundDIDURL` but the domain package does not export it. Focused
publisher, policy, package-content, documentation, build, and visual checks were
kept as the issue-bound evidence rather than broadening this security change to
repair those package baselines.

## Decisions, limits, and follow-up

Read-only package visibility and access evidence reduces ambiguity but cannot
prove a later PUT will be authorized. A token can lose authority or npm can fail
after any successful package write; the workflow therefore must not claim a
cross-package transaction. A matching partial version set is recoverable only by
rerunning the same SHA, version, and tag. Any immutable mismatch or ambiguous
read fails closed.

The public post-publish npm smoke no longer receives the write-capable token.
Protected environments, credential repair, and broader workflow redesign remain
outside this controlled-unfreeze phase. Exact-head release/security review
should pay particular attention to real npm CLI output shapes and access-status
semantics before human approval.
