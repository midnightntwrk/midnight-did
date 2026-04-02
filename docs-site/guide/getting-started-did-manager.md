# DID Manager Getting Started

This guide walks through the complete DID Manager flow and links each step to the detailed workspace documentation.

## Before you start

1. Start the manager:

```bash
./start-manager.sh --standalone
# or
./start-manager.sh --preprod
```

2. Open the UI at `http://127.0.0.1:3010/wallet`.
3. Keep the API docs open in a second tab at `http://127.0.0.1:3010/docs`.

## Quick flow

1. Configure profile and seed on **Wallet Setup**.
2. Prepare funding and fund the unshielded address.
3. Unlock wallet session and wait for `Ready`.
4. Open **Secret Storage** and create/import a key.
5. Open **DID Management** and deploy/join a DID contract.
6. Publish and update methods/services/aliases.

## Detailed guides

- [Wallet Setup workspace](/services/wallet-setup)
- [Secret Storage workspace](/services/secret-storage-workspace)
- [DID Management workspace](/services/did-management-workspace)

## Seed model

The manager intentionally uses one shared seed for wallet continuity and DID continuity.

| Seed mode | Meaning | Typical usage |
| --- | --- | --- |
| `reuse` | Use stored seed from active profile | Daily operation with known profile |
| `provided` | Paste explicit seed | Recover known wallet/profile |
| `generated` | Create new seed | New profile bootstrap |

When `generated` is used for `Prepare funding`, the UI stores the generated seed in the seed field and switches to `provided` mode so unlock uses the same seed deterministically.

## Common operator checklist

1. Confirm active setup and profile in top-right profile panel.
2. Confirm `Seed continuity` shows stored or prepared seed status.
3. Confirm funding address exists before opening faucet.
4. Confirm wallet session phase reaches `Ready` before DID operations.
5. Confirm DID contract is `Joined` before mutating DID document.

## Troubleshooting

### Prepare funding appears to do nothing

- Check `Last API Result` and operation log for accepted operation id.
- Check `/api/operations/current` to verify the operation is running.
- Confirm you clicked `Use profile` if you typed a new profile name.
- On preprod, ensure endpoint/proof server reachability.

### Unlock remains in sync/funding states

- Check wallet balance panel (`NIGHT / tNIGHT`, `DUST`).
- Check faucet funding actually reached the prepared address.
- Check backend state panel for phase and last error.

### Seed mode changes after generated flow

This is expected after successful generated prepare/unlock: generated seed is copied into the seed field and mode switches to `provided` to preserve continuity for the next action.
