# Issue #397 code-scanning remediation retrospective

Date: 2026-08-20
Canonical tracker: [midnightntwrk/midnight-did#397](https://github.com/midnightntwrk/midnight-did/issues/397)
Draft PR: [#429](https://github.com/midnightntwrk/midnight-did/pull/429)

## What prompted the work

The live Code Scanning dashboard retained ten open findings after the latest
`main` Scorecard run. Two were current repository-controlled regressions:
`docs-link-check.yml` again installed npm globally, and the advisory database
raised the patched nanoid 3.x floor from 3.3.17 to 3.3.18. Both conditions
survived an earlier remediation because a subsequent branch synchronization
reintroduced the workflow step and the advisory was revised after that fix.

## Alert disposition

- Scorecard #48 (Pinned-Dependencies) is actionable repository configuration.
  PR #429 removes the sole `npmCommand` reported by the current Scorecard.
- Scorecard #39 (Vulnerabilities) is actionable dependency configuration.
  PR #429 updates the affected `vite -> postcss -> nanoid` path to 3.3.18.
- Scorecard #40 (Code-Review) is a governance/history signal: the snapshot
  counted 19 of 29 changesets as approved. Source changes cannot retroactively
  approve merged changesets, so the finding is deferred rather than gamed.
- Scorecard #41 (CII-Best-Practices) is registration/governance work. The
  current snapshot detects an in-progress badge; public badge completion is
  tracked by #322.
- Legacy ossf-scorecard #7 through #12 are stale SARIF. Their messages are
  positive for binary artifacts, dangerous workflows, license, pinned
  dependencies, and security policy; #12's old token-permission warning is
  contradicted by the 2026-08-15 Scorecard 10/10 result. None are dismissed by
  this work.

## What worked

The current public Scorecard API supplied commit-bound evidence for every
check, while `pnpm audit` identified the exact dependency path and revised
patched floor. The remediation kept all action references at immutable SHAs
and did not expand workflow permissions. The docs link workflow now invokes
Linkinator through `corepack pnpm dlx`, so no workflow run block needs npm or
npx.

Review of the first regression harness showed that emulating npm's global
installation semantics produced a large, fragile rules engine while protecting
a weaker invariant than this pnpm repository needs. The replacement policy is
both stronger and simpler: a workflow or recursively reached build/test runner
surface must not execute npm or npx at all. YAML run scalars are loaded with
`js-yaml`, and executable commands are identified from the tree-sitter Bash
AST rather than by matching text. The scanner normalizes static quoting,
ANSI-C escapes, ordinary shell escapes, and continued lines. It resolves known
generic wrappers, eval and shell/PowerShell command strings, env split strings,
Corepack package-manager delegation, and pnpm exec delegation. Literal data in
comments, echo, printf, and non-executable heredocs stays allowed. An
unresolvable executable or dynamic eval/interpreter command string fails
closed, while dynamic arguments to a statically safe executable remain valid.
This removes the obsolete npm config, allexport, install-option, and subcommand
truth tables and replaces their fixtures with a concise forbidden/allowed
corpus.

Recursive inspection deliberately follows only repository build/test runner
surfaces reached through `run.sh`: sourced shell helpers and the data-driven
target catalog that delegates to the core, API, and docs lane scripts. The
catalog's `run_common_run_step` argument dispatcher is accepted only because
its executable values are enumerated and scanned from that catalog. Direct
release and publication scripts are a separate, explicitly reviewed audit
boundary. Workflows may invoke those scripts, and those scripts may
legitimately use npm for npm-registry queries, access, tags, or publication;
the workflow policy does not recursively reinterpret them as build/test
runners. Dedicated delegation and publication-boundary tests preserve that
scope.

The Bash parser remains tree-sitter rather than falling back to token or line
matching. Both exact, frozen `tree-sitter` 0.25.1 and `tree-sitter-bash` 0.25.1
packages include N-API prebuilt binaries for Linux x64/arm64 and Darwin
x64/arm64, covering hosted Ubuntu CI and both flake systems without relying on
a local compiler. Frozen installation and the Nix verification lane exercise
the dependency from the lockfile. `js-yaml` parsing and the nanoid 3.x lockfile
floor check remain unchanged.

## Friction and failures

The original security fix in PR #415 was correct at merge time but was undone
by later main-to-develop synchronization. It also pinned nanoid to the patched
version known then, 3.3.17; the advisory was subsequently updated to require
3.3.18. This demonstrates that a clean audit is time-bound and that fixes prone
to branch-sync regression need executable repository policy, not only a PR
record.

The Nix shell does not currently expose `actionlint` or `zizmor` as local
executables. Those attempted checks therefore cannot be claimed as local
validation; the repository Scan CI remains the authoritative workflow scanner.

## Decisions and non-goals

This PR changes only the two actionable repository conditions and their
regression test. The removed global `npm@12.0.2` installation is not replaced:
npm is not the repository package manager or a workflow toolchain dependency,
while the actual package manager remains exactly declared as pnpm 10.34.4 and
Node remains pinned by `.nvmrc`/the Nix shell. Installing a standalone npm solely
to preserve its version would recreate the Scorecard finding without protecting
a command the workflows use. The PR does not alter branch protection,
manufacture historical reviews, claim an unearned OpenSSF badge, dismiss
positive/stale alerts, merge the draft, or enable auto-merge. Dashboard
reconciliation remains tied to a fresh `main` Scorecard run after normal
promotion.

## Develop synchronization

The current `origin/develop` baseline was merged without rewriting history. The
resolution retains nanoid 3.3.18 and the exact js-yaml parser dependency while
adopting pnpm 10.34.4, esbuild 0.28.2, the pino trust-policy exception, and the
corresponding lockfile integrity data. The review also identified inline
`await` expressions in two adjacent `Promise.all` input arrays; both now start
all independent reads during array construction and parse JSON in promise
continuations.

## Validation and review evidence

The focused and full Node harness suites, frozen pnpm install, `pnpm audit`,
formatting, Nix document validation/build, and the full
`nix develop --command pnpm run verify` gate passed. The full gate was rerun
after a transient generated-output ordering failure and then passed without
source changes. The final commit SHA, GitHub-backed all-commit verifier result,
exact-head routed Pat audit, and hosted CI outcomes are recorded on issue #397
and PR #429 so that SHA-bound evidence does not become self-referential in this
tracked document. Any earlier exact-head review is not treated as transferable
after this policy simplification changes the head.
