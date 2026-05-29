# GitHub Pages

The docs site is built with VitePress and published by GitHub Actions.

## Repository Setting

Configure the repository once:

1. Open `Settings -> Pages`.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Keep the `github-pages` environment enabled.

Do not use `Deploy from a branch`; the site has a build step and should deploy
the artifact produced by `.github/workflows/docs.yml`.

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

## Workflow Behavior

- Pull requests to `main` or `develop`: build the docs only.
- Pushes to `develop`: build and deploy to GitHub Pages.
- Manual workflow dispatch: deploy only when the selected ref is `develop`.

The workflow needs the standard Pages permissions:

- `contents: read`
- `pages: write`
- `id-token: write`

The default docs build is Markdown-first. It syncs source markdown from the repo
and builds the static site with Mermaid diagram support, without compiling
Compact contracts or running Docker-backed integration tests.
