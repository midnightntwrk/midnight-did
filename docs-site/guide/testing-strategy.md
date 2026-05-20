# Testing Strategy

The repository deliberately separates fast checks from long-running environment-backed tests.

## Fast path

Use this before opening or updating a PR:

```bash
./run.sh --light --strict
```

`npm run ci` is an alias for the same local PR validation contract. This is the
quickest strict way to catch build, lint, unit-test, and integration drift for
the root Midnight DID workspace. Use `npm run ci:packages` only when you need
the legacy package-only lint/build/test lane:

- core packages
- API
- resolver
- DID manager

For focused core checks while iterating:

```bash
./run.sh core --strict
```

## Component runners

Use these when you are working on one area:

- `./run.sh core --strict`
- `./run.sh api --light`
- `./run.sh resolver --light`
- `./run.sh manager --light`
- `./run.sh docs`

The legacy `run-*.sh` scripts are thin implementation details behind these
cataloged `./run.sh` targets. Each lane includes infra cleanup traps and
explicit dependency preparation to make clean, per-job execution reproducible.

## CI graph

GitHub Actions runs these in a parallel graph:

1. `core` (`./run.sh core --strict`)
2. service matrix in parallel:
   - API pipeline (`./run.sh api --strict`)
   - resolver pipeline (`./run.sh resolver --strict`)
   - DID manager pipeline (`./run.sh manager --strict`)
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
2. run the component-specific `./run.sh` target
3. run `./run.sh --light --strict` or `npm run ci` before final integration/commit
4. use `npm run ci:packages` only for the legacy package-only lane

## Docs-specific checks

```bash
npm run docs:sync-source
npm run docs:api
npm run docs:build
```
