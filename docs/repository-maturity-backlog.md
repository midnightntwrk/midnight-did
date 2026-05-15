# Repository Maturity Backlog (Midnight DID / VC dev workflow)

## Status
- ✅ Added repository boundary declaration: `docs/repository-boundary.md`
- ✅ Added workspace manifest guard: `scripts/validate-workspace-manifests.js`
- ✅ Added boundary checks and cleanup scripts in `package.json`
- ✅ Modernized `run.sh` with explicit step matrix + `--metrics` + `--skip-coverage`
- ✅ CI now runs strict pipeline mode (`npm run run:strict`)

## Next 10 important improvements

1. ✅ **Done: Add repository audit report command**
   - Added `npm run audit:repo` (`scripts/repository-audit.mjs`) for workspace manifest/script checks and boundary detection.
   - Current command currently prints text output by default; JSON mode available via `--json`.

2. ✅ **Done: Add script-level contract tests for `run.sh` modes**
   - Introduce small shell tests (e.g. bats) covering `--help`, `--strict`, `--metrics`, `--skip-coverage`, and malformed args.
   - Implemented as `scripts/run-sh-contract.test.mjs` executed via `npm run test:run-sh`.

3. ✅ **Done: Split coverage from core CI path with allowlist**
   - CI now runs `run:fast` for push/pull_request/dispatch and keeps full `run:strict` with coverage only on scheduled runs.

4. ✅ **Done: Fail-fast API/CLI dependencies check in dev environment**
   - Added `scripts/check-workspace-dependencies.mjs` and wired `run.sh` to run it before heavy steps.
   - `run.sh` now exits early when workspace manifests or required scripts drift.

5. ✅ **Done: Formalize workspace contract for each package**
   - `scripts/repository-audit.mjs` now enforces required workspace scripts `lint`, `build`, `test`, `coverage`, and `lint:fix`.
   - Added `cli` `test` script alias (`npm run test-api`) so all workspaces satisfy the contract.

6. ✅ **Done: Add deterministic timing artifact export**
  - Add `--metrics-json <path>` option to `run.sh` and publish artifacts in CI for trend analysis.
  - CI now executes `run.sh` with `--metrics-json` in both fast and strict pipelines and publishes JSON artifacts.

7. ✅ **Done: Introduce a root-level `npx`/`npm` sanity task**
   - Added `npm run check:toolchain` with root precheck logic in `scripts/check-toolchain.mjs`.
   - `run.sh` executes this precheck before patching and heavy pipeline work.
   - Added in [`scripts/check-toolchain.mjs`](/Users/ysh/iohk/midnight-did/scripts/check-toolchain.mjs) and wired via `run.sh` (`node scripts/check-toolchain.mjs`).

8. ✅ **Done: Tighten CI smoke targets**
   - Added `run-pipeline-fast` (`push`/`pull_request`/`workflow_dispatch`) with quick boundary checks and `npm run run:fast`.

9. ✅ **Done: Unify documentation and script discoverability**
  - Added role-specific contributor workflows in `CONTRIBUTING.md`.
  - Added `docs/midnight-did-book-for-dummies.md` into README as a practical entry point for user-case based specs.

10. ✅ **Done: Backlog-driven cross-repo review loop**
    - PR template now requires backlog/spec-matrix links, review governance checks, and use-case artifact evidence.
    - `npm run backlog:progress` provides a repeatable post-PR check that validates completed backlog tooling.
    - Claude review artifacts are kept under `review/` when a PR needs a second-opinion pass.

## Next 10 backlog items (stackable PR slices)

11. ✅ **Done: Implement fail-fast API/CLI dependency drift precheck**
   - Add a startup script that validates workspace package boundaries, required scripts, and expected tool versions before full pipeline execution.
   - Acceptance: `./run.sh` aborts early with actionable hints when a known drift is detected.

12. ✅ **Done: Implement deterministic metrics export in `run.sh`**
   - Add `--metrics-json <path>` to persist per-step timings in machine-readable format.
   - Acceptance: CI publishes a metrics artifact and local runs write valid JSON with stable keys.

