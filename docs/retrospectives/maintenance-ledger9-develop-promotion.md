# Ledger9 candidate promotion to develop

Date: 2026-11-13
Related implementation: [issue #520](https://github.com/midnightntwrk/midnight-did/issues/520), [PR #521](https://github.com/midnightntwrk/midnight-did/pull/521), and [PR #522](https://github.com/midnightntwrk/midnight-did/pull/522).
Delivery artifact: the draft `codex/promote-ledger9-to-develop` promotion PR targeting `develop`.

## Provenance and decision

- Frozen target `develop`: `d4ca576d54f323848f11ca61b7fd2f8ca778eeae`.
- Frozen source `milestone-1.0.0`: `b5878064704519f9edb1e1d2d4fc37abab322d2d`.
- Frozen source tree: `0b8a95754e71c21d84963d26505ffef251688d2a`.
- Comparison baseline `main`: `4e7f6b0f69bf4e2c8506a9693f8d0c3dfe68e550`.

Remote tips were re-fetched and checked before reconciliation. Recursive tree
maps confirmed that every develop blob and mode equals main; main adds only the
two existing promotion retrospectives, both retained unchanged in the source.
Develop has no unique product content against that baseline.

The assessment found 53 develop-only and 33 milestone-only commits, and 60
conflicted paths in a correct-direction ordinary merge. Selecting milestone
content at those conflicts produced the complete milestone tree. Following the
existing promotion precedents, this job instead carries that complete tree in
one new signed, DCO-signed-off commit whose sole parent is frozen develop.
It preserves develop ancestry without importing divergent legacy commits or
manually blending source implementations.

## Deterministic tree boundary

Before adding this record, `git write-tree` equalled the frozen source tree
exactly, including file modes and deletions. The only permitted difference
between source and promotion HEAD is the addition of this file:

```text
docs/retrospectives/maintenance-ledger9-develop-promotion.md
```

Check with `git diff --name-status b5878064704519f9edb1e1d2d4fc37abab322d2d HEAD`
and recursive blob/mode maps. Both historical promotion records remain intact.
All package, lockfile, implementation, API, changelog, workflow, release and
security-control bytes remain those of the frozen candidate. Source manifests
still say 0.6.0; that is not a publication identity or continuing Ledger8 support
claim. This carries the Ledger9 candidate and milestone-RC guards, not an RC
publication or a new compatibility guarantee.

## Fresh validation before this record

Commands ran in the repository Nix environment with Compact 0.36.0 passed to
Turbo through `COMPACT_DIRECTORY` and `COMPACT_COMPILER_VERSION`. Local runtime
was Node 24.18.1 and pnpm 10.34.5. These executions covered the exact source tree
above before this retrospective was added, not a future commit SHA.

- Frozen install and `pnpm run verify` passed. Package test/coverage counts were
  Jubjub 9, contract 65, domain 190, DID 163, and API 364; repeated lane executions
  are not additional unique tests. All eight protected API-module thresholds passed.
- The initial full `./run.sh --strict` failed at integration setup because the
  optional local bootstrap proof-server image was absent. Its 31 live tests were
  skipped, not passed. The documented official proof-server 9.0.1 image was
  available; `./run.sh api --strict` then passed all 364 unit and 31 live tests.
  The unchanged passing core lane from the initial full run was reused rather
  than unnecessarily rerun. The original full command retains its failed result.
- Docs build, browser visual checks, docs validation and 30 docs-validation tests
  passed. Release-context/release-note/provenance fixtures passed 245 tests,
  trusted-publishing fixtures 73, publisher fixtures 72, and repository-policy
  fixtures 42. These fixtures did not publish anything.
- Managed-artifact checks, workspace package smoke, all five candidate tarball
  packs, and a production 12-circuit ZK archive check passed. The archive's source
  metadata was explicitly pinned to the frozen candidate, not the still-uncommitted
  target-based working HEAD.
- An isolated consumer installed the actual five candidate tarballs, with
  consumer-only overrides keeping every transitive DID package on that inventory.
  Six package entry points resolved physically inside the consumer, not through
  workspace links. The installed public archive unpacker and version-mismatch
  negative passed; real SDK5 default-integrity HTTP and injected-fetch providers
  verified all 12 circuits and 36 payload hashes in each mode.
- The unchanged repository-generated standalone consumer then passed deployment,
  resolution, verification-key/relation creation, and service update using those
  candidate tarballs and the public-unpacked ZK bundle on a disposable official-image
  topology. This is candidate-package acceptance, not registry/publication evidence.
- `pnpm audit --audit-level low` reported no known vulnerabilities.

## Friction, drift and limits

- A publication-only Trusted Publishing preflight was mistakenly invoked locally;
  it correctly rejected the absent GitHub Actions publication context. Its 73
  fixture tests passed separately. No OIDC context was spoofed or control weakened.
- Conformance initially refused staged changes as designed. The mandatory clean-HEAD
  conformance execution is deferred until after this sole signed commit; its actual
  result and hosted exact-head evidence belong in the promotion PR, not a predicted
  success in this record. Supplemental external conformance is CI-only.
- The first scratch consumer harness had a syntax error. After correction, its
  initial lock graph selected historical registry 0.6.0 packages transitively.
  A fresh consumer-only lock with explicit candidate-tarball overrides corrected
  that inventory wiring without changing source or package versions.
- The existing adversarial-isolation harness test skips when verified Linux
  sandbox support is unavailable. Verify's light lane intentionally omits live
  integration; the corrected API run supplies fresh live evidence separately.
- The sibling VC checkout is absent, so integration readiness skips those
  references; no sibling runtime implementation or compatibility is claimed.
- Existing pnpm ignored-build-script/auth-setting notices, six API lint warnings,
  and VitePress large-chunk warnings remain disclosed, not repaired in this job.

## Review and tracked follow-ups

The maintainer waived repository-specific agent-peer-review and routed Pat
agent evidence for this promotion. No agent approval is claimed. Normal GitHub
human/CODEOWNERS review, CI, GitHub-backed verification of every PR commit, and
human-only merging remain required. This PR must stay draft for handoff.

The promotion PR tracks clean-HEAD conformance, exact-head CI, signature/DCO
readback and ordinary human review. Issue #520 retains implementation follow-ups;
[the companion VC issue #754](https://github.com/midnightntwrk/midnight-verifiable-credentials/issues/754)
retains downstream validation. Release notes, versioning, environment eligibility
and any RC publication require a separate authorized process. No protected branch,
admin policy, unrelated PR, tag, release or publication is changed here.
