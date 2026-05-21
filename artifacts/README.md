# Artifacts

Generated tarballs live under `artifacts/npm/`.

Purpose:
- provide a stable, local packaging target for unpublished workspace packages
- avoid ad hoc tarball surgery in downstream repos
- make it easy to copy known-good artifacts into downstream `libs/` directories

Commands:

```bash
npm run artifacts:pack
./upgrade-libs.sh --destination /path/to/downstream-repo
node scripts/clean-artifacts.mjs --dry-run --json
```

Notes:
- `artifacts/npm/*.tgz` are generated outputs and are gitignored.
- These tarballs are a bootstrap/distribution seam, not a replacement for real published packages.
- Use the dry-run cleanup report before deleting generated artifacts from a
  worktree that may contain historical package shells.
