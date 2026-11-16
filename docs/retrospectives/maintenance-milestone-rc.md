# Milestone RC branch eligibility maintenance retrospective

Related release coordination: [issue #507](https://github.com/midnightntwrk/midnight-did/issues/507).
This is a bounded branch-policy change, not completion of that release-preparation issue or evidence of an actual publication.

## What worked

The checkout-free dispatch gate, build-job condition, shared release-context validator, and npm Trusted Publishing ref preflight now agree that RC publication may use `main`, `develop`, or a top-level `milestone-<nonempty>` branch with no slash in the suffix. Regression matrices exercise two different milestone names, current main/develop behavior, channel restrictions, malformed refs, and identity/authentication protections. RC versions remain `x.y.z-rcN` with the npm `rc` tag; final releases remain main-only and snapshots develop-only.

The predecessor's six source/test edits were preserved and inspected rather than reset. Active policy documentation was updated together; the historical main/develop-only descriptions in earlier npm retrospectives describe the policy at that time and are superseded by this record.

## What failed

The predecessor's last chained validation was interrupted to transfer implementation to a replacement worker. Its release-context and Trusted Publishing suites completed, but the mocked npm publisher suite was interrupted and the subsequent repository-policy suite was not reached. That run is neither a publisher regression nor a passing validation result. Final-file reruns passed: release-context 245/245, Trusted Publishing 73/73, mocked npm publication 72/72, and repository-policy 42/42 (all exit 0). Syntax, formatting, diff whitespace, DID surface discipline, agent-skill synchronization, docs build, and docs visual checks also passed.

The mandatory `pnpm run verify` was bounded to 360 seconds and timed out during the light lane's API build (exit 124); its later standalone core, integration-report, and coverage stages were not reached. A separate full `./run.sh --strict` was bounded to 150 seconds and timed out in the core lane's mocked publisher suite (exit 124). These are incomplete gates, not successful full validation. `./run.sh check-integration` exited 0 but warned that the sibling VC checkout was absent and its reference checks were skipped. Docker-backed API integration and complete coverage are not established by these results. The delivery PR retains these limitations for exact-head CI and maintainer review.

## Configuration drift and process gaps

Source eligibility and external deployment authorization are distinct. The observed `npm-release` environment permits protected branches only and requires `ex-identus` reviewers. `main` and `develop` are protected, while `milestone-1.0.0` is unprotected, so source support alone cannot enable that milestone's publication. npm-side Trusted Publisher mappings remain unverified. No environment, protection, reviewer, credential, or trust setting is changed by this work.

The maintainer waived agent-peer-review setup for this repository. Validation uses the repository Nix environment without automatic Pi package approval; the waiver does not replace signature/DCO checks or constitute review acceptance.

## Tracked follow-up actions

- This change's draft PR tracks exact-head CI, human review, and signed/DCO commit verification before any merge; mandatory local checks and unavailable infrastructure must be reported individually rather than inferred from focused tests.
- Release coordination in issue #507 must obtain administrator attestation that the intended milestone branch can use `npm-release` while preserving required reviewers and self-review prevention, and independently confirm all five npm Trusted Publisher mappings before a separately authorized dispatch.
- Keep the three runtime guards and workflow build condition aligned when branch policy changes. This change performs no merge, workflow dispatch, npm/GHCR publication, or GitHub Release creation.
