# Artifacts

Generated tarballs live under `artifacts/npm/`. Generated ZK artifact bundles
live under `artifacts/zk/`.

Purpose:
- provide a stable, local packaging target for unpublished workspace packages
- avoid ad hoc tarball surgery in downstream repos
- make it easy to copy known-good artifacts into downstream `libs/` directories

Commands:

```bash
pnpm run artifacts:pack
./upgrade-libs.sh --destination /path/to/downstream-repo
node scripts/clean-artifacts.mjs --dry-run --json
pnpm run zk-artifacts:bundle -- --version 0.5.0-snapshot.local
```

Notes:
- `artifacts/npm/*.tgz` are generated outputs and are gitignored.
- `artifacts/zk/*` files are generated outputs and are gitignored.
- Local tarballs are a bootstrap distribution path until consumers use the
  published packages. ZK bundles remain separate because generated prover,
  verifier, and ZKIR files are runtime assets consumed by ZK config providers.
- Use the dry-run cleanup report before deleting generated artifacts, nested
  local log directories, or historical package shells from a worktree.
