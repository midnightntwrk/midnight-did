# Wallet Setup Workspace

Wallet Setup is the control plane for profile selection, shared seed handling, funding preparation, and wallet session lifecycle.

## Concept in 30 seconds

- You choose a local profile.
- You choose how to source the seed (`reuse`, `provided`, `generated`).
- You prepare funding to derive/store the unshielded address.
- You start a session to create a ready wallet runtime for DID operations.

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
| `Use profile` | Select/create and activate profile | Session state is managed by backend |
| `Refresh profiles` | Reload profile list | Icon button in panel header |

## Seed panel

| Field | Purpose | Notes |
| --- | --- | --- |
| `Seed mode` | Choose seed source | `reuse`, `provided`, `generated` (`reuse` is disabled for brand new profiles) |
| `Seed` | Manual seed input | Used only in `provided` mode |
| `Secret passphrase` | Override secret-store passphrase | Optional |
| `Remember started session` | Persist session preference | Checkbox |
| `Prepare funding` | Resolve seed and derive funding address | Stores seed+address in profile |
| `Start Session` | Start wallet session | Async operation; enabled only after `Prepare funding` succeeds |
| `Close session` | Hard stop current runtime session | Explicitly releases backend resources and clears in-memory runtime state |
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

- `session closed` (`locked` in API payload)
- `starting`
- `restoring`
- `syncing`
- `waitingForFunds`
- `configuringProviders`
- `ready`
- `error`

Use the badge and backend state panel to understand current phase.

## Control safety model

Wallet Setup controls are gated by backend state so users cannot disrupt in-flight operations:

- while an operation is `running`, profile/seed mutation controls are disabled
- `Start Session` is enabled only when no operation is running, no session is active, and seed prerequisites are met
- `Close session` is enabled when the session is active or an operation is running
- after `Close session`, controls return to session-closed defaults and profile selection is re-enabled

## Operational guidance

1. For a new profile, set name and click `Use profile` first.
2. Use `generated` + `Prepare funding` for new bootstrap.
3. Fund address, then start the session.
4. Move to Secret Storage and DID Management only after `ready`.

## Related docs

- [DID Manager Getting Started](/guide/getting-started-did-manager)
- [Secret Storage workspace](/services/secret-storage-workspace)
- [DID Management workspace](/services/did-management-workspace)
- [DID Manager service overview](/services/did-manager-service)