13. ✅ **Done: Publish contributor workflow matrix in `CONTRIBUTING.md`**
   - Add role-based local workflows: issue triage, feature work, release, and CI triage.
   - Acceptance: README and CONTRIBUTING have aligned command paths for each role.

14. ✅ **Done: Create structured spec-to-implementation matrix**
   - Add `docs/midnight-did-spec-matrix.yaml` (or `.json`) linking every use case section to implementation status, risk, and owner.
  - Acceptance: reviewers can verify status in one file before writing or merging PRs.

15. ✅ **Done: Add canonical compact VC schema package**
   - Introduce agreed credential type definitions for identity, role, and compliance flows.
   - Accepted: shared schema module now exists at `schemas/compact-vc` with:
     - shared schema registry and envelope helpers
     - 3 canonical credential fixtures (identity/role/compliance)
     - deterministic SHA-256 vector fixtures
     - `npm run test:vc-profile` execution check.

16. ✅ **Done: Add VC status/reference baseline**
   - Added soft-status verifier helpers in `api/src/vc-status.ts`:
     - `evaluateVcStatus`
     - `assertVcNotRevoked`
     - `VcRevocationError`
     - `loadVcStatusRegistryFromFile`
     - `statusRegistryFixturePath`
   - Added fixture format under `api/src/test/fixtures/vc-status/*.json` with active and revoked snapshots for the same credential entry.
   - Added verifier-level test in `api/src/test/vc-status-verification.test.ts`.
   - Acceptance: same credential in revoked state is rejected by verifier test (`VcRevocationError`).

17. ✅ **Done: Add issuer/verifier trust registry contract scaffold**
   - Added `api/src/trust-registry.ts` with role lifecycle primitives:
     - `applyTrustRoleTransition`
     - `evaluateTrustRole`
     - `assertTrustRoleActive`
     - `getTrustRoleHistory`
     - `loadTrustRegistryFromFile`
     - `trustRegistryFixturePath`
   - Added fixture snapshot at `api/src/test/fixtures/trust-registry/trust-registry-baseline.json` with issuer and verifier seed roles.
   - Added transition tests in `api/src/test/trust-registry-contract.test.ts` covering:
     - issuer grant -> expiry-based inactivity
     - verifier grant -> revoke transition + ordered history
     - inactive role assertion failure path
   - Acceptance: two role-specific transitions are now covered by contract-style tests, including role-history visibility.

18. ✅ **Done: Add DID role delegation + capability template**
   - Added `api/src/did-delegation.ts` with:
     - template validation and normalized verification-method handling
     - grant/revoke/rotate transition evaluator
     - active-delegation decision API and history inspection
     - key rotation helper and fixture loading utilities
   - Added deterministic fixtures under `api/src/test/fixtures/delegation/`:
     - `delegation-template-agent.json`
     - `delegation-template-service.json`
     - `delegation-baseline-state.json`
   - Added contract-style tests in `api/src/test/did-delegation-contract.test.ts` covering:
     - template validation, grant materialization, key rotation, revoke path, and ordered history
   - Acceptance: delegated key rotation and revoke path validated by tests; agent/service template artifacts exist and are loadable.

19. ✅ **Done: Add university-style presentation/issuance BDD slices**
   - Added deterministic fixtures at `api/src/test/fixtures/university-diploma/university-bdd.fixture.json` with 10 students, 3 verifiers, and mall profile.
   - Added scenario engine in `api/src/university-bdd.ts`:
     - `runUniversityDiplomaScenario` executes staged request/response checkpoints:
       - class roster load and trust state
       - batched issuance with status checks
       - presentation-to-verifier requests with role checks
       - discount requests to mall with grade thresholds
     - logs each step as structured request/response/check tuples with deterministic timing.
   - Added API test target `npm run test:university-bdd` in `api/src/test/university-bdd-flow.test.ts` plus scenario report formatter.
   - Exported API runtime model via `api/src/index.ts` and documented the test command in `README.md`.
   - Acceptance: scenario produces deterministic JSON-like structured logs and a reusable timing artifact via the test output or explicit artifact serialization.

