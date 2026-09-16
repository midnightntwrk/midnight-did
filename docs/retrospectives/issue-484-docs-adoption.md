# Issue #484 consumer adoption documentation retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did#484](https://github.com/midnightntwrk/midnight-did/issues/484)
Release tracker: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443)

## What prompted the work

The Quickstart was written for a repository checkout even though the coordinated
`0.6.0-rc1` packages and ZK bundle were public. Consumers had no single path
that named every directly imported package, distinguished the published RC from
the unpublished final version, and prepared runtime artifacts before provider
configuration.

## What worked

- Public npm metadata and the GitHub prerelease established the exact RC1
  package and artifact inventory without inferring availability from source
  manifests.
- Reusing the API's download and validation helper kept consumer instructions
  aligned with the package behavior and avoided reproducing release workflow
  internals.
- Linking the adoption page from both Quickstart and the package overview made
  one bounded page serve application setup and package discovery.
- Keeping the existing behavior migration sections preserved useful 0.5-to-0.6
  guidance while adding the missing installation and bootstrap sequence.
- Review identified that a distribution location is not necessarily a public
  consumer path. Naming the GitHub Release asset as the public route and GHCR as
  access- and authentication-required makes the trust boundary explicit.
- Rebasing only the two issue #484 commits onto the updated `origin/develop`
  excluded the superseded #482/#487 stack history. `git range-diff` matched both
  rewritten commits and the aggregate pre/post-rebase patches were byte-identical.

## Friction, failures, and configuration drift

- The source tree identifies itself as `0.6.0`, while public evidence currently
  stops at `0.6.0-rc1`. Commands therefore need explicit availability labels;
  repository version strings alone are not publication evidence.
- `MIDNIGHT_DID_ZK_CONFIG_PATH` is read while the API module initializes. A
  consumer cannot safely import the download helper in its long-running process,
  set the variable afterward, and expect `configureProviders` to use the new
  path. The documented bootstrap runs separately and sets the variable before
  the application process imports the API.
- The existing publishing guide contains the authoritative artifact behavior
  but is release-engineering oriented. The adoption page links only its focused
  metadata section rather than copying operational controls into consumer docs.
- The first adoption draft presented GHCR alongside the GitHub Release without
  the access caveat required by the public/private link policy. That could imply
  anonymous availability even though GHCR requires Midnight organization access
  and registry authentication.
- An initial publisher-fixture run was launched from a nested login shell inside
  `nix develop`. The login shell replaced the Nix `PATH`, selected macOS system
  Bash, and produced misleading Bash-version failures. Invoking each harness
  command directly through `nix develop --command` restored the pinned toolchain
  and the full publisher fixture passed. Future validation should avoid nested
  login shells at this boundary.
- The first repository verification attempt hit an unrelated timing flake in the
  PR-review process-group timeout test. Its immediate focused rerun passed without
  source changes; the complete exact-head verification rerun remains the final
  local gate.

## Validation and review evidence

The change is checked with focused, deterministic documentation assertions for
the adoption navigation, exact RC1 installation and imports, unpublished final
release warning, public GitHub Release asset, access-controlled GHCR wording,
and bounded non-certification language. Docs link and content validation,
VitePress build and visual checks, formatting, publisher-fixture validation,
and audit provide the broader green evidence. Commit signature and DCO are
verified separately. The rewritten exact head must still pass the complete
repository verification rerun, hosted CI, both gate checkpoints, and routed Pat
review before the PR can return to ready-for-review state.

## Follow-ups

- Release tracker [#443](https://github.com/midnightntwrk/midnight-did/issues/443)
  owns final `0.6.0` publication. Replace the prominently marked future command
  with current installation guidance only after all coordinated packages and
  matching ZK artifacts are publicly verified.
- Breaking DID Core 1.1 and DID Resolution work remains tracked by
  [#447](https://github.com/midnightntwrk/midnight-did/issues/447); do not expand
  0.6 adoption claims when that separate work changes.
