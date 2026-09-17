# Issue #491 GitHub CLI devshell retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did#491](https://github.com/midnightntwrk/midnight-did/issues/491)

## What prompted the work

The release operator host exposed `gh 2.67.0`, which did not provide the
`closingIssuesReferences` JSON field required by the pinned gate workflow. The
locked nixpkgs already provided `gh 2.97.0` with that capability, but the
default devshell did not include it and therefore inherited the host binary.

## What did not work

PR #482 tried to diagnose the mismatch by executing and adversarially probing
installed helper code. Full-gate review showed that this introduced
subprocess, hashing, and trust-boundary complexity disproportionate to a tool
provisioning mismatch. PR #482 was therefore closed as over-scoped rather than
expanded further.

## Decision

Pin the existing nixpkgs `gh` through the default devshell, protect that package
membership with one structural repository-policy regression, and require
workflow commands to run through `nix develop --command` or an entered Nix
shell. The contract is the required `closingIssuesReferences` capability, not
a broad minimum-version claim.

## Scope boundary and follow-up

This change does not add helper execution, hashing, a subprocess supervisor,
package-pin updates, `.devloops` changes, or product/release behavior. Issue
#481 remains the post-release diagnostic and migration follow-up.
