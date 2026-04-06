# Wallet Setup Workspace

Wallet Setup is the control plane for profile selection, shared seed handling, funding preparation, and wallet session lifecycle.

## Concept in 30 seconds

- You choose a local profile.
- You choose how to source the seed (`reuse`, `provided`, `generated`).
- You prepare funding to derive/store the unshielded address.
- You unlock to create a ready wallet session for DID operations.

## Why this page exists

This workspace isolates wallet/runtime concerns from DID mutation concerns:

- profile management
- seed continuity
- wallet sync/funds/provider readiness
- balance visibility

## Field reference

## Profile panel

| Field | Purpose | Notes |
| --- | --- | --- |
| `Active profile` | Current profile selector | Profiles are isolated per setup |
| `Create or switch profile` | Name input for profile selection | Requires `Use profile` |
| `Use profile` | Select/create and activate profile | Locks are handled by backend |
| `Refresh profiles` | Reload profile list | Icon button in panel header |

## Seed panel

| Field | Purpose | Notes |
| --- | --- | --- |
| `Seed mode` | Choose seed source | `reuse`, `provided`, `generated` |
| `Seed` | Manual seed input | Used only in `provided` mode |
| `Secret passphrase` | Override secret-store passphrase | Optional |
| `Remember unlocked session` | Persist unlock preference | Checkbox |
| `Prepare funding` | Resolve seed and derive funding address | Stores seed+address in profile |
| `Unlock` | Start wallet session | Async operation |
| `Lock` | Stop runtime session | Persists state for reusable setups |
| `Refresh status` | Force immediate status pull | Icon button in panel header |

## Funding panel

| Field | Purpose | Notes |
| --- | --- | --- |
| `Prepared funding address` | Unshielded address derived from seed | Copyable |
| `Copy` icon | Copy funding address to clipboard | Disabled when empty |
| `Faucet` | Open setup faucet URL | Clickable link (preprod only), opens in new tab |
| `Funding guidance` | Explain how to fund for active setup | Mainnet guidance explains seed-based funded wallet usage |

## State model

Wallet setup follows session phases from backend:

- `locked`
- `starting`
- `restoring`
- `syncing`
- `waitingForFunds`
- `configuringProviders`
- `ready`
- `error`

Use the badge and backend state panel to understand current phase.

## Operational guidance

1. For a new profile, set name and click `Use profile` first.
2. Use `generated` + `Prepare funding` for new bootstrap.
3. Fund address, then unlock.
4. Move to Secret Storage and DID Management only after `ready`.

## Related docs

- [DID Manager Getting Started](/guide/getting-started-did-manager)
- [Secret Storage workspace](/services/secret-storage-workspace)
- [DID Management workspace](/services/did-management-workspace)
- [DID Manager service overview](/services/did-manager-service)
