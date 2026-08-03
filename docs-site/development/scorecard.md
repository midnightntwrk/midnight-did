# OpenSSF Scorecard and Best Practices

This repository tracks OpenSSF Scorecard posture in GitHub issue #320 and child
issues. Repository-local mitigations are preferred; changes to organization
rulesets or branch protection belong in the owning infrastructure-as-code path.

## Best Practices badge

The OpenSSF Best Practices check is satisfied by a public project entry at
<https://www.bestpractices.dev/>. The badge URL is numeric and becomes stable
after the project entry is created, for example:

```markdown
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/<project-id>/badge)](https://www.bestpractices.dev/projects/<project-id>)
```

As of this repository update, searching the public Best Practices API for
`midnight-did` returns no project entry, so the README intentionally does not
claim a badge yet. Add the badge to `README.md` only after the public project URL
is created and reaches the intended baseline.

### Initial metadata to use

| Field                   | Value                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Project name            | Midnight DID                                                                                                               |
| Repository              | `https://github.com/midnightntwrk/midnight-did`                                                                            |
| License                 | Apache-2.0                                                                                                                 |
| Security policy         | `https://github.com/midnightntwrk/midnight-did/security/policy`                                                            |
| Contribution guide      | `https://github.com/midnightntwrk/midnight-did/blob/main/CONTRIBUTING.md`                                                  |
| Release artifacts       | npm packages, GHCR ZK artifact bundle, GitHub Release assets                                                               |
| Signed release evidence | GitHub Release `.sig`, `.pem`, and `.intoto.jsonl` assets after the next non-snapshot release from the provenance workflow |

### Pending criteria to verify before adding the README badge

- Public Best Practices project entry exists and points at this repository.
- Badge level is at least the agreed baseline for public repository posture.
- Release evidence is from a non-snapshot release produced after release signing
  and provenance landed on `main`.
- Any criteria that require organization policy or ruleset changes are linked to
  the owning infrastructure-as-code change instead of being handled manually in
  the repository UI.

Record the project URL, badge level, and next Scorecard result in #322 and #320.

## Branch protection and code review posture

Branch protection and ruleset changes are organization policy and infrastructure-as-code concerns. Do not change them manually from the repository UI as part of a feature PR; open or link the owning IaC change instead.

Current observed `main` protection:

- strict status checks enabled;
- required checks: `scan`, `Build, Lint, Test, and Coverage`, and `Typecheck, Audit, and Static Contracts`;
- stale review dismissal enabled;
- CODEOWNERS review required;
- required approving review count: 1.

Scorecard reports reduced `Branch-Protection` because the required approving review count is 1. Moving to two approvals should be decided and rolled out through the owning IaC/ruleset path so release-promotion and emergency-fix process expectations are updated at the same time.

For `Code-Review`, release-promotion PRs from `develop` to `main` should receive an explicit human approval before merge. Squash/merge automation and bot-authored follow-up pushes should not bypass the visible approval trail Scorecard uses to infer review posture.

Record any IaC link, required-review-count decision, and the next `Branch-Protection` / `Code-Review` Scorecard result in #325 and #320.
