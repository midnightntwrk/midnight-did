# Dev-loop harness retrospective

Date: 2026-08-05

## Scope

This retrospective covers the repository audit and the follow-up work that
removed recurring validation warnings, added Nix-provided Playwright Chromium,
restored API formatting, and corrected the semantic PR-title scope.

## What worked

- The audit started from a clean default-branch worktree instead of relying on
  a dirty development checkout.
- Findings were grouped into focused GitHub issues and small pull requests.
- Validation remained deterministic and independent of a coverage provider.
- Generated artifacts, integration reports, documentation checks, target
  catalogs, security scans, and strict light validation were exercised.
- An expected missing legacy runtime was made a no-op without suppressing real
  compatibility failures, and a regression test was added.
- The Nix shell now provisions the Chromium executable required by the docs
  visual check, which passes inside `nix develop`.

## Gaps found

- The repository had moved to `main`, while repository guidance and several
  global skills still assumed `develop`.
- The `.devloops` file used keys from an older or different policy contract.
  The pinned `dev-loops@0.9.0` loader rejected the file, so its repository-
  specific gates were not being applied.
- Draft-first behavior was documented but not enforced by the manual PR
  creation path.
- Signature and DCO requirements were documented, but the execution loop did
  not explicitly verify both before pushing.
- Aggregate API coverage passed while state-critical orchestration modules had
  low direct unit coverage. This is tracked in #377.
- VitePress/Node file-descriptor warnings remain external toolchain output and
  need classification or an upstream/toolchain fix rather than suppression.

## Corrective policy

- Keep `.devloops` schema-valid and limited to supported lifecycle settings.
- Keep command-level validation and repository-specific engineering rules in
  `AGENT.md` and the synchronized repository skills.
- Resolve the current default branch before implementation; this repository
  currently uses `main`.
- Use dedicated worktrees and draft PRs.
- Treat configuration errors as blockers.
- Verify GPG signature and DCO trailer before pushing.
- Keep coverage measurement and gating independent of provider selection.
- Require module-level coverage classification for critical orchestration code.
- Treat new warning output as a validation failure unless it is explicitly
  classified as external and tracked.

## Follow-up actions

- #377: add focused API orchestration tests and module-level coverage policy.
- #379: resolve or document remaining Node/VitePress descriptor warnings.
- Keep the bundled Codex and Claude skills synchronized.
- Keep global review and CI skills aligned with the dev-loop lifecycle and
  repository default-branch policy.
