# PR #459: develop-to-main promotion retrospective

Date: 2026-09-01
Canonical tracker: [midnightntwrk/midnight-did PR #459](https://github.com/midnightntwrk/midnight-did/pull/459)

## What prompted the work

The release branch had diverged from the validated `develop` integration branch,
while three Renovate pull requests remained open. The operator requested a
security and vulnerability check, landing every safe open change into `develop`,
and then promoting `develop` to `main`.

## What worked

- Work stayed in dedicated worktrees and left the dirty primary checkout
  untouched.
- Current `develop` passed a frozen install and `pnpm audit --audit-level low`
  reported zero vulnerabilities across 992 dependencies.
- GitHub reported zero open Dependabot alerts and zero open secret-scanning
  alerts. Existing open code-scanning findings are OpenSSF Scorecard findings on
  `main`, not package-manager advisories or leaked secrets.
- PR #451 was identified as the safe update: pnpm 10.34.5 fixes install-time path
  traversal. Its exact-head CI, commit-integrity verification, and routed Pat
  review became clean.
- The main-based reconciliation commit carries a tree byte-identical to the
  frozen `develop` source without importing divergent legacy commits that fail
  current signature/DCO policy.

## Friction and failures

- PR #452 cannot produce a trustworthy lockfile because
  `@midnight-ntwrk/compact-js@2.5.3` requires the unavailable
  `@midnight-ntwrk/ledger-v9@^0.1.0-alpha.1`. Its passing scan covered the old
  locked graph rather than the proposed manifest graph.
- PR #453 cannot refresh its lockfile because Mermaid 11.17.2 introduces
  `cytoscape@3.34.1`, and pnpm rejects that release as a high-risk trusted-
  publisher/provenance downgrade.
- The GitHub branch-update path used for PR #451 created a signed merge commit
  without a terminal DCO trailer. The repository verifier correctly rejected
  it. The commit was replaced with a locally signed and signed-off merge whose
  tree was byte-identical to the GitHub-generated tree.
- `.devloops` sets `humanMergeOnly: true`. Agent automation can prepare and
  validate the queue but cannot perform protected-branch merges, even when the
  operator authorizes the overall campaign.

## Decisions

- Land PR #451 promptly after the mandatory human merge action.
- Hold PRs #452 and #453 without weakening frozen-lockfile, maturity, or trust
  policy. Actionable reproduction evidence is posted on each PR.
- Keep PR #459 draft until #451 lands, then refresh the reconciliation branch to
  the final frozen `develop` tip and regenerate every exact-head gate.
- Promote content from `develop` onto current `main` as signed reconciliation
  commits rather than merging divergent legacy histories.
- Do not tag, release, publish packages or ZK artifacts, enable auto-merge, or
  bypass branch protection as part of this promotion.

## Configuration drift and process gaps

- The repository has strong dependency controls (`minimumReleaseAge`, hard
  trust-downgrade rejection, frozen CI installs), and those controls blocked two
  unsafe or incoherent updates as intended.
- The generic GitHub branch-update operation is not DCO-aware. A follow-up should
  teach the stabilization path to refuse or repair generated merge commits when
  the repository requires terminal `Signed-off-by` trailers.
- Open Scorecard findings on `main` should be re-evaluated after promotion;
  several corresponding security and workflow hardening changes already exist
  on `develop`, so pre-promotion alert state is not final evidence.

## Tracked follow-up actions

- PR #451 tracks the human merge of the safe pnpm security patch.
- PR #452 tracks publication of a coherent installable Midnight runtime/proving
  dependency set and subsequent lockfile/API/proof validation.
- PR #453 tracks restoration of trusted publisher/provenance evidence in the
  Mermaid dependency graph and subsequent docs/visual validation.
- PR #459 tracks final develop freezing, local validation, exact-head commit and
  routed-review gates, protected CI, and the mandatory human main-branch merge.
- After PR #459 lands, rerun GitHub code-scanning/Scorecard and triage only alerts
  that remain current on the promoted `main` head.

## Guardrails

This work does not bypass dependency trust policy, import invalid historic
commits, rewrite protected branches, autonomously merge, publish packages or ZK
artifacts, create tags/releases, alter secrets, or change global review
credentials.
