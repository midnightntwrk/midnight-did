# PR #456: agent-review 0.6.0 upgrade retrospective

Date: 2026-08-31
Canonical tracker: [midnightntwrk/midnight-did PR #456](https://github.com/midnightntwrk/midnight-did/pull/456)

## What prompted the work

After a system restart, the repository checkout still resolved an older
project-local agent-review package while the user package had moved to 0.6.0.
The mixed package versions exposed conflicting peer-review skill loading. The
focused repair aligns the repository pin, its documentation, the synchronized
Codex and Claude skill copies, and the harness parsing fixture.

## What worked

- The dirty primary checkout and its unrelated release/specification changes
  were left untouched. Implementation and validation used a dedicated worktree
  based on the fetched default branch, `origin/main`.
- The Nix shell provisioned both `@input-output-hk/agent-review-pi` and its
  `@input-output-hk/agent-review` dependency at 0.6.0 under Pi 0.83.0.
- `pi list` showed the project package at 0.6.0, matching the user package, and
  the local `agents-pr-review` skill remained distinct from the package's
  routed `agent-review` skill.
- Focused harness tests, synchronized-skill checks, strict light/core gates,
  the integration report, and the full integration lane passed.

## Friction and failures

- The first full strict run timed out waiting for the unbootstrapped proof
  server to expose `/version`. This was environment startup latency rather than
  a source failure. Creating the repository-documented local bootstrapped image
  and rerunning the exact command produced a complete pass, including all 27
  API integration tests.
- `dev-loops@0.9.0 doctor` reported the legacy `subagent` command as unavailable
  even though the current harness uses taskflow for delegation. The schema and
  gate inspection still completed, but the diagnostic does not describe the
  current delegation surface precisely.
- Direct user-requested maintenance had no pre-existing issue number, while the
  review dispatcher requires an exact issue-bound retrospective. GitHub's
  shared issue/PR namespace permits this record to bind the direct workflow to
  PR #456 without inventing an unrelated tracker.

## Decisions

- Keep the repository and user installations on the same exact 0.6.0 package
  version; do not modify user credentials or commit the user-owned review
  configuration.
- Preserve the separate skill names and routing: `agents-pr-review` remains the
  explicit local-CLI advisory lane, while `agent-review` remains the routed
  GitHub peer-review lane.
- Keep this PR limited to the version pin, synchronized references, parsing
  fixture, and this required retrospective. No DID, API, review-policy, or merge
  autonomy behavior changes belong in the upgrade.

## Tracked follow-up actions

- PR #456 tracks exact-head CI, routed peer review, and confirmation that the
  package alignment remains clean on the pushed head.
- Any future dev-loop blocked specifically by the legacy `subagent` doctor
  probe must be recorded on the affected PR before changing repository policy;
  the warning alone does not justify adding another delegation package here.

## Guardrails

This work does not merge the pull request, enable auto-merge, modify global
agent-review configuration, publish packages, or resume the primary backlog
work before the package-upgrade PR exists.
