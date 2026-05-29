# API

The default docs site does not publish generated TypeDoc pages.

Use the package pages for the stable public surface:

- [Domain package](/packages/domain)
- [DID package](/packages/did)
- [API package](/packages/api)

For local API archaeology, run:

```bash
pnpm run docs:api
```

That command generates TypeDoc output under `docs-site/api/reference/`. It is
intentionally excluded from the default GitHub Pages build so docs-only changes
do not compile Compact contracts or package outputs.
