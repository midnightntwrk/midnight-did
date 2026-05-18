# DID Surface Change Discipline

Use this guide before changing contract circuits, generated artifacts, package
exports, local runners, or CI workflow behavior.

## Target branch

Use `develop` for ordinary DID repository PRs.

## What counts as a surface change

| Surface | Examples |
|---|---|
| Contract | `contract/src/did.compact`, generated managed artifacts, circuit names |
| Package API | `domain`, `did`, `api`, `secret-storage`, and `jubjub-schnorr` exports |
| Runtime behavior | provider setup, resolver output, manager orchestration, key handling |
| Local workflow | `./run.sh`, split runners, metrics output, artifact packaging |
| CI and docs | branch filters, docs publication, PR checklist expectations |

## Required updates

- Add a `CHANGELOG.md` entry for behavior, packaging, or workflow changes.
- Update the README or docs page that explains the changed surface.
- Add tests or guard coverage for the new contract.
- Complete the DID Surface Checklist in the PR template.

## Guard command

```bash
npm run check:did-surface-discipline
```

The guard checks that the repository keeps `develop` branch validation,
packaging manifests, docs links, PR checklist language, and package export maps
in sync.

For full local confidence:

```bash
./run.sh --light --strict --metrics
```
