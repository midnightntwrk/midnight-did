# Runtime Shim Notes

`run.sh` invokes `scripts/ensure-onchain-runtime-cjs.mjs` before any npm target.
The script copies a pre-built CommonJS shim for
`@midnight-ntwrk/onchain-runtime` and patches that package’s `package.json`.

Why is this necessary?

- `@midnight-ntwrk/compact-runtime` depends on `@midnight-ntwrk/onchain-runtime`
  via `require(...)`.
- The published `onchain-runtime` bundle is ESM-only, so plain `require`
  fails at runtime (Node throws `ERR_REQUIRE_ESM`).
- Contract coverage/tests and the API build import `compact-runtime`, so
  without the shim, `run.sh` fails midway through the pipeline.

Until upstream publishes a CommonJS entrypoint or `compact-runtime`
switches to dynamic `import()`, the shim keeps the workspace green on any
machine (including CI) after a fresh install.
