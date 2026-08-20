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

## Identify the DID during pending-state reconciliation

Pending controller-state recovery and discard now require the canonical
`contractAddress`. Re-read `controllerPublicKey` from ledger state to determine
whether the rotation finalized, then pass the address and the confirmed outcome:

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

Do not infer the outcome from elapsed time. An unresolved process-local owner
remains busy until its underlying work is cancelled and the operation settles,
the operation otherwise terminates or settles, or the process exits. Lease
expiry would be unsafe because stale provider or transaction work could still
complete and overwrite, promote, or remove state owned by a later operation.
After cancelling underlying work, reconcile ledger and private state before
starting another mutation.
