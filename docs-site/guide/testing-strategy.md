# Testing Strategy

The repository deliberately separates fast checks from long-running environment-backed tests.

## Fast path

Use this first while iterating on code or docs:

```bash
SKIP_LONG_RUNNING=1 ./run.sh
```

This is the quickest way to catch build, lint, unit-test, and workspace integration drift.

## Component runners

Use these when you are working on one area:

- `./run-api.sh`
- `./run-cli.sh`
- `./run-resolver.sh`
- `./run-manager.sh`

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
