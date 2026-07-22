# Public and Private Links

Published documentation can be read by people who cannot access every Midnight
GitHub repository. Write links so public readers still understand the design,
even when a source repository or implementation detail requires organization
access.

## Policy

- Prefer published docs pages over source links when the reader needs a concept,
  workflow, or stable API contract.
- Link to source only when the exact implementation location matters, such as a
  Compact circuit, example file, package entry point, or owning repository.
- Treat links to private GitHub repositories as access-required references. The
  surrounding sentence must say what the target contains so the page remains
  useful without access.
- Do not use a private source link as the only explanation of behavior that
  public readers need to understand.
- Use public upstream links for external standards, specifications, and public
  dependencies.
- Avoid branch- or line-specific GitHub links unless the target must be pinned
  for historical accuracy. Prefer docs pages or repository-root links for
  ongoing contributor guidance.

Good access-required wording:

```md
Resolver service and manager workflows live in
[`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver)
(organization access required).
```

## Validation Expectations

Local docs links and anchors are strict. Relative links, VitePress routes,
headings, generated spec pages, and in-repository assets should resolve during
local and CI validation.

External GitHub links to private Midnight repositories are different: they can
be syntactically valid and intentionally access-restricted. Validation should not
treat an unauthenticated `404` or `403` for those links as a public availability
failure. If a validator reports them, classify the result as access-required
rather than broken, then confirm the repository name and target are still the
right owner reference.

## Current Private Link Inventory

The published docs currently do not require access to private Midnight
repositories. The repository links used by the site point to public GitHub
repositories:

- `midnight-did`, for source files that back this documentation site and method
  specification.
- `midnight-did-resolver`, for resolver services, manager workflows, secret
  storage, endpoint surfaces, and local key-custody flows.
- `midnight-verifiable-credentials`, for VC/VP packages, credential families,
  status/revocation, and presentation workflows.
- `midnight-trust-registry`, for registry governance and trust-list integration.

If a future docs page must link to a private Midnight repository, add that
repository to the access-required inventory in `scripts/docs-validate.mjs` and
include an access-required caveat next to the link. Keep the inventory by
repository and purpose rather than maintaining a complete URL list.
