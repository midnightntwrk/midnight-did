# Contributing

Thank you for contributing to `midnight-did`, the reference implementation of the `did:midnight` method.

This repository owns the DID Compact contract, shared Jubjub Schnorr helpers, DID document/domain model, ledger-to-domain mapping, and TypeScript API orchestration. Resolver services, DID manager service/UI, and reusable secret storage live in `midnight-did-resolver`; VC/VP packages and use cases live in `midnight-verifiable-credentials`.

## Getting Started

- **Check existing issues and PRs:** Before opening new work, search the issue tracker and pull requests for similar reports or proposals.
- **Read the project guidance:** Review `README.md` and `AGENT.md` for package boundaries, validation commands, and DID surface-change discipline.
- **Use the Nix development shell:** The supported local environment is `nix develop`, which provides Node.js, pnpm, Compact, and supporting tools.

## Submitting Issues

Use one of the templates in `.github/ISSUE_TEMPLATE/` when possible. A clear title, exact context, and concrete acceptance criteria help maintainers triage the issue.

Issue types:

- **Bug report:** Include versions, reproduction steps, actual behavior, and expected behavior.
- **Documentation improvement:** Link the affected documentation and describe the gap or suggested wording.
- **Feature request:** Explain the user need, expected benefit, alternatives considered, and any compatibility impact.

Please do not report suspected security vulnerabilities in public issues. Follow `SECURITY.md` and use GitHub private vulnerability reporting.

## Code Contribution Process

- **Fork and branch:** Create a focused branch from `develop` unless a maintainer asks for a release or hotfix branch. When updating an existing PR, preserve its actual base.
- **Keep changes scoped:** Update the owning package and nearby docs/tests together.
- **Follow existing style:** Use the repository's TypeScript, Compact, linting, and formatting conventions.
- **Write tests:** Include unit tests, integration tests, or documented validation evidence appropriate to the change.
- **Use clear commits:** Prefer Conventional Commit style messages, for example `fix(api): handle invalid DID resolution`.
- **Sign and sign off every commit:** Every human-authored PR commit must have a GitHub-verified GPG or SSH signature and a terminal DCO trailer matching the commit author (`Signed-off-by: Name <email>`). Repository-policy-listed dependency bots must still have a valid accepted signature, but are exempt from the human DCO author/trailer match because their GitHub-generated trailers do not consistently use the bot account email.
- **Open a PR to the right branch:** Most PRs target `develop`; release-promotion PRs target `main`.
- **Respond to review:** Maintainers may request changes, additional tests, documentation updates, or downstream-impact notes.

Avoid force-pushing after review unless a maintainer asks for a rebase or history rewrite. A rewrite invalidates prior validation, signature, and review evidence: verify every rewritten commit, prove old/new tree identity for content-neutral rewrites, retain `git range-diff` output where applicable, rerun local/CI validation, and request fresh exact-head review.

## DID Surface Change Discipline

Run the surface guard before opening PRs that change public DID behavior:

```bash
pnpm run check:did-surface-discipline
```

Treat these as DID surface changes:

- Compact circuits, generated contract artifacts, or package export maps.
- Domain/API types or runtime behavior consumed by downstream applications.
- `./run.sh`, CI workflow, artifact packaging, or local tarball behavior.
- Documentation that defines how integrators consume the DID packages or services.

For these changes, update tests and documentation in the same PR. The PR template includes a DID Surface Checklist so reviewers can see which surface changed and how it was validated.

## Validation

For every source-changing PR, run the mandatory local gate:

```bash
nix develop --command pnpm run verify
```

This runs strict light and core lanes, the integration report, and
`pnpm run coverage:all`, including protected API module thresholds.

For release-facing, contract/API, or integration-sensitive changes, run a broader gate such as:

```bash
nix develop --command ./run.sh --strict
nix develop --command ./run.sh check-integration
```

If you cannot run a required command locally, explain why in the PR body and include the closest successful focused validation.

## License Headers

All contributions must be compatible with the repository's Apache-2.0 license. New source files should use an SPDX header appropriate for the file type where practical, for example:

```text
// SPDX-License-Identifier: Apache-2.0
```

Do not add placeholder copyright holder text. If a generated or third-party file requires different licensing text, keep the required upstream notice and make the provenance clear.

## Support and Communication

For general Midnight questions, use the public community channels linked from the Midnight documentation and website. For repository-specific work, GitHub issues and pull requests are the authoritative coordination surface.

We appreciate your contributions.