20. ✅ **Done: Add PR-ready governance for stackable review**
  - Add a short PR template and review checklist for use-case-related changes.
  - Acceptance: checklists require matrix link, scenario coverage, and status update in the backlog.

21. ✅ **Done: Add university transport mode abstraction for BDD scenario runtime**
  - Refactor university scenario engine (`api/src/university-bdd.ts`) to support pluggable transport adapters via `UniversityTransport`.
  - Added simulator transport implementation and explicit standalone mode guard to make it clear when transport wiring is required.
  - Made `runUniversityDiplomaScenario` async and mode-aware (`mode`, optional `transport`, optional `now`) for local timing/control.
  - Updated scenario tests to validate simulator path and assert standalone mode failure message.
  - Acceptance: transport-specific behavior can now be substituted without changing scenario composition.

22. ✅ **Done**: Add configurable party-filtering options for scenario execution
   - Add `studentIds` and `companyIds` selection filters to `runUniversityDiplomaScenario` options.
   - Ensure filtered runs keep deterministic request/response order and still produce valid timing metrics and counters.
   - Add contract tests for filtered scenarios with fixture assertions.

23. ✅ **Done**: Add machine-readable and markdown notes formatters for BDD steps
   - Add dedicated formatters that produce clean, unescaped human text and deterministic machine payloads.
   - Preserve request/response/did context while avoiding escaped `\n` when logs are inspected in CI output artifacts.

24. ✅ **Done**: Add transport metadata in scenario result
   - Include selected mode and participant counts in `UniversityScenarioResult`.
   - Expose scenario-level metadata (`mode`, `studentsTargeted`, `companiesTargeted`) for dashboarding and quick CI checks.

25. ✅ **Done**: Add per-step schema validation guardrails
   - Add lightweight runtime checks that verify `companyIds` and `studentIds` are present in fixture when filters are provided.
   - Reject unknown identifiers with actionable errors (not silent filtering to empty sets).

26. ✅ **Done**: Add report export helper for deterministic JSON artifacts
   - Centralize report shape serialization so callers don't manually pick keys in tests/CI.
   - Reuse one canonical function for local file output and CI artifact generation.

27. ✅ **Done**: Add standalone transport readiness hook points
   - Extract transport factories into typed factories and document required adapter method contracts.
   - Provide explicit interfaces for `transportMode` and future HTTP/gRPC integration layers.

28. ✅ **Done**: Add scenario-level smoke tests for unknown identifier validation
   - Add tests for missing student/company ids in filtered mode to confirm failure mode is explicit and stable.

29. ✅ **Done**: Add per-party request/response sample snapshots
   - Capture sample payloads for student-to-university, student-to-verifier, and student-to-mall flows in docs/backlog and tests to simplify onboarding.

30. ✅ **Done**: Add markdown scenario summary report helper
   - Generate a short human summary (`issued`, `approved`, `rejected`, `latency`) that can be pasted into PR descriptions and CI notes.

31. ✅ **Done**: Add BDD metric guardrails for CI
   - Add a small API test that asserts key metrics are non-zero and monotonic in deterministic fixtures to detect accidental regression.

## Next 10 improvements (stackable PR candidates)

32. ✅ **Done: Add standalone adapter wiring contract test**
   - Added `supports standalone adapter wiring via injected transport` test in
     `api/src/test/university-bdd-flow.test.ts` with a mocked transport and lifecycle assertions.
   - Verifies `issueDiploma`, `requestPresentation`, and `requestDiscount` invocation counts under `mode: "standalone"`.
   - Keeps adapter contract scoped to `runUniversityDiplomaScenario` with filtered actor subsets.

33. ✅ **Done: Add scenario run replay artifact with request IDs and hashes**
   - Added replay telemetry types in `api/src/university-bdd.ts`:
     `UniversityScenarioReplayStep` and `UniversityScenarioReplayArtifact`.
   - Added `toUniversityScenarioReplayArtifact(...)` plus deterministic metadata on each step:
     `stepId`, `requestId`, `requestHash`, `responseHash`, `startedAt`, `endedAt`.
   - Added deterministic helper coverage in tests (`exports replay-ready artifact with request IDs and hashes`) to validate stable shape and checksum format.

