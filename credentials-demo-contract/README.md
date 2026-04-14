# @midnight-ntwrk/midnight-did-credentials-demo-contract

Demo business contract for the Compact-first VC/VP prototype.

## Purpose

This package sits one layer above
[`../credentials/README.md`](../credentials/README.md):

- `credentials` defines shared VC/VP types and pure validation circuits
- `credentials-demo-contract` defines a simple issuer, holder, verifier flow

The demo contract models:

1. issuer submits an issued birth credential plus issuer proof
2. contract anchors the issued credential root and the expected holder binding
3. holder later submits a presentation plus holder proof
4. contract checks the holder's private birth-date witness against the committed claim
5. contract verifies `age >= threshold` without disclosing the birth date

## SSI capabilities exercised

| Capability | Where it appears |
| --- | --- |
| Issuer assertion | `issueBirthCredential(...)` validates the issuer proof against the credential body |
| Holder authentication | `verifyBirthPresentation(...)` validates the holder proof against the presentation body |
| Holder binding | the issued credential stores the expected holder DID method binding |
| Selective disclosure | the presentation can disclose birth-country data with its opening |
| ZK predicate | the contract checks the age predicate from a private birth-date witness |
| Anti-replay | both issuer and holder proofs carry a `challengeHash` |

## What the demo contract adds beyond the shared schema

The shared `credentials` package is intentionally pure.

This package adds the executable business flow:

- on-ledger anchoring of issued credential roots
- storage of the expected issuer and holder DID method bindings
- replay-resistant verification of presentations against anchored issuance state
- a concrete verification example for a birth-date based age predicate

## Build and test

- Compile Compact artifacts: `npm run contract -w credentials-demo-contract`
- Build TS exports: `npm run build -w credentials-demo-contract`
- Run tests: `npm test -w credentials-demo-contract`
