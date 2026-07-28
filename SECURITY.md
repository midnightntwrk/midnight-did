# Midnight Foundation Security Policy

This document outlines security procedures and general policies for Midnight Foundation repositories.

This policy adheres to the [vulnerability management guidance](https://www.linuxfoundation.org/security)
for Linux Foundation projects.

- [Midnight DID threat model](#midnight-did-threat-model)
- [Disclosing a security issue](#disclosing-a-security-issue)
- [Vulnerability management](#vulnerability-management)
- [Suggesting changes](#suggesting-changes)

## Midnight DID threat model

`midnight-did` implements the `did:midnight` method. It stores DID state in a
Midnight smart contract and resolves DID Documents from public ledger/indexer
state. This section names the main security boundaries integrators must account
for in addition to the vulnerability disclosure process below.

### Controller authorization and custody

Controller-gated DID updates are authorized by wallet-local Jubjub Schnorr
signatures. The controller secret stays in wallet/private-state storage; proof
servers receive operation-bound signatures and public inputs, not the controller
secret. Wallets and SDKs must still treat the controller secret as high-value
custody material: compromise permits controller-gated updates, while loss makes
ordinary updates impossible unless the dedicated recovery authority remains
available.

Use distinct controller and recovery authority secrets per DID. Reusing either
secret across DIDs creates a public correlation handle because the same public
key can appear in multiple contracts.

### Delegated proving

Delegated proof servers are trusted for availability, correct proof generation,
and confidentiality of any witness material they receive. They are not trusted
with controller-secret custody in the current authorization model. Integrators
that use remote proof servers must authenticate the endpoint, bind signatures to
exact operation inputs, and avoid sending wallet-local controller secrets or DID
Document private keys to the prover.

### Key loss, rotation, and deactivation

The contract includes a dedicated recovery authority public key that can rotate
the active controller key via `recoverControllerKey`. Back up both controller and
recovery private state before using a DID for production control, and verify
rotation/recovery flows preserve the replacement secret until the ledger state
has been reconciled. The prototype SDK stores both secrets in one private-state
record by default, so deployments that require cold recovery custody must add
separate storage/custody controls above the SDK layer. Loss of both controller
and recovery authority secrets freezes the DID.

Deactivation is irreversible. It prevents future updates, but it does not erase
public ledger history or prior DID Document contents from observers, indexers,
or archives. Treat deactivation as a final state transition, not as compromise
recovery after custody has already been lost.

### Resolver and indexer trust

Resolution reads are indexer-backed. A resolver that trusts a compromised,
misconfigured, or stale indexer can return forged, stale, or unfinalized DID
state. Operators should run or select trusted indexers, protect transport
security, and prefer finalized/pinned reads when those provider capabilities are
available. Resolver failures or indexer outages are availability failures, not
proof that a DID does not exist or is deactivated.

### Client-asserted timestamps

`created` and `updated` metadata are supplied by controller/prover witnesses and
stored on ledger after successful transactions. They are useful ordering and UX
metadata, but they are not consensus timestamps unless an application adds a
separate time attestation or validates them against independent ledger/indexer
events.

### Raw Compact calls and state validity

The TypeScript SDK and resolver enforce DID-domain validation that Compact cannot
fully express for opaque strings and JSON-like values. A raw Compact caller that
bypasses the SDK can create ledger state that is later rejected by strict
resolvers or consumers. Production clients should use the SDK validation path and
should treat malformed on-ledger DID state as a security-relevant interoperability
failure.

### ZK artifact supply chain

ZK prover, verifier, and ZKIR artifacts are part of the release supply chain.
The on-chain verifier keys are the proof-verification trust root for deployed
contracts, while published ZK bundles are what clients use to deploy and call
circuits. Consumers should use version-matched packages and ZK bundles, verify
checksums and manifests, and prefer signed/provenanced release assets when the
release pipeline provides them.

### Audit posture

This repository uses CI, code scanning, dependency automation, external review,
and issue-based hardening work, but those controls are not a substitute for an
independent production security audit. Treat unaudited contract/API changes as
requiring application-specific review before production deployment.

## Disclosing a security issue

The Midnight Foundation takes all security issues seriously, including issues in source code repositories managed
through our [GitHub organization](https://github.com/midnightntwrk). If you believe you have found a security vulnerability in a Midnight Foundation-owned repository, _please report it using GitHub's private vulnerability reporting_ and not through public GitHub issues. To learn more about GitHub private vulnerability reporting and how to submit a vulnerability report, please review [GitHub's documentation on private reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- The repository name or URL
- Type of issue (buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of the source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any particular configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

A maintainer will acknowledge the report within three (3) business days, and
will send a more detailed response within an additional three (3) business days
indicating the next steps in handling your report.

If you've been unable to successfully draft a vulnerability report via GitHub
or have not received a response during the allotted response window, please
reach out via the [Midnight Foundation security contact email](mailto:security@midnight.foundation).

After the initial reply to your report, the maintainers will endeavor to keep
you informed of the progress toward a fix and full announcement, and may ask
for additional information or guidance.

Thank you for improving the security of Midnight. We appreciate your dedication to responsible disclosure and will
make every effort to acknowledge your contributions.

## Vulnerability management

When the maintainers receive a disclosure report, they will assign it to a
primary handler.

This person will coordinate the fix and release process, which involves the
following steps:

- confirming the issue
- determining affected versions of the project
- auditing code to find any potential similar problems
- preparing fixes for all releases under maintenance

## Preferred Languages

We prefer all communications to be in English.

## Suggesting changes

If you have suggestions on how this process could be improved, please submit an
issue or pull request.
