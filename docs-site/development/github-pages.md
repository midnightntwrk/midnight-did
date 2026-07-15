# GitHub Pages

The docs site is built with VitePress and published by GitHub Actions.

## Repository Setting

Configure the repository once:

1. Open `Settings -> Pages`.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Keep the `github-pages` environment enabled.

Do not use `Deploy from a branch`; the site has a build step and should deploy
the artifact produced by `.github/workflows/docs.yml`.

The workflow assumes the Pages site already exists. It verifies that the
repository is configured for workflow-based Pages publishing, but it does not
try to create or enable the Pages site on every run because the GitHub Actions
token cannot reliably mutate repository Pages settings. If the UI setting needs
to be repaired by an administrator, this equivalent API command enables
workflow-based Pages publishing:

```bash
gh api --method POST repos/midnightntwrk/midnight-did/pages -f build_type=workflow
```

Verify the repository setting with:

```bash
gh api repos/midnightntwrk/midnight-did/pages --jq '{html_url, build_type}'
```

## Published URL

For the organization repository, the default Pages URL is:

```text
https://midnightntwrk.github.io/midnight-did/
```

The VitePress base path is derived from `GITHUB_REPOSITORY` during GitHub
Actions builds. For a custom domain, set `DOCS_BASE=/` in the workflow or
repository environment.

The published site follows `develop`, not `main`. Treat merges to `develop` as
public documentation releases.

Published pages may be read by people who cannot access every Midnight GitHub
repository. Follow the [public/private link policy](/development/public-private-links)
when adding source links or references to access-restricted repositories.

## Workflow Behavior

- Pull requests to `main` or `develop`: build the docs only.
- Pushes to `develop`: build and deploy to GitHub Pages.
- Manual workflow dispatch: deploy only when the selected ref is `develop`.
- Deploys smoke-check the published root page, quickstart guide, API page, and
  method specification.

The workflow needs the standard Pages permissions:

- `contents: read`
- `pages: write`
- `id-token: write`

The default docs build is Markdown-first. It synchronizes the published spec
pages from `w3c-spec/` and builds the static site with Mermaid diagram support,
without compiling Compact contracts or running Docker-backed integration tests.
