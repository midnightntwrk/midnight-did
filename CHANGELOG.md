# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add DID surface-change discipline documentation and an automated guard for
  package exports, artifact packaging, workflow branch targeting, and PR review
  checklist drift.

### Changed

- BREAKING: Define the prototype offchain Midnight DID portable form as
  `did:midnight:offchain:<persistent-hash-of-state>:<encoded-state>`,
  replacing the earlier `?state=` DID URL helper surface.
- Migrate the workspace package manager from npm to pnpm 10, including
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `workspace:*` internal package
  dependencies, and exact Midnight runtime dependency pins.
- Align `pnpm run ci`, README guidance, and the PR template around
  `./run.sh --light --strict` as the local PR validation contract.
- Make `scripts/clean-artifacts.mjs` self-documenting and fail safely when an
  unknown cleanup flag is provided.
- Extend artifact cleanup to nested generated `logs/` directories and prune
  stale local-development surfaces that no longer match the `packages/` layout.
- Include explicit package `files` manifests for the `domain` and `did`
  library packages so local tarballs expose the intended runtime surface only.

### Removed

- Move resolver service, DID manager service, and reusable secret-storage
  workspaces out of this repository. Their package and service surfaces now
  live in the `midnight-did-resolver` repository.
