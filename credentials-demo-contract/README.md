# @midnight-ntwrk/midnight-did-credentials-demo-contract

Demo business contract for the Compact-first VC/VP prototype.

## Purpose

This package sits above two layers:

- [`../credentials`](../credentials): generic VC/VP envelope and proof core
- [`../credentials-birth`](../credentials-birth): birth-credential specialization

The demo contract models:

1. issuer submits an issued birth credential plus issuer proof
2. contract anchors the issued credential root and the expected holder binding
3. verifier defines a typed presentation request with disclosure, issuer, predicate, and challenge requirements
4. holder later submits a presentation plus holder proof
5. contract checks the holder's private birth-date witness against the committed claim
6. contract verifies `age >= threshold` without disclosing the birth date

## SSI capabilities exercised

| Capability | Where it appears |
| --- | --- |
| Issuer assertion | `issueBirthCredential(...)` validates the issuer proof against the credential body |
| Holder authentication | `verifyBirthPresentation(...)` validates the holder proof against the presentation body |
| Holder binding | the issued credential stores the expected holder DID method binding |
| Request-driven verification | `verifyBirthPresentationForRequest(...)` enforces a typed verifier request before accepting the presentation |
| Selective disclosure | the presentation can disclose birth-country data with its opening |
| ZK predicate | the contract checks the age predicate from a private birth-date witness |
| Anti-replay | both issuer and holder proofs carry a `challengeHash` |

## Build and test

- Compile Compact artifacts: `npm run contract -w credentials-demo-contract`
- Build TS exports: `npm run build -w credentials-demo-contract`
- Run tests: `npm test -w credentials-demo-contract`
