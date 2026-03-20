# Publishing

The docs site is built with VitePress and is intended to be published as GitHub Pages for this repository.

## Local build

```bash
npm install
npm run docs:build
```

The local preview server uses the root path:

```bash
npm run docs:preview
```

## GitHub Pages behavior

When the docs workflow runs on GitHub Actions, the VitePress `base` path is set automatically from the repository name.

For this repository that means:

- local: `/`
- GitHub Pages: `/midnight-did/`

The config is implemented in:

- `docs-site/.vitepress/config.ts`

## Deployment workflow

The workflow:

1. checks out the repository
2. installs dependencies with `npm ci`
3. syncs repository markdown into internal docs pages
4. generates API reference from TypeScript entry points
5. builds the site with `npm run docs:build`
6. uploads the VitePress output as a Pages artifact
7. deploys it to GitHub Pages

Workflow file:

- `.github/workflows/docs.yml`

## Repository settings

GitHub Pages must be configured to use the workflow-based deployment model.

Repository configuration:

1. Open `Settings -> Pages`
2. In `Build and deployment`
3. Set `Source` to `GitHub Actions`

Do not use the older `Deploy from a branch` mode for this repository.

Reason:

- the docs site has a build step
- the build also generates:
  - mirrored source markdown pages
  - TypeDoc API reference
- the recommended GitHub Pages flow for this is artifact deployment through Actions, not pushing built files to a `gh-pages` branch

## Branch behavior

- pushes to `main`:
  - build and deploy
- `workflow_dispatch`:
  - build on the selected ref
  - deploy only when the ref is `main`

This keeps manual docs verification available on branches without accidentally publishing preview content as the production Pages site.