34. ✅ **Done: Add CLI entry point for university BDD execution**
   - Added `scripts/university-bdd-run.mjs` and wired root command `npm run university-bdd:run`.
   - Added CLI options for `--fixture`, `--mode`, `--student-ids`, `--company-ids`,
     `--artifact`, `--replay-artifact`, and `--summary`.

35. ✅ **Done: Add fixture generator for filtered subsets**
   - Added `deriveUniversityFixtureSubset(...)` in `api/src/university-bdd.ts` to generate deterministic filtered fixtures from existing university fixture data.
   - Added stable, deterministic subset behavior coverage in `api/src/test/university-bdd-flow.test.ts`.

36. ✅ **Done: Add negative-path trust and status scenarios**
   - Added `runUniversityDiplomaScenario` regression coverage in `api/src/test/university-bdd-flow.test.ts` for:
     - issuer role revocation (runtime should fail before issuance),
     - revoked student credential status (issued/applications/discounts reflect downstream rejection),
     - expired verifier trust role (presentation approvals drop to zero, discount flow remains unchanged).

37. ✅ **Done: Add transport latency budget assertion**
   - Added CLI-level `--max-step-ms` and `--max-total-ms` budget flags to fail fast when timing thresholds are exceeded.
   - Added CLI contract checks for malformed budgets and parser errors.

38. ✅ **Done: Add BDD report diff utility for PR comments**
   - Added `scripts/university-bdd-diff.mjs` with:
     - `--baseline` / `--candidate` artifact inputs,
     - optional JSON or text output (`--format json|text`),
     - regression guard (`--fail-on-regression`).
   - Added contract tests in `scripts/university-bdd-diff.test.mjs`.
   - Wired root script `npm run university-bdd:diff`.
   - Acceptance: reviewers can compare baseline vs candidate metrics and per-step latency/check deltas in one command.

39. ✅ **Done: Publish backlog progress automatically**
   - Added `scripts/backlog-progress.mjs` to run bounded checks and emit a machine-readable summary (`--json`).
   - The script verifies selected target commands, reports PASS/FAIL in a single output, and can optionally apply `✅` markers automatically (`--apply`).
   - Wired command `npm run backlog:progress` for one-command progress checks before PR creation.

40. ✅ **Done: Add contract tests for parser input resilience**
   - Added explicit CLI and API fixture parser tests for malformed paths, invalid timestamps, and malformed student/company records.
   - Added exact field-level diagnostics for malformed student/company inputs in both `scripts/university-bdd-run.test.mjs` and `api/src/test/university-bdd-flow.test.ts`.
   - Added acceptance checks that error text includes deterministic labels like `students[0].did` and `Invalid ISO timestamp`.

41. ✅ **Done: Add did-method namespace validation and canonicalization tests**
  - Added canonicalization and namespace guard coverage for university/student/company/mall DIDs.
  - Added fixtures with mixed-case/whitespace DID values and checks that `loadUniversityScenarioFromFile` normalizes them to lowercase method namespaces.
  - Exported and used explicit namespace constants (`UNIVERSITY_DID_NAMESPACE_PREFIXES`) with student/university/company/mall role-specific rules.

42. ✅ **Done: Add lightweight adapter contract stubs for HTTP/gRPC transport**
   - Added `scripts/university-bdd-transport-adapter.mjs` with contract-compatible factories:
     - `createHttpUniversityTransport` for HTTP POST transport with timeout and request mapping,
     - `createGrpcUniversityTransport` stub with typed method parity and failure mapping,
     - `assertTransportConforms` for lightweight interface smoke checks.
   - Added dedicated transport contract tests in
     `scripts/university-bdd-transport-adapter.test.mjs` covering:
     - happy-path request/response forwarding,
     - HTTP status/error-to-exception mapping,
     - gRPC stub not-configured path and invoke-failure mapping.
   - Added npm script `test:university-bdd:transport` to execute transport adapter contract tests locally.

