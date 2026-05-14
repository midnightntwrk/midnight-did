# University BDD Transport Migration Guide

This guide describes how to move the university BDD scenario from the deterministic simulator path to a standalone Midnight-backed environment while keeping the same BDD fixtures, request/response DTOs, and reporting tools.

## Current adapter boundary

The scenario runner calls three transport operations:

| Operation | Caller | Receiver | DTO intent |
|---|---|---|---|
| `issueDiploma` | Student agent | University issuer | Student-initiated diploma VC issuance request |
| `requestPresentation` | Student agent | Verifier company | Present-proof request using the issued diploma VC |
| `requestDiscount` | Student agent | Mall verifier | Present-proof request for discount eligibility |

The JavaScript adapter stubs live in [university-bdd-transport-adapter.mjs](../scripts/university-bdd-transport-adapter.mjs). The API-level scenario transport type lives in [university-bdd.ts](../api/src/university-bdd.ts).

## Migration target

The standalone environment should preserve the same BDD contract and replace only the transport implementation:

1. Student, university, company, and mall agents resolve or create their DIDs through a shared DID CRUD service.
2. The university issuer receives `issueDiploma` requests and calls the real credential/proof path.
3. The student holder stores the issued VC and prepares a present-proof payload.
4. Verifiers call the proof server or circuit wrapper and return a normalized verifier decision.
5. The BDD harness records the same step hashes, involved DIDs, proof placeholders, and timings.

## HTTP transition

Use HTTP first when the standalone environment is still service-oriented:

| Adapter path | Expected endpoint | Response requirement |
|---|---|---|
| `/issue` | University issuer service | Return `UniversityIssuanceDecision` |
| `/present` | Verifier company service | Return `UniversityPresentationDecision` |
| `/discount` | Mall verifier service | Return `UniversityDiscountResponse` |

Run a smoke check with:

```bash
npm run test:university-bdd:transport
```

## gRPC transition

Use gRPC when the proof service, verifier gateway, or DID management service already exposes RPC contracts. The adapter currently expects an injected `invoke(operation, request)` function. Keep operation names stable so BDD reports remain comparable across simulator, HTTP, and gRPC runs.

## Production readiness checklist

- DID CRUD service supports create, read, update, deactivate, and key rotation for each party role.
- Issuer and verifier DID documents expose the expected `assertionMethod`, `capabilityInvocation`, and service endpoint references.
- Proof server calls are timed and surfaced in BDD metrics.
- Timeout, retry, and circuit-breaker defaults are explicit per operation.
- The harness can export `--artifact`, `--replay-artifact`, `--summary`, and `university-bdd:metrics` outputs from a real run.
- Real transport errors map to deterministic BDD failure messages.
- Credential status checks use the same status reference shape as the simulator fixture.

## Review evidence

For each transport migration PR, attach:

- `npm run university-bdd:run -- --mode standalone --artifact /tmp/university-bdd-report.json --replay-artifact /tmp/university-bdd-replay.json`
- `npm run university-bdd:metrics -- --report /tmp/university-bdd-report.json --format markdown`
- `npm run university-bdd:visualize -- --report /tmp/university-bdd-report.json --replay /tmp/university-bdd-replay.json --out /tmp/university-bdd-replay.html`

