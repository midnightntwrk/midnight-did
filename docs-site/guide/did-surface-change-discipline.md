# DID Surface Change Discipline

Use this guide before changing contract circuits, generated artifacts, package
exports, local runners, or CI workflow behavior.

## Target branch

Use `develop` for ordinary DID repository PRs.

## What counts as a surface change

| Surface | Examples |
|---|---|
| Contract | `packages/contract/src/did.compact`, generated managed artifacts, circuit names |
| Package API | `domain`, `did`, `api`, and `jubjub-schnorr` exports |
| Runtime behavior | provider setup, DID update orchestration, and resolution helpers |
| Local workflow | `./run.sh`, split runners, metrics output, artifact packaging |
| CI and docs | branch filters, docs publication, PR checklist expectations |

## Required updates

- Add a `CHANGELOG.md` entry for behavior, packaging, or workflow changes.
- Update the README or docs page that explains the changed surface.
- Add tests or guard coverage for the new contract.
- Complete the DID Surface Checklist in the PR template.

## Guard command

```bash
pnpm run check:did-surface-discipline
```

The guard checks that the repository keeps `develop` branch validation,
packaging manifests, docs links, PR checklist language, and package export maps
in sync.

For full local confidence:

```bash
./run.sh --light --strict --metrics
```
