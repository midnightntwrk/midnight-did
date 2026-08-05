---
name: midnight-identity
description: "Use this skill for midnight-did repository work: DID contract/domain/API package development, run.sh validation, Compact artifacts, package distribution, and DID/VC split-boundary decisions."
---

# Midnight Identity DID Skill

Use this skill from the `midnight-did` repository, whether cloned independently or as a submodule.

## Required Context

1. Read repository-root `AGENT.md` first.
2. Keep VC use cases, university BDD, and Passport/product flows out of this repository; those belong in VC or examples repos.
3. Keep committed guidance public-safe: avoid private tracker names, internal repository paths, local machine paths, or personal configuration.

## Defaults

- Resolve the repository's current default branch before starting work; for
  `midnight-did` it is currently `main`.
- Use DCO/GPG for repository-facing commits: `git commit -S --signoff -m "<type>: <subject>"`.
- Treat `~/.midnight-did` as sensitive local state.
- Use the Nix development shell for local package-manager, Compact, and
  validation commands. If tool or environment dependencies change, update
  `flake.nix` / `flake.lock` and setup docs in the same PR.
- Use conventional, scoped commit and PR titles. Keep PR descriptions explicit
  about motivation, change summary, validation, and issue links.
- Before pushing, verify `git log -1 --show-signature --pretty=fuller` shows a
  good signature and a `Signed-off-by` trailer.

## Harness and worktree discipline

- Use a dedicated worktree for implementation, validation, and review; do not
  use a dirty primary checkout.
- Create pull requests as drafts first. Do not mark a PR ready until the draft
  gate and validation evidence are complete.
- Run `npx dev-loops@0.9.0 doctor` and `npx dev-loops@0.9.0 gates` before a
  dev-loop. Configuration errors are blockers, not warnings to ignore.
- Keep `.devloops` limited to the schema supported by the pinned package.
- Treat GitHub Issues, pull requests, and CI as authoritative lifecycle state.
- Record a retrospective after meaningful audit or harness work, including
  configuration drift, process gaps, and tracked follow-up actions.

## PR Gate (required before any PR)

- Mandatory:
  - `./run.sh --light --strict`
  - `./run.sh core --strict`
  - `./run.sh integration-report`
- For API, contract, integration, runner, or dependency changes:
  - `./run.sh --strict`
  - `./run.sh check-integration` when the local environment supports it
- For docs-site or Nix/browser changes:
  - `pnpm run docs:build`
  - `pnpm run docs:visual` inside `nix develop`

Do not open or push PRs before completing the applicable gate and verifying
that the latest commit has both a good GPG signature and a `Signed-off-by`
trailer.

## Validation

Run validation commands from inside `nix develop`:

```bash
./run.sh targets
./run.sh --light
./run.sh --light --strict --metrics
./run.sh core --strict
./run.sh api --light
./run.sh docs
./run.sh clean-artifacts
./run.sh integration-report
./run.sh check-integration
pnpm run check:run-target-catalog
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh
```

Prefer `proof-server-bootstrap` for local full validation when available; it
substantially reduces proof-server startup time.

Resolver service, DID manager, and secret-storage validation moved to the
`midnight-did-resolver` repository; do not add those targets back here.

For shared JubJub Schnorr or contract changes, run `pnpm --filter ./packages/contract test`.

For coverage work, keep deterministic V8 measurement and CI thresholds
independent of any reporting provider. Classify each production module as
unit-tested, integration-tested, intentionally excluded with a documented
reason, or requiring additional tests. Aggregate coverage must not mask
security- or state-critical orchestration modules.

## Release Testing

Use the merged `main` branch for RC and final release tests. First wait for the complete `main` CI suite to pass, then dispatch the publication workflow explicitly:

```bash
VERSION=0.5.0
GH_TOKEN=<token>
gh workflow run publish.yml --repo midnightntwrk/midnight-did --ref main \\
  -f channel=rc -f version="${VERSION}" -f rc_index=5
```

