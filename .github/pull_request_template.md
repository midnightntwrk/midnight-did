# Overview

<!-- Describe your changes briefly here, with some context as to why this is needed. -->

Target branch: usually `develop`; release-promotion PRs target `main`.

## Draft evidence lifecycle

This PR starts as a draft. Keep this body to scope, acceptance criteria,
definition of done, and non-goals while validation and review are pending. Do
not put a review verdict, CI outcome, or copied SHA-bound evidence in the PR
body. Validate the current head first; only then refresh exact-head evidence in
the authoritative CI and gate records. Any new commit invalidates prior dynamic
evidence and requires a new validation before review evidence is refreshed.

## Submission Checklist

<!-- Please check all the boxes that apply to your pull request. -->

- [ ] Useful pull request description
- [ ] Tests are provided (if possible)
- [ ] Mandatory local source-change gate passed with `nix develop --command pnpm run verify`
  - This includes strict light/core, integration-report, and `pnpm run coverage:all`. Explain any unavailable command in the PR body.
- [ ] Every PR commit has a GitHub-verified GPG signature and matching terminal DCO trailer
- [ ] Any history rewrite reverified every commit, tree identity, and `git range-diff` where applicable
- [ ] Key commits have useful messages
- [ ] All check jobs of the CI have succeeded
- [ ] Self-reviewed the diff
- [ ] Reviewer requested
- [ ] Update README.md file (if relevant)
- [ ] Update documentation (if relevant)
- [ ] No new todos introduced

## DID Surface Checklist

Complete this section when the PR changes any public DID surface:

- [ ] Contract circuits, generated Compact artifacts, or package exports are documented
- [ ] Domain/API type or runtime behavior changes are covered by tests
- [ ] Runner or CI behavior changes update the local command documentation
- [ ] Package artifact changes were checked with `pnpm run check:did-surface-discipline`
- [ ] Changelog entry added for reviewer-visible behavior or packaging changes

## Links

<!--
- Link any relevant GitHub issues here
- If your PR closes some of the existing issues, please add links to them here.
  Mentioned issues will be automatically closed.
  Usage: "Closes #<issue number>", or "Closes (paste link of issue)"
-->
