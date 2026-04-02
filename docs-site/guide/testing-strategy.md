# Testing Strategy

The repository deliberately separates fast checks from long-running environment-backed tests.

## Fast path

Use this first while iterating on code or docs:

```bash
SKIP_LONG_RUNNING=1 ./run.sh
```

This is the quickest way to catch build, lint, unit-test, and workspace integration drift.

For CI-parity core checks (without mutating files with auto-fixes):

```bash
SKIP_LINT_FIX=1 ./run-core.sh
```

## Component runners

Use these when you are working on one area:

- `./run-api.sh`
- `./run-resolver.sh`
- `./run-manager.sh`

Each runner includes infra cleanup traps and explicit dependency preparation to make clean, per-job execution reproducible.

## CI graph

GitHub Actions runs these in a parallel graph:

1. `core` (lint + contract/domain/did/secret-storage pipeline)
2. service matrix in parallel:
   - API pipeline (`./run-api.sh`)
   - resolver pipeline (`./run-resolver.sh`)
   - DID manager pipeline (`./run-manager.sh`)
3. final aggregation job

This reduces total CI wall-clock time versus a fully sequential pipeline.

## Long-running paths

These are slower because they rely on docker-backed topologies, Playwright, or integration flows:

- API integration tests
- resolver integration tests
- manager Playwright tests
- preprod-oriented manual flows

## Recommended workflow

1. run fast checks
2. run the component-specific runner
3. run the full pipeline only before final integration/commit

## Docs-specific checks

```bash
npm run docs:sync-source
npm run docs:api
npm run docs:build
```
