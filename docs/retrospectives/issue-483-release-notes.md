# Issue #483 reviewed release notes retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did#483](https://github.com/midnightntwrk/midnight-did/issues/483)
Related stack: [PR #487](https://github.com/midnightntwrk/midnight-did/pull/487) → [PR #488](https://github.com/midnightntwrk/midnight-did/pull/488) → [PR #489](https://github.com/midnightntwrk/midnight-did/pull/489) → issue #483 delivery PR

## What worked

The existing release-context boundary already provides a trusted stable base version separately from generated RC and snapshot suffixes. Reusing `BASE_VERSION` lets RC and final releases select the same reviewed Keep-a-Changelog section without parsing a tag or accepting event text. Generating the notes before context validation preserves the rule that only environment assignments and the already-generated file path cross into the privileged publisher.

The existing immutable-asset and bounded-provider patterns also transfer cleanly to release bodies. A deterministic fake `gh` fixture can prove initial creation, exact-body rerun, mismatch rejection, malformed provider-state rejection, output suppression, and literal handling of hostile Markdown without contacting GitHub or dispatching publication.

## What failed and why

The previous publisher constructed one hard-coded sentence with `--notes`, so substantive reviewed migration guidance in `CHANGELOG.md` never reached GitHub Releases. It also read only draft, prerelease, and asset state on rerun, leaving the existing body outside the immutable identity check.

The first implementation pass exposed a documentation mismatch: guidance said missing assets were uploaded on rerun, while the script correctly refused to mutate an existing immutable release. The documentation now states the fail-closed behavior rather than weakening the publisher.

## Configuration drift and process gaps

No action pin, branch/ref rule, publication trigger, signature, SLSA, npm, GHCR, or snapshot behavior needed to change. The process gap was that release-body provenance and immutability were not part of repository policy tests even though asset immutability was. Policy coverage now fixes ordering around the privileged boundary and forbids release edit/upload paths in the publisher.

## Validation and safety boundary

Extractor and publisher tests use temporary files and local fake providers only. They do not publish npm packages, push GHCR artifacts, create or edit GitHub Releases, dispatch workflows, transition a PR, merge, or publish a release. Focused context, publication, repository-policy, shell-syntax, formatting, audit, and mandatory repository verification remain required before review.

## Tracked follow-up actions

- Issue #483 and its draft stacked PR track exact-head CI, signed/DCO commit verification, retrospective completion, routed review, and human approval before merge.
- Keep each release version represented by exactly one substantive Keep-a-Changelog section before dispatch; malformed or duplicate headings are publication blockers rather than inputs to repair during the workflow.
- Treat an existing release-body or asset-set mismatch as an incident requiring investigation. Do not add automated release edit, upload, or body-repair authority to the normal publication workflow.
