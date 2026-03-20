# Services

The workspace currently includes two service-style applications.

## Services

| Service | Purpose | Main source doc |
|---|---|---|
| `did-resolver-service` | REST API and UI for DID resolution | `did-resolver-service/README.md` |
| `did-manager-service` | Wallet setup and DID lifecycle management UI/backend | `did-manager-service/README.md` |

## Service split

- Use the resolver when you only need DID resolution and DID Resolution Result responses.
- Use the manager when you need wallet preparation, profile persistence, and mutating DID operations.

## Extension guides

- [Extending Resolver](/services/did-resolver-extension)
- [Extending Manager](/services/did-manager-extension)
