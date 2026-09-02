# PR #453: documentation tooling refresh retrospective

Date: 2026-09-02
Canonical tracker: [midnightntwrk/midnight-did PR #453](https://github.com/midnightntwrk/midnight-did/pull/453)

## What prompted the work

Renovate proposed Mermaid 11.17.2 and typedoc-plugin-markdown 4.13.0 but did
not update `pnpm-lock.yaml`, so every frozen CI installation failed. The PR was
reassessed before the final `develop`-to-`main` promotion to determine whether
the updated graph had become safe and landable.

## What worked

- The latest exact PR head was reproduced in a dedicated worktree.
- pnpm 10.34.5 resolved the requested graph successfully and selected
  cytoscape 3.34.2 rather than the earlier untrusted 3.34.1 artifact.
- The repository's hard trust-downgrade policy remained enabled and passed; no
  trust, maturity, or frozen-lockfile exception was added.
- Frozen installation and `pnpm audit --audit-level low` passed with zero
  advisories.
- The docs build, browser visual checks, and mandatory `pnpm run verify` gate
  passed with the refreshed lockfile.

## Friction and failures

- Earlier head `8d068c7c` could not be repaired safely because its Mermaid graph
  selected cytoscape 3.34.1, which pnpm rejected as a high-risk trusted-
  publisher/provenance downgrade.
- Renovate later force-refreshed the branch and added typedoc-plugin-markdown
  4.13.0, but still omitted the lockfile. CI therefore continued to fail before
  testing the proposed packages.
- Re-evaluation was necessary because the security outcome changed: the newer
  registry graph selected cytoscape 3.34.2 and passed the same hard policy that
  correctly blocked the earlier graph.

## Decisions

- Land the current documentation-tooling graph only with the generated lockfile
  and exact-head validation evidence.
- Keep Mermaid's renderer changes covered by the browser visual lane rather
  than assuming a dependency-only update is behavior-free.
- Do not weaken trusted-publisher, provenance, maturity, or frozen-lockfile
  enforcement.
- Continue holding PR #452: compact-js 2.5.3 still requires the unavailable
  `@midnight-ntwrk/ledger-v9@^0.1.0-alpha.1` and cannot produce a coherent lock.

## Tracked follow-up actions

- PR #453 tracks exact-head CI, routed review, and the mandatory human merge.
- PR #459 must be refreshed from `develop` only after this safe update lands.
- PR #452 remains the tracker for a coherent, installable Midnight runtime and
  proving dependency set.

## Guardrails

This repair changes only the dependency lock and retrospective around the
Renovate manifest updates. It does not bypass supply-chain policy, alter DID
semantics, change production APIs, publish artifacts, create a release, or
change protected-branch merge authority.
