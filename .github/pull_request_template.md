# Overview

<!-- Describe your changes briefly here, with some context as to why this is needed. -->

Target branch: usually `develop`; release-promotion PRs target `main`.

## Submission Checklist

<!-- Please check all the boxes that apply to your pull request. -->

- [ ] Useful pull request description
- [ ] Tests are provided (if possible)
- [ ] Local PR validation passed with `./run.sh --light --strict` or `pnpm run ci`
  - If you used `pnpm run ci:packages` as a package-only fallback, explain why in the PR body.
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
- Link any relevant Confluence or additional Jira tickets if need be
- If your PR closes some of the existing issues, please add links to them here.
  Mentioned issues will be automatically closed.
  Usage: "Closes #<issue number>", or "Closes (paste link of issue)"
-->