Watch the resulting run to completion with `gh run watch`. A successful release-train run must complete package build/content checks, exact-version npm publication and smoke tests, GHCR push/pull verification, Cosign signing, SLSA provenance generation, immutable GitHub Release reconciliation, cryptographic signature verification, and provenance-presence verification.

RC reruns are reconciliation runs: reuse the occupied immutable `v${VERSION}-rc5` tag and never delete, draft-stage, or overwrite an existing release asset. If an exact npm version or remote artifact already exists, verify its identity and continue; fail closed on a mismatch.

After the workflow succeeds, independently verify both public paths and the standalone release flow. The standalone workflow is a required release gate, not an optional convenience:

```bash
gh workflow run release-smoke.yml --repo midnightntwrk/midnight-did --ref main \\
  -f version="${VERSION}-rc5" -f release_tag="v${VERSION}-rc5"
# Watch the returned run to completion with gh run watch.
```

Then download the immutable release assets and run the local checks. The signature check requires Cosign; install the same pinned version used by `.github/workflows/publish.yml` and fail closed if `command -v cosign` is unavailable:

```bash
TMP_DIR="$(mktemp -d)"
gh release download "v${VERSION}-rc5" --repo midnightntwrk/midnight-did --dir "${TMP_DIR}"
for sums in "${TMP_DIR}"/*.sha256; do (cd "${TMP_DIR}" && sha256sum -c "$(basename "${sums}")"); done
test -s "${TMP_DIR}/multiple.intoto.jsonl"
COSIGN_CERTIFICATE_IDENTITY="https://github.com/midnightntwrk/midnight-did/.github/workflows/publish.yml@refs/heads/main" \\
COSIGN_CERTIFICATE_OIDC_ISSUER="https://token.actions.githubusercontent.com" \\
nix develop --command ./scripts/verify-release-signatures.sh --assets-dir "${TMP_DIR}"
nix develop --command pnpm run published-artifacts:smoke -- \\
  --version "${VERSION}-rc5" --github-release-tag "v${VERSION}-rc5"
nix develop --command pnpm run published-artifacts:smoke -- \\
  --version "${VERSION}-rc5" \\
  --oci-ref "ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${VERSION}-rc5"
nix develop --command pnpm run published-standalone:smoke -- \\
  --version "${VERSION}-rc5" --github-release-tag "v${VERSION}-rc5"
```

Only trigger `channel=release` for `0.5.0` after RC5 is fully green, all independent checks pass, `main` remains unchanged, and explicit human release approval has been recorded.

## Change Discipline

- Keep `packages/contract`, `packages/domain`, `packages/did`, and
  `packages/api` aligned when a change crosses package boundaries.
- Update nearby tests and public docs in the same PR as behavior, export,
  packaging, or runner changes.
- If a change affects DID method semantics, update `w3c-spec/` and docs-site
  guidance together.
- Treat generated outputs as build artifacts. Regenerate them through package
  scripts instead of editing or copying them manually.
- Prefer focused package validation first, then run the required PR gate before
  marking the branch ready.
- Keep PRs focused; split unrelated behavior, docs, release, and maintenance
  work into separate branches unless the coupling is necessary.
- Keep the bundled Codex and Claude skill files synchronized when editing
  repo-local skill guidance.

## Packaging

```bash
pnpm run artifacts:pack
./upgrade-libs.sh --destination /path/to/downstream-repo
```

Do not hand-copy `dist/` or `src/managed/`; fix package `files` and build/prepack behavior instead.
Package consumers should use published package surfaces and published ZK
artifact locations, not copied generated key directories.

## MCP

Use a user-level Midnight MCP config when available; do not commit personal MCP files:

```toml
[mcp_servers.midnight]
command = "pnpm"
args = ["dlx", "midnight-mcp@latest"]
```
