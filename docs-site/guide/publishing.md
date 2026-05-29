# Publishing

The repository publishes a VitePress site from `docs-site/`.

## Local Build

```bash
pnpm install
pnpm run docs:build
```

Preview the built site:

```bash
pnpm run docs:preview
```

Run the same docs lane used by CI:

```bash
./run.sh docs
```

## What The Default Build Does

The default docs build is intentionally small:

1. sync selected repository markdown into `docs-site/source/`
2. build VitePress static output into `docs-site/.vitepress/dist/`

It does not compile Compact contracts, rebuild managed artifacts, run TypeDoc,
or start Docker-backed tests.

## Optional API Reference

Generated TypeDoc pages remain available as a local maintenance tool:

```bash
pnpm run docs:api
```

This is not part of the default Pages build because it compiles package outputs
and is too heavy for docs-only CI.

## Pages Deployment

See [GitHub Pages](/guide/github-pages) for the repository setting and workflow
behavior.
