# API coverage matrix

`packages/api` keeps the aggregate V8 coverage gate, but aggregate coverage can
hide untested orchestration modules. This matrix records the current direct
test status and the protection level for the modules named in issue #377.

## Current classification

| Module                              | Classification | Current protection        | Direct V8 coverage (S/B/F) |
| ----------------------------------- | -------------- | ------------------------- | -------------------------- |
| `controller-authorization.ts`       | Unit-tested    | Module threshold enforced | Maintained by focused gate |
| `contract-lifecycle-operations.ts`  | Unit-tested    | Module threshold enforced | Maintained by focused gate |
| `service-operations.ts`             | Unit-tested    | Module threshold enforced | Maintained by focused gate |
| `verification-method-operations.ts` | Unit-tested    | Module threshold enforced | 100% / 94.44% / 100%       |
| `wallet-keys.ts`                    | Unit-tested    | Module threshold enforced | Maintained by focused gate |
| `controller-operations.ts`          | Unit-tested    | Module threshold enforced | Maintained by focused gate |
| `wallet-context.ts`                 | Unit-tested    | Module threshold enforced | 100% / 100% / 100%         |
| `wallet.ts`                         | Unit-tested    | Module threshold enforced | 100% / 100% / 100%         |

No module in this matrix is intentionally excluded from measurement. The
long-running API integration suite remains a separate integration signal; it
does not replace direct unit coverage for state-critical orchestration.

The phase-2 wallet tests mock imported collaborators and prove local orchestration
only. Real wallet SDK serialization compatibility, worker lifecycle, indexer
reconnection, and funding remain integration evidence. Verification-method unit
tests prove operation preflights, authorization digests, and submission payloads;
real contract proof generation and transaction finality remain integration
evidence.

## DID identifier conformance

| Boundary                            | Canonicalization requirement                                                                                                   | Regression coverage                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Domain address/hash and DID parsers | Accept valid hexadecimal input and emit lowercase identifiers; malformed scheme, network, length, and encoding remain rejected | `packages/domain/src/test/midnight.test.ts`, `offchain-midnight.test.ts`               |
| DID document and resolver mapping   | DID document IDs, controllers, and resolver ledger-reader inputs are lowercase                                                 | `packages/did/src/test/midnight-did-document.test.ts`, `midnight-did-resolver.test.ts` |
| API lifecycle and ledger reads      | Joined/deployed contract addresses are parsed before private-state binding and ledger queries                                  | `packages/api/src/test/contract-lifecycle-operations.test.ts`                          |

This matrix records the lowercase identifier behavior introduced for issue #405;
it does not expand the API package surface or imply resolver-service/VC scope.

## Protected modules

`scripts/check-api-module-coverage.mjs` enforces module-level minimums for the
currently protected modules using the same deterministic coverage artifact
produced by the API Vitest run. `coverage:all` invokes this check after the
existing aggregate thresholds pass.

The protected floors for the phase-2 modules are:

| Module                              | Statements | Branches | Functions |
| ----------------------------------- | ---------: | -------: | --------: |
| `verification-method-operations.ts` |       100% |      90% |      100% |
| `wallet-context.ts`                 |       100% |     100% |      100% |
| `wallet.ts`                         |       100% |     100% |      100% |

The verification-method branch floor is below the measured 94.44% to avoid
encoding an incidental current percentage while still requiring comprehensive
negative-path coverage. Wallet orchestration has no uncovered construct, so its
floor remains 100% for every protected metric.

The check is deliberately independent of external coverage reporting. Changing
or adding a reporting provider must not change the local or CI gate. Checker
contract tests run inside `coverage:all` and prove that protected entries,
metrics, and floors fail closed.

## Expansion policy

When a deferred module receives focused tests, add it to the protected set only
when its minimum is meaningful and its negative/error paths are represented.
Do not lower aggregate or module thresholds to make a failing test suite pass.
Document intentional exclusions explicitly if a future generated or adapter
module cannot be measured meaningfully.
