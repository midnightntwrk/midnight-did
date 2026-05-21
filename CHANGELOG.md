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

- Align `npm run ci`, README guidance, and the PR template around
  `./run.sh --light --strict` as the local PR validation contract.
- Make `scripts/clean-artifacts.mjs` self-documenting and fail safely when an
  unknown cleanup flag is provided.
- Include explicit package `files` manifests for the `domain` and `did`
  library packages so local tarballs expose the intended runtime surface only.

### Removed

- Move resolver service, DID manager service, and reusable secret-storage
  workspaces out of this repository. Their package and service surfaces now
  live in the `midnight-did-resolver` repository.