43. ✅ **Done: Add replay runner utility with strict request matching**
   - Add a small script that replays a saved scenario artifact deterministically and fails when request payload hashes diverge.
   - Useful as a regression safety net for CI and pre-merge checks.

44. ✅ **Done: Add CLI runner for university BDD with artifact persistence**
   - Added `npm run university-bdd:run` command with flags for fixture, filters, mode, and artifact path.
   - Added JSON replay artifact path and strict replay assertion via `--assert-replay`.
   - Added test coverage for artifact and replay contract checks in `scripts/university-bdd-run.test.mjs`.


46. ✅ **Done: Add contract tests for malformed fixture input and missing fields**
  - Add explicit tests for invalid fixture paths, invalid ISO timestamps, invalid DID method values, and malformed `students` records.
  - Ensure each failure path returns actionable and stable error messages.

47. ✅ **Done: Add transport timeout and retry observability**
   - Added optional timeout/retry configuration to `UniversityTransport` option bag.
   - Recorded retry counts and timeout events in step checks for CI visibility.

48. ✅ **Done: Add compact proof and DID binding assertions in scenario payloads**
   - Added issuance and presentation proof placeholders plus DID-binding assertions to scenario replay steps.
   - Replay artifacts now persist `proofPlaceholders` and `didBindingChecks` for issue/presentation steps for deterministic, reviewable diffs.

49. ✅ **Done: Add BDD fixture seed generator and shrinking utility**
   - Added `generateUniversityFixture(...)` and `shrinkUniversityFixture(...)` in `api/src/university-bdd.ts` with deterministic seed handling.
   - Added unit coverage in `api/src/test/university-bdd-flow.test.ts` for deterministic generation, large fixture shape, and deterministic shrink sorting behavior.

50. ✅ **Done: Add artifact schema versioning and migration tests**
   - Add `artifactVersion` field on report/replay exports.
   - Add compatibility tests for older format readers and upgrade path.

51. ✅ **Done: Add a documentation and screenshot bundle for use-case flow**
    - Add Mermaid diagram + sample request/reply diagrams into `docs/midnight-did-book-for-dummies.md`.
    - Include a compact artifact diagram so non-specialists can inspect flow without opening code.

52. ✅ **Done: Build a rendered screenshot bundle for docs artifacts**
   - Added `npm run docs:render` and `scripts/docs-mermaid.mjs` to produce deterministic SVG/PNG artifacts.
   - Commits keep `docs/assets/book-diagrams/*` checked in as reviewable review surfaces for visual diffs.

53. ✅ **Done: Ship a “use-case packet” fixture bundle per PR**
   - Added `docs/uc-bundles/university-bdd/` with a canonical fixture, request/reply examples, replay artifact, and report snapshot.
   - Added a synchronization checklist to keep packet inputs and outputs aligned with fixture and scenario changes.

54. ✅ **Done: Create a lightweight docs CI check for Mermaid correctness**
   - Added `npm run docs:check-mermaid` to validate Mermaid blocks in CI.
   - PRs now fail fast when malformed diagrams are introduced in docs sources.

55. ✅ **Done: Add a PR-ready `README` snippet generator**
   - Added `npm run pr:snippet` with stable markdown/json fields for version, verdict, command, run metrics, and university BDD counts.
   - The helper reads `run.sh --metrics-json` output plus the BDD report artifact for ready-to-paste PR evidence.

56. ✅ **Done: Add a canonical replay visualizer script**
   - Added `npm run university-bdd:visualize` to parse report/replay artifacts and emit HTML, markdown, or raw Mermaid sequence views.
   - The visualizer shows student-to-university issuance, student-to-verifier present proof, and student-to-mall discount exchanges.

57. ✅ **Done: Add a “smallest owner + dependencies” badge in specs**
   - Added owner/dependency badges for each documented use case in the book annex.
   - This reduces reviewer ambiguity during implementation PRs.

