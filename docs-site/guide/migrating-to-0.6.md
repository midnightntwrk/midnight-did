# Migrating from 0.5.0 to 0.6.0

The source changes documented here belong to the upcoming 0.6.0 release. The
published 0.5.0 packages keep their existing API and behavior. Downstream
consumers pinned to exact 0.5.0 versions should update all coordinated
`@midnight-ntwrk/midnight-did-*` dependencies together to a 0.6.0 snapshot for
pre-release testing, or to 0.6.0 after it is available. Do not combine exact
0.5.0 packages with this breaking source revision.

## Remove relationships before verification methods

Verification-method removal no longer purges DID verification relationships.
Remove the selected relationships first, one finalized transaction at a time,
and remove the method only after those removals are confirmed:

```ts
for (const relation of relationsToRemove) {
  await removeVerificationMethodRelation(
    didContract,
    providers,
    relation,
    methodId,
  );
}

await removeVerificationMethod(didContract, providers, methodId);
```

`removeVerificationMethod` and
`removeSchnorrJubjubVerificationMethod` throw
`VerificationMethodReferencedError` while references remain. Handle that typed
error by inspecting its ordered `relations`. After an ambiguous or partial
failure, re-read ledger state, skip removals already reflected on-chain, and
submit only the outstanding relationship removals before retrying method
removal.

## Run one writer process per DID

The supported 0.6 baseline assumes that one application process updates a given
DID. The API's fail-fast critical section coordinates overlapping controller
rotation, recovery, pending-state reconciliation, and protected contract-binding
lifecycle work in that process; it is neither a global serializer for ordinary
DID mutations nor a distributed lock. Ordinary mutations continue to rely on
the contract's expected-version checks. If an application intentionally allows
multiple processes to write the same DID, it must provide a distributed lock or
equivalent fencing mechanism. That multi-writer architecture is outside the
baseline API. See
[discussion #440](https://github.com/midnightntwrk/midnight-did/discussions/440)
for the decision and future considerations.

## Identify the DID during pending-state reconciliation

Pending controller-state recovery and discard now require the canonical
`contractAddress`. After connectivity is restored, obtain trusted finalized
ledger state, derive the replacement public key from the retained secret, and
compare the two public keys before retrying. Reconnection or the first available
read alone is not proof of non-finalization. Pass the address and the
authoritative confirmed outcome:

```ts
await recoverPendingControllerPrivateState(providers, {
  contractAddress,
  rotationFinalized: true,
});

await discardPendingControllerPrivateState(providers, {
  contractAddress,
  rotationFinalized: false,
});
```

The `rotationFinalized` value is an unchecked caller assertion; the helpers do
not query ledger state. `getMidnightDIDLedgerState` exposes the configured public
data provider's state without adding a finality or freshness guarantee, so use
provider-specific authoritative evidence before passing either value.

Promote when the finalized current controller key is derived from the retained
secret. Discard only after authoritative reconciliation confirms that the
operation did not finalize; otherwise keep the candidate even when an available
read still shows the old key. Do not infer the outcome from elapsed time. An
unresolved process-local owner remains busy until its underlying work is
cancelled and the operation settles, the operation otherwise terminates or
settles, or the process exits. Lease expiry would be unsafe because stale
provider or transaction work could still complete and overwrite, promote, or
remove state owned by a later operation. After cancelling underlying work or
restarting the writer process, reconcile finalized ledger and private state
before starting another mutation.
