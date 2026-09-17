# Issue #443 pinned SLSA generator recovery retrospective

Date: 2026-09-16
Canonical tracker: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443)

## Incident evidence

Manual RC [run 35131496239](https://github.com/midnightntwrk/midnight-did/actions/runs/35131496239) ran from `develop` at `0d33adc8be814f77571210059508fdbff7f501dd`. The npm recovery behaved as designed: it verified and skipped the existing Jubjub `0.6.0-rc1`, published the other four packages in dependency order, waited for each immutable payload and `rc` tag to become visible, and completed the final all-five read-back. All five public versions expose npm SLSA provenance, `rc=0.6.0-rc1`, and `latest=0.5.0`. Public npm pull-back smoke tests passed. The ZK artifact was pushed to `ghcr.io/midnightntwrk/midnight-did-zk-artifacts:0.6.0-rc1`, pulled back, checked as a 12-circuit bundle, and exercised through runtime fetch.

The subsequent GitHub Release provenance job failed before creating a Git tag or GitHub Release. The reusable `slsa-framework/slsa-github-generator` workflow was correctly pinned to commit `f7dd8c54c2067bafc12ca7a55595d5ee9b75204a`, but its default release-binary mode rejected that detected ref with `Invalid ref: ... Expected ref of the form refs/tags/vX.Y.Z`. The later empty-path errors were consequences of the missing generator binary, not independent publication failures. `v0.6.0-rc1` therefore remained absent as both a Git tag and GitHub Release.

## Recovery change

Set `compile-generator: true` on the commit-pinned generic SLSA reusable workflow. The upstream workflow documents that this mode builds the generator from source at the detected ref. It therefore preserves the repository's immutable 40-hex action pin instead of weakening it to a tag merely to download a release binary.

Repository policy now asserts both the exact commit-pin shape and source-compilation mode. Maintainer policy and publishing documentation record why the pair is required so a future action update cannot silently restore an incompatible configuration.

## Exact same-RC recovery

After review and merge to `develop`, manually dispatch `publish.yml` again with `channel=rc`, `version=0.6.0`, and `rc_index=1`. Do not create `rc2` and do not rerun the failed job at the old revision.

The new run must fail closed unless rebuilt npm tarballs match all five immutable public package payloads and every package still owns `rc=0.6.0-rc1` without owning `latest`. Matching npm packages are skipped without another publish. The existing GHCR version is preserved, pulled back, and compared with the rebuilt ZK archive and manifest rather than overwritten. Only after those checks may the pinned SLSA generator compile, produce provenance for the exact release assets, and permit initial creation of the immutable `v0.6.0-rc1` GitHub Release. Final verification must confirm the `.intoto.jsonl` provenance and Cosign signature assets.

## Validation and non-mutation boundary

Validate the workflow parse and repository-policy assertions, formatting, action pins, release-context checks, frozen-lockfile audit, and normal repository gates. Local/PR validation must not dispatch publication, modify npm access/tags, publish packages, push GHCR content, create Git tags/releases, or merge protected branches.

## What worked, gap, and follow-up

Fail-closed job ordering prevented creation of an unsigned GitHub Release after provenance generation failed. npm idempotence and GHCR pull-back identity checks make the same RC recoverable without registry administration or a replacement version.

The gap was testing that the reusable workflow was commit-pinned without also testing the upstream mode required by such a pin. Keep both assertions coupled. Release engineering must attach the successful recovery run, exact source SHA, all-five npm evidence, GHCR identity evidence, Git tag/release URL, provenance asset, and signature verification to issue #443.
