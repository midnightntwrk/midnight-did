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
and did not expand workflow permissions. A focused policy test now checks the
workflow and dependency invariants together so future baseline synchronization
cannot silently restore either vulnerable condition. Review of that harness
found that command wrappers could hide a global npm install, so the detector now
parses Bash into a tree-sitter syntax tree and inspects only executable command
nodes. The command-prefix model then handles common privilege, environment,
process, and scheduling wrappers with their options and assignments. Fixtures
cover nested wrapper chains (including bundled short options), shell-interpreter
`-c` commands, `eval`, npx/npm-exec indirection, npm install aliases and
configuration assignments, command substitutions, path-qualified and
quote-concatenated npm names, and unspaced subshells. Static assignment values
are normalized through the Bash syntax tree, including single- and
double-quoted `npm_config_global` and `npm_config_location` values. Command
strings passed through npm exec/x `-c`/`--call`, env `-S`/`--split-string`,
shell interpreters, and eval are recursively parsed while retaining applicable
npm configuration state. Negative quoted, `echo`/`printf`, heredoc, comment,
npm-script, end-of-options, command-string, and wrapper-operand fixtures keep
non-executed text and unrelated npm subcommands from becoming findings. The
scanner intentionally fails closed on a prohibited command that is
syntactically present but unreachable through shell control flow. The policy
gate enumerates every YAML workflow under `.github/workflows`, rather than
relying on the originally affected workflow path alone.

The Bash parser remains tree-sitter rather than falling back to token or line
matching. Both exact, frozen `tree-sitter` 0.25.1 and `tree-sitter-bash` 0.25.1
packages include N-API prebuilt binaries for Linux x64/arm64 and Darwin
x64/arm64, covering hosted Ubuntu CI and both flake systems without relying on
a local compiler. Frozen installation and the Nix verification lane exercise
the dependency from the lockfile; keeping the AST parser therefore has stronger
syntax coverage without adding an unsupported host to the repository matrix.

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
regression test. It does not alter branch protection, manufacture historical
reviews, claim an unearned OpenSSF badge, dismiss positive/stale alerts, merge
the draft, or enable auto-merge. Dashboard reconciliation remains tied to a
fresh `main` Scorecard run after normal promotion.

## Develop synchronization

The current `origin/develop` baseline was merged without rewriting history. The
resolution retains nanoid 3.3.18 and the exact js-yaml parser dependency while
adopting pnpm 10.34.4, esbuild 0.28.2, the pino trust-policy exception, and the
corresponding lockfile integrity data. The review also identified inline
`await` expressions in two adjacent `Promise.all` input arrays; both now start
all independent reads during array construction and parse JSON in promise
continuations.

## Validation and review evidence

The focused Node policy suite, frozen pnpm install, `pnpm audit`, formatting,
document validation/build, and full `nix develop --command pnpm run verify`
gate passed after the develop merge. These checks were repeated after detector
hardening. The final commit SHA, GitHub-backed
all-commit verifier result, exact-head routed Pat audit, and hosted CI outcomes
are recorded on issue #397 and PR #429 so that SHA-bound evidence does not become
self-referential in this tracked document.