58. ✅ **Done: Expose a machine-readable metrics index**
   - Added `npm run university-bdd:metrics` to aggregate step latencies into JSON, CSV, or markdown.
   - Added budget guards with `--max-step-ms` and `--max-total-ms` for local and CI trend checks.

59. ✅ **Done: Add a PR summary helper for university BDD diffs**
   - Added `npm run university-bdd:pr-summary` to generate PR-ready markdown with counts, duration, schema version, and validation commands.
   - Updated the PR template to request this summary for university BDD changes.

60. ✅ **Done: Document adapter migration path for real Midnight transport**
   - Added `docs/university-bdd-transport-migration.md` linking adapter stubs, API transport contracts, HTTP/gRPC transition expectations, and production readiness checks.
   - Included evidence commands for standalone transport migration PRs.

61. ✅ **Done: Add docs/contract cross-linking to run.sh and backlog**
   - `run.sh --help` now points to the university visual bundle, backlog, and helper commands.
   - `npm run backlog:progress` now checks the new scripts/docs so backlog status cannot drift silently.

62. ✅ **Done: Document the v8 ledger/state migration stance**
   - Added `docs/v8-ledger-state-migration.md` covering the `typ` ledger field shape, removed `ledger-operation-builder` export, `DIDPrivateState`, two-phase `removeVerificationMethod`, and non-batched circuit model.
   - Added `npm run docs:check-v8-migration` plus `run.sh` precheck wiring so the stated migration stance fails fast if docs/source drift.
   - Acceptance: reviewers can tell that legacy deployed DID state is explicitly unsupported until a dedicated migration utility ships.

63. **Extract shared API/CLI Midnight provider utilities**
   - Remove duplicated wallet/provider/private-state/prover-key setup from `cli/src/api.ts` and `api/src/lib.ts`.
   - Acceptance: CLI imports shared primitives from the API layer or a small internal module, and v8 SDK boundary casts are isolated.

64. **Harden resolver-service public input boundaries**
   - Add DID length/pattern validation, safer endpoint policy coverage, rate-limit guidance, and log redaction for option bags.
   - Acceptance: malformed/oversized DID requests fail before resolver work, and errors cannot print caller secrets.

65. **Replace brittle SDK error-string matching**
   - Replace substring matching for missing contract-address/private-state behavior with a typed probe, explicit provider state check, or narrow error wrapper.
   - Acceptance: tests cover the expected pre-deploy private-state path without depending on SDK message text.

66. **Add schema guards for persisted delegation/trust/status state**
   - Validate loader JSON shape before casting persisted data into typed registries.
   - Acceptance: unknown enum values, missing discriminants, and malformed event arrays fail with stable field diagnostics.

67. **Introduce a circuit-name registry**
   - Centralize prover-key/circuit names into a typed registry and assert parity with generated contract circuits.
   - Acceptance: a circuit rename fails at compile time or in a small registry test instead of during a wallet call.

68. **Split the university BDD harness into reviewable modules**
   - Extract fixture loading, transport contracts, scenario execution, report building, and artifact helpers from the current monolith.
   - Acceptance: new real-transport code can be reviewed without reading the full scenario runner.

69. **Add a real-transport smoke harness for university BDD**
   - Wire standalone/proof-server transport behind the existing scenario interface and capture real timing metrics.
   - Acceptance: `university-bdd:run --mode standalone` either runs against configured infrastructure or fails with actionable setup diagnostics.

70. **Extend contract/API removal semantics coverage**
   - Add API-level regression coverage proving `removeVerificationMethod` removes relations before the contract removal call.
   - Add fake-timer coverage for contract timestamp updates.
   - Acceptance: the documented decomposed removal semantics are enforced in tests.

71. ✅ **Done: Validate Compact compiler/runtime compatibility in CI prechecks**
   - Added a `check:toolchain` guard comparing `compact compile --runtime-version` with the declared `@midnight-ntwrk/compact-runtime`.
   - Acceptance: compiler/runtime drift fails before contract tests import generated managed code.
