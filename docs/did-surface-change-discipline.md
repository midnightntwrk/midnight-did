# DID Surface Change Discipline

Target branch: `origin/develop`.

This guide defines the DID repository surfaces that downstream applications
depend on and the checks that should move with each change.

## Why This Exists

The DID repository is now the canonical home for the `did:midnight` method,
contract package, resolver mapping, API orchestration, reusable secret storage,
and service runners. Small changes in any of those areas can break downstream
Verifiable Credential, Passport, or app integrations even when unit tests still
pass.

The rule is simple: if a PR changes how another package, service, workflow, or
operator consumes DID behavior, the PR must update documentation, changelog, and
validation in the same slice.

## Public Surfaces

| Surface | Files | Reviewer question |
|---|---|---|
| Contract circuits | `contract/src/did.compact`, `contract/src/managed/**` | Are on-ledger invariants and generated artifacts still aligned? |
| JubJub verifier | `jubjub-schnorr/src/**` | Is the Compact transcript still compatible with TypeScript signing? |
| Domain model | `domain/src/**`, `domain/package.json` | Do schemas and canonicalization still match DID Core expectations? |
| DID mapper | `did/src/**`, `did/package.json` | Does ledger-to-domain conversion preserve canonical DID URLs and metadata? |
| API orchestration | `api/src/**`, `api/package.json` | Are runtime providers, circuit calls, and resolution outputs still stable? |
| Secret storage | `secret-storage/src/**`, `secret-storage/package.json` | Are key references, curve support, and wire signatures still compatible? |
| Local runners | `run*.sh`, `scripts/run-common.sh` | Can developers reproduce CI and collect timings locally? |
| Packaging | `scripts/pack-artifacts.sh`, package `files` manifests | Do tarballs contain the intended public runtime surface only? |
| CI and docs | `.github/workflows/**`, `docs-site/**` | Do `develop` PRs get the same verification as the active branch? |

## Required PR Updates

For any public-surface change, update:

- `CHANGELOG.md` with the reviewer-visible behavior or packaging change.
- The relevant package README or `docs-site` guide.
- Tests or a guard script covering the new contract.
- The PR template checklist before requesting review.

## Local Validation

Run the surface guard:

```bash
npm run check:did-surface-discipline
```

For broader changes, also run:

```bash
SKIP_LONG_RUNNING=1 ./run.sh --strict --metrics
```

Use `./run.sh --light --strict --metrics-json /tmp/midnight-did-run.json` when
you need a machine-readable timing artifact for a PR or CI triage note.

## Guard Scope

`scripts/check-did-surface-discipline.mjs` intentionally checks repository
contracts that are easy to drift:

- root scripts wire the guard into `ci:core`
- workflow branch filters include `develop`
- docs publication steps run only for `main` pushes or manual `main` dispatches
- the README workspace matrix covers every root workspace
- artifact packaging includes all library tarball workspaces
- library packages expose explicit export maps and `files` manifests
- the PR template, changelog, and docs mention surface-change obligations

This guard is not a replacement for semantic tests. It prevents missing
release-discipline updates while package-level tests continue to prove behavior.
