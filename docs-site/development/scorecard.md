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

## Packaging workflow detection

Scorecard `Packaging` reported `-1` / `packaging workflow not detected` for the
`main` snapshot taken before the release-provenance workflow was promoted.
Repository packaging is nevertheless implemented in `.github/workflows/publish.yml`:

- snapshot packages publish from `develop` pushes when the change classifier finds release-relevant source changes;
- release candidates and final releases publish through `workflow_dispatch` with explicit `channel`, `version`, and `rc_index` inputs;
- the workflow publishes npm packages, a GHCR ZK artifact bundle, GitHub Release assets, Cosign signatures, and SLSA provenance;
- final-release publication remains manual/intentional and must not be broadened solely to satisfy a heuristic.

The safe repository-side response is to keep the workflow name, job names, and
script names explicit (`Publish npmjs Packages and ZK Artifacts`, `Publish packages and ZK artifacts`, `publish-npm-packages.sh`) and then re-check Scorecard after `develop` is promoted to `main`. If detection still reports `-1`, treat it as a Scorecard heuristic mismatch unless OpenSSF documents a metadata-only signal that does not weaken release controls.

Record the next `Packaging` result and the exact Scorecard commit in #326 and #320.
