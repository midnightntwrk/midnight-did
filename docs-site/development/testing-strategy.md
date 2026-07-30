# Testing Strategy

## Fast Loop

Use this before opening or updating a PR:

```bash
./run.sh --light --strict
```

`pnpm run ci` is an alias for the same local PR validation contract. The light pipeline runs the core and API lanes while skipping long-running API integration work. Use `pnpm run ci:packages` only when you need the legacy package-only lint/build/test lane.

## Focused Lanes

```bash
./run.sh core --strict
./run.sh api --light --strict
./run.sh docs
./run.sh artifact-status
./run.sh check-managed-artifacts
./run.sh integration-report-schema
```

`artifact-status` prints managed artifact freshness as JSON,
`check-managed-artifacts` fails on missing or stale generated Compact outputs,
and `integration-report-schema` prints the current integration-report schema.

The root runner validates DID core/API/docs only. Resolver service, manager
service, and secret-storage checks live in
[`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver).

## Full Local Loop

```bash
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh --strict
```

Use the full loop for API/provider/runtime changes that need Docker-backed integration coverage.

## Fuzzing

Parser and serialization fuzz/property coverage lives next to the package that owns the surface. The initial suite covers offchain DID state encoding, malformed payload rejection, and long-form hash verification in `packages/domain/fuzz/` using `fast-check`.

```bash
FUZZ_RUNS=1000 pnpm --filter ./packages/domain test:fuzz
```

The `Fuzzing` workflow runs weekly, on demand, and for PRs that change fuzz targets, domain fuzz dependencies, or the fuzz workflow. Keep normal PR checks fast by adding new long-running fuzz targets behind that workflow rather than the default `test:ci` lane.

## Guard Scripts

```bash
pnpm run check:did-surface-discipline
pnpm run check:run-target-catalog
pnpm run check:managed-artifacts
pnpm run artifacts:status
pnpm run report:integration
pnpm run report:integration:schema
pnpm run check:integration
```

These guards keep the repository surface, runner catalog, generated Compact
artifacts, and sibling VC integration assumptions aligned.

JSON consumers should read `schemaId` and `schemaVersion` before processing
integration-report payloads. `./run.sh integration-report-schema` and
`pnpm run report:integration:schema` print the current report contract without
requiring a sibling VC checkout.

## Recommended Workflow

1. Run `./run.sh --light --strict` or `pnpm run ci`.
2. Run the component-specific lane for the area you changed.
3. Run `./run.sh docs` when docs-site content changes.
4. Run the full local loop for API/provider/runtime changes that need Docker-backed coverage.
