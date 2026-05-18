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

- Include explicit package `files` manifests for the `domain` and `did`
  library packages so local tarballs expose the intended runtime surface only.
