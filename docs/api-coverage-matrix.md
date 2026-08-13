# API coverage matrix

`packages/api` keeps the aggregate V8 coverage gate, but aggregate coverage can
hide untested orchestration modules. This matrix records the current direct
test status and the protection level for the modules named in issue #377.

## Current classification

| Module                              | Classification            | Current protection        | Next action                                                            |
| ----------------------------------- | ------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `controller-authorization.ts`       | Unit-tested               | Module threshold enforced | Maintain focused signing and digest tests                              |
| `contract-lifecycle-operations.ts`  | Unit-tested               | Module threshold enforced | Add join/deploy edge cases as needed                                   |
| `service-operations.ts`             | Unit-tested               | Module threshold enforced | Maintain mutation/digest tests                                         |
| `verification-method-operations.ts` | Requires additional tests | Aggregate gate only       | Cover add/update/remove and relation rejection paths                   |
| `wallet-keys.ts`                    | Unit-tested               | Module threshold enforced | Maintain deterministic derivation/address tests                        |
| `controller-operations.ts`          | Unit-tested               | Module threshold enforced | Expand recovery and promotion cases with behavior changes              |
| `wallet-context.ts`                 | Requires additional tests | Aggregate gate only       | Add isolated restore/startup tests or a deterministic integration seam |
| `wallet.ts`                         | Requires additional tests | Aggregate gate only       | Cover wallet construction and state restoration orchestration          |

No module in this matrix is intentionally excluded from measurement. The
long-running API integration suite remains a separate integration signal; it
does not replace direct unit coverage for state-critical orchestration.

## DID identifier conformance

| Boundary | Canonicalization requirement | Regression coverage |
| --- | --- | --- |
| Domain address/hash and DID parsers | Accept valid hexadecimal input and emit lowercase identifiers; malformed scheme, network, length, and encoding remain rejected | `packages/domain/src/test/midnight.test.ts`, `offchain-midnight.test.ts` |
| DID document and resolver mapping | DID document IDs, controllers, and resolver ledger-reader inputs are lowercase | `packages/did/src/test/midnight-did-document.test.ts`, `midnight-did-resolver.test.ts` |
| API lifecycle and ledger reads | Joined/deployed contract addresses are parsed before private-state binding and ledger queries | `packages/api/src/test/contract-lifecycle-operations.test.ts` |

This matrix records the lowercase identifier behavior introduced for issue #405;
it does not expand the API package surface or imply resolver-service/VC scope.

## Protected modules

`scripts/check-api-module-coverage.mjs` enforces module-level minimums for the
currently protected modules using the same deterministic coverage artifact
produced by the API Vitest run. `coverage:all` invokes this check after the
existing aggregate thresholds pass.

The check is deliberately independent of external coverage reporting. Changing
or adding a reporting provider must not change the local or CI gate.

## Expansion policy

When a deferred module receives focused tests, add it to the protected set only
when its minimum is meaningful and its negative/error paths are represented.
Do not lower aggregate or module thresholds to make a failing test suite pass.
Document intentional exclusions explicitly if a future generated or adapter
module cannot be measured meaningfully.
