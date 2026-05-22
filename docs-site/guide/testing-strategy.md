# Testing Strategy

## Fast Loop

Use this before opening or updating a PR:

```bash
./run.sh --light --strict
```

`npm run ci` is an alias for the same local PR validation contract. The light pipeline runs the core and API lanes while skipping long-running API integration work. Use `npm run ci:packages` only when you need the legacy package-only lint/build/test lane.

## Focused Lanes

```bash
./run.sh core --strict
./run.sh api --light --strict
./run.sh docs
./run.sh artifact-status
./run.sh check-managed-artifacts
./run.sh integration-report-schema
```

The root runner validates DID core/API/docs only. Resolver service, manager
service, and secret-storage checks live in
[`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver).

## Full Local Loop

```bash
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh --strict
```

Use the full loop for API/provider/runtime changes that need Docker-backed integration coverage.

## Guard Scripts

```bash
npm run check:did-surface-discipline
npm run check:run-target-catalog
npm run check:managed-artifacts
npm run artifacts:status
npm run report:integration
npm run report:integration:schema
npm run check:integration
```

These guards keep the repository surface, runner catalog, generated Compact
artifacts, and sibling VC integration assumptions aligned.

JSON consumers should read `schemaId` and `schemaVersion` before processing
integration-report payloads. `./run.sh integration-report-schema` and
`npm run report:integration:schema` print the current report contract without
requiring a sibling VC checkout.

## Recommended Workflow

1. Run `./run.sh --light --strict` or `npm run ci`.
2. Run the component-specific lane for the area you changed.
3. Run `./run.sh docs` when docs-site content changes.
4. Run the full local loop for API/provider/runtime changes that need Docker-backed coverage.
