# Extending Resolver

Use the resolver service when you need a clean HTTP boundary for DID resolution. Extend it when you need policy, caching, or deployment-specific behavior.

## Good extension points

1. `src/service.ts`
   Add resolver-side caching, custom resolution policies, or extra diagnostics.
2. `src/app.ts`
   Add HTTP routes, authentication, or request/response shaping.
3. `src/config.ts`
   Add deployment-specific config validation and defaults.
4. `src/ui.ts`
   Extend the browser UI without changing the underlying resolver contract.

## Safe changes

- add metrics and structured logging
- add cache headers or in-memory result caching
- add deployment-time auth in front of `/resolve`
- add alternate output formatting while preserving DID Resolution Result shape

## Changes to avoid casually

- changing `didResolutionMetadata` semantics
- coupling the resolver directly to manager-specific state
- introducing mutable DID operations into the resolver service

## Recommended deployment hardening

- put the service behind a reverse proxy
- enable TLS termination at the edge
- restrict docs/UI exposure if used beyond local/dev
- keep network/profile configuration explicit
