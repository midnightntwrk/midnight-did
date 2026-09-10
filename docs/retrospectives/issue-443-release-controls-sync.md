# Issue 443 release-controls synchronization retrospective

## Scope and outcome

This change is the separately reviewable `develop` reconciliation required by
[#443](https://github.com/midnightntwrk/midnight-did/issues/443), with the
release-control fixes reviewed in
[#462](https://github.com/midnightntwrk/midnight-did/pull/462) and
[#464](https://github.com/midnightntwrk/midnight-did/pull/464) replayed in that
order. It does not merge the divergent `main` history, publish anything, or
change registry, package-access, dist-tag, GHCR, tag, release, or workflow-run
state.

The branch was created from freshly fetched
`origin/develop@cb79be02c016102ae933dfbd37cc3a36eb0a7ad5`. That tip includes
#468 at `2ecab377cf4adb1a5ec8896e2e0f62e446e661da`, the merged #471 wording at
`575b8e09b045ddf73941f8fe5a73fb0babe893bf`, and the merged #472 dependency and
Quality policy at `cb79be02c016102ae933dfbd37cc3a36eb0a7ad5`. The replay also
preserves pnpm `10.34.5`, `js-yaml` `4.3.2`, and the current strict pnpm
supply-chain settings.

## Source and replay provenance

Both reviewed PR heads were fetched directly from GitHub pull refs. GitHub's
commit API reported `verified: true` with reason `valid`, and local GPG
verification identified key `4BEFC05538080D6E` for both source commits. Each
source commit has an author-matching `Signed-off-by` trailer.

| Reviewed change | Source parent                              | Source / merged tree                       | Stable patch ID                            | Signed replay                              |
| --------------- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| #462            | `de776912bb806f67bce54838cf9f9f3da1340900` | `53d44dbcc96e1601cda376d1ad22a36d46de1ab4` | `b27fde2add6ceddfb9b585a3b94e8f755e76525f` | `a1a1c101249b57f018299ae2db4bbaefee8cc7c1` |
| #464            | `218ec2f44848fd5f1977c653b134441ce647703f` | `12801065fb740a82f2f9cded72ffabe37a3bf43d` | `6b1c06f64d4abfbb6291bc16aa0a345801db309a` | `292d0a0ea69b787f1a4a2b66c1915c28f1758f27` |

The source trees equal their corresponding merged-main trees
(`218ec2f44848fd5f1977c653b134441ce647703f` for #462 and
`e865a7c24dff3233c9ba6b20233c1b5822b59ba9` for #464). Signed `-x`
cherry-picks preserved each complete stable patch ID; neither security patch
was subsetted. Both applied without textual conflicts. The follow-up policy
test makes the semantic conflict resolutions explicit by pinning the current
`develop` setup, dependency, Quality, publisher-provenance, and token-isolation
contracts.

At the #443 snapshot `develop@2ecab377cf4adb1a5ec8896e2e0f62e446e661da`,
`main...develop` was 25/38 with merge base
`a14267cec3c1ab7e00bb0f058a54267d913a321b`. After #471 and #472, the freshly
fetched base used here is 25/40. The additional two `develop` commits are
preserved deliberately rather than hidden by the historical count.

## What worked

- Re-fetching and checking the exact expected `origin/develop` SHA prevented a
  stale or accidental-main start.
- Pull-ref, GitHub signature, merged-tree, local GPG, DCO, and stable-patch-ID
  checks gave independent provenance evidence before and after replay.
- Complete signed cherry-picks retained the reviewed publisher hardening,
  release-context validation, API security regressions, docs, and original
  retrospectives.
- Existing `develop` changes composed cleanly with the replay. Focused policy
  assertions now fail if shared setup stops installing frozen, `.npmrc` loses
  engine/maturity enforcement, the exact pnpm exclusions drift, Quality skips
  audit, publication drops provenance, or the npm write token reaches another
  step.
- Frozen installation used pnpm `10.34.5`; the low-level audit reported no
  known vulnerabilities. Publisher (36/36), release-context (132/132), policy
  (12/12), harness (48 passed / 1 platform skip), and workspace checks passed.

## What failed or was surprising

- The first local signing attempt for the #464 replay was reported as a bad GPG
  signature. Before any push, review, or acceptance claim, the commit was
  re-signed without changing its tree, message, DCO trailer, provenance
  trailer, or stable patch ID. The retained replay commit
  `292d0a0ea69b787f1a4a2b66c1915c28f1758f27` verifies locally as good.
- Running focused Node policy tests before dependency installation failed
  because this fresh worktree had no `node_modules`. The required frozen
  install fixed the environment; subsequent tests passed.
- pnpm warns that committed project-level auth interpolation is ignored and
  should come from a trusted user configuration. No token value was inspected
  or printed. This reinforces the workflow test that confines the npmjs write
  secret to the publication step.
- The pinned dev-loop doctor still reports the documented optional subagent
  availability warning. The strict schema and repository harness remain the
  authoritative local checks.

## Process gaps and follow-up actions

1. **Release owner / npm administrator:** record a trusted, read-only
   `npm whoami` and package-level permission proof for all five package names.
   Do not use publication as a credential test and do not record a token.
2. **Release owner:** explicitly authorize one exact-head snapshot attempt
   before this draft can be merged. Because the classifier marks this replay
   release-relevant, merge to `develop` automatically attempts a snapshot.
3. **Release engineering follow-up:** investigate the low-risk raw
   output-writer defense separately. This reconciliation intentionally keeps
   the complete reviewed #464 implementation and does not broaden release-
   context code with a new defense during replay.
4. **Backlog owners:** keep unrelated release/readiness cleanup in its owning
   issues rather than expanding this security reconciliation.
5. **Tooling follow-up:** resolve the pinned dev-loop subagent-discovery warning
   independently; it is not release-control behavior.

## Hold and residual risk

This PR must remain draft even when tests, CI, and routed review are clean.
`release`-relevant script changes produce
`snapshot_release_relevant=true`; merging to `develop` therefore automatically
attempts a snapshot publication. Read-only package visibility and access status
do not prove that the credential can perform all five immutable package PUTs,
and five publications are not transactional. Human merge remains blocked until
trusted read-only npm identity/all-five permission evidence and explicit
one-snapshot authorization are durably recorded.
