# Migrating to 1.0

> **Local migration candidate.** This document records the approved
> Ledger9-only policy, the required replacement-deployment procedure, and local
> Ledger9 integration evidence. The candidate is **not published** and is not a
> 1.0 release claim; see the compatibility matrix for the current candidate
> status and retained historical baselines.

Midnight DID 1.0 targets **midnight-ledger v9** and the Midnight JS 5 family. It is
a toolchain and runtime migration, not a transparent contract upgrade.

This release is Ledger9-only. It does not retain a dual-era API or an
original-artifact operating path for Ledger8 DIDs.

## Compatibility cohort

The repository pins one coordinated cohort. Candidate local evidence and
retained historical baselines are recorded in the
[compatibility matrix](./compatibility.md); the candidate remains unpublished.

| Component                            | 1.0 cohort                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Compact compiler                     | `0.36.0`                                                                    |
| `compact-runtime`                    | `0.21.0`                                                                    |
| `compact-js`                         | `3.0.0`                                                                     |
| Ledger package                       | `@midnightntwrk/ledger-v9@1.0.0`                                            |
| Midnight JS family                   | `5.0.0`                                                                     |
| Wallet SDK facade family             | facade `5.0.0`, hd/shielded/unshielded/address-format `4.0.0`, dust `5.0.0` |
| Proof server                         | `9.0.1`                                                                     |
| Node / indexer (standalone topology) | `2.1.101` / `4.4.101`                                                       |

Compact `0.36.0` emits ZKIR v3 only. Recompiling the same Compact source
therefore produces **different verifier keys** from a Ledger8 deployment.
Artifacts are not interchangeable across the two toolchains.

### Temporary SDK resolution for consumer applications

**Repository-root overrides do not propagate when you install the DID
libraries.** The selected SDK includes `@midnight-ntwrk/platform-js@3.0.0`,
whose declared Effect-platform range does not include the security-fixed
`0.97.2`. Until a supported parent fix is adopted, an application needs an
explicit, temporary parent-scoped resolution in its own `package.json`.

Merge the applicable fields below with your existing application dependencies.
Keep `effect@3.22.4` and the SDK/runtime/wallet cohort above; do not replace the
SDK cohort or force unrelated Effect versions to silence an audit.

For pnpm:

```json
{
  "dependencies": {
    "effect": "3.22.4"
  },
  "pnpm": {
    "overrides": {
      "@midnight-ntwrk/platform-js@3.0.0>@effect/platform": "0.97.2"
    }
  }
}
```

For npm:

```json
{
  "dependencies": {
    "effect": "3.22.4"
  },
  "overrides": {
    "@midnight-ntwrk/platform-js@3.0.0": {
      "@effect/platform": "0.97.2"
    }
  }
}
```

Reinstall and inspect the application's actual lockfile: platform-js `3.0.0`
must resolve Effect-platform `0.97.2`, with compatible `effect@3.22.4`. Run the
application's audit and runtime/wallet tests against that graph. This is an
interim compatibility choice, not an automatic downstream fix, an audit
exemption, or a whole-application safety guarantee.

Remove the override after adopting an upstream-supported parent/cohort fix
that no longer needs this out-of-range resolution and passes application
validation. Reconsider it whenever the parent version changes; the selector
intentionally applies only to platform-js `3.0.0`. Detailed rationale and
removal obligations are retained in the repository's
`docs/security-compatibility-overrides.md`.

Do **not** copy the repository's TypeDoc, glob, lint or documentation-tooling
overrides into a runtime application as part of this SDK workaround. Manage
application tooling separately.

## Dust readiness uses indexed block time

`registerForDustGeneration(wallet, keystore, readinessOptions)` now requires a
third argument. Supply an indexed-block-time reader so SDK5 values Dust at the
chain time the wallet has indexed, not at wall-clock time:

```ts
import {
  createIndexerIndexedBlockTime,
  registerForDustGeneration,
} from "@midnight-ntwrk/midnight-did-api";

await registerForDustGeneration(wallet, unshieldedKeystore, {
  indexedBlockTime: createIndexerIndexedBlockTime(config.indexer),
  timeoutMs: 120_000,
});
```

The argument is part of the 1.0 breaking API. There is no implicit wall-clock or
existing-coin fallback: early genesis coins can have a zero initial Dust value
even when a wall-clock balance is positive. `timeoutMs`, `pollIntervalMs`, and
`signal` are optional bounded controls; readiness still requires a positive Dust
balance at the supplied indexed time.

## Existing Ledger8 DIDs: replacement deployment

There is no automatic in-place migration in this release.

1. Preserve any evidence you need from the old deployment independently. The
   1.0 API does not find or call a pre-Ledger9 contract through its Ledger8
   artifacts.
2. Deploy a new DID with the 1.0 artifacts and the new controller/recovery
   material.
3. Re-create the DID Document, services, aliases, verification methods, and
   relationships on the new DID.
4. Re-point resolvers, caches, credential bindings, and downstream references
   to the new DID.

The replacement has a **new DID identifier and contract address**. On-chain
state, `created`, `version`, `operationCount`, controller history, and recovery
authority are **not transferred automatically**. Do not assume continuity of
identifier, history, or signatures across the replacement.

Deploying at a replacement address requires controller-authorized creation of
the new state. It does not require modifying or re-keying the old contract.

## Contract Maintenance Authority

The on-chain Contract Maintenance Authority (CMA) and verifier-key refresh are
separate from this migration. Issue
[#244](https://github.com/midnightntwrk/midnight-did/issues/244) owns the
maintenance/export API and its custody model. Midnight DID 1.0 does not expose
`insertVerifierKey`, `removeVerifierKey`, `replaceAuthority`, or signing-key
export as part of this upgrade.

Losing the CMA signing key still removes future maintenance capability, but it
does not by itself deactivate the DID or prevent ordinary controller-authorized
operations. See the method specification for the current custody posture.

## Toolchain and validation

From a source checkout in the repository Nix shell, verify that the compiler
banner reports `0.36.0`. The shell already exports an immutable, pinned
`COMPACT_DIRECTORY`; do not update that toolchain or change the global manager
configuration from this recipe.

```bash
pnpm install --frozen-lockfile
compact compile --version
pnpm run verify
./run.sh --strict
pnpm run check:managed-artifacts
pnpm run packages-smoke-tests
pnpm run artifacts:pack
./run.sh check-integration
```

The Ledger9 integration gates use the standalone node, indexer, and proof-server
pins in `packages/api/standalone.yml`. Image availability alone is not evidence
that a topology is compatible; only the integration run is.

## Unsupported combinations

- Ledger8 DID artifacts or contracts operated through the 1.0 API.
- Compact `0.31`–`0.35` artifacts. The framework recognises only runtime `0.16`
  (Ledger8) and `0.21` (Ledger9); the 1.0 DID API is Ledger9-only.
- Operating a Ledger8 public API/contract path alongside Ledger9. SDK5 and
  `compact-js@3` may retain internal transitive Ledger8 packages in the same
  install; those copies are implementation details, not a supported Ledger8
  operation path. Do not mix objects or WASM from different ledger runtimes.
- Assuming that a recompiled 1.0 artifact set fits a contract deployed with
  earlier verifier keys.

## Rollback

There is no in-place rollback. Keep the previous release's package/artifact set
and the old deployment evidence if you may need to operate or inspect the old
DID with the previous release. A rollback is a separate deployment decision, not
a state transition performed by 1.0.
