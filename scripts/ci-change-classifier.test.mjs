#!/usr/bin/env node
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyChangedFiles,
  isDocsOnlyPath,
  isSnapshotReleaseRelevantPath,
} from "./ci-change-classifier.mjs";

describe("ci-change-classifier", () => {
  it("treats markdown anywhere as docs-only", () => {
    assert.equal(isDocsOnlyPath("README.md"), true);
    assert.equal(isDocsOnlyPath("packages/api/README.md"), true);
    assert.equal(isDocsOnlyPath("AGENT.md"), true);
  });

  it("treats docs roots as docs-only even for site code and assets", () => {
    assert.equal(isDocsOnlyPath("docs/testing.md"), true);
    assert.equal(isDocsOnlyPath("docs-site/.vitepress/config.ts"), true);
    assert.equal(isDocsOnlyPath("docs-site/public/midnight-header-logo.svg"), true);
    assert.equal(isDocsOnlyPath("w3c-spec/midnight-method.md"), true);
  });

  it("normalizes relative and platform-specific path separators", () => {
    assert.equal(isDocsOnlyPath("./docs-site\\guide\\github-pages.md"), true);
    assert.equal(isDocsOnlyPath("packages\\api\\src\\index.ts"), false);
  });

  it("does not treat workflow or package source changes as docs-only", () => {
    assert.equal(isDocsOnlyPath(".github/workflows/ci.yml"), false);
    assert.equal(isDocsOnlyPath("packages/api/src/index.ts"), false);
    assert.equal(isDocsOnlyPath("packages/contract/src/did.compact"), false);
  });

  it("treats Compact, TypeScript, and script changes as snapshot-release relevant", () => {
    assert.equal(
      isSnapshotReleaseRelevantPath("packages/contract/src/did.compact"),
      true,
    );
    assert.equal(isSnapshotReleaseRelevantPath("packages/api/src/index.ts"), true);
    assert.equal(isSnapshotReleaseRelevantPath("scripts/release-resolve-context.sh"), true);
    assert.equal(isSnapshotReleaseRelevantPath("run-api.sh"), true);
  });

  it("does not treat docs, CI, security config, or manifest-only changes as snapshot-release relevant", () => {
    assert.equal(isSnapshotReleaseRelevantPath("README.md"), false);
    assert.equal(isSnapshotReleaseRelevantPath("docs-site/.vitepress/config.ts"), false);
    assert.equal(isSnapshotReleaseRelevantPath(".github/workflows/publish.yml"), false);
    assert.equal(isSnapshotReleaseRelevantPath(".github/dependabot.yml"), false);
    assert.equal(isSnapshotReleaseRelevantPath("package.json"), false);
    assert.equal(isSnapshotReleaseRelevantPath("pnpm-lock.yaml"), false);
    assert.equal(isSnapshotReleaseRelevantPath("renovate.json"), false);
  });

  it("classifies docs-only changes", () => {
    assert.deepEqual(
      classifyChangedFiles([
        "README.md",
        "docs-site/index.md",
        "w3c-spec/midnight-method.md",
      ]),
      {
        changedFiles: [
          "README.md",
          "docs-site/index.md",
          "w3c-spec/midnight-method.md",
        ],
        changedFileCount: 3,
        docsOnly: true,
        hasDocsChanges: true,
        snapshotReleaseRelevant: false,
      },
    );
  });

  it("classifies mixed docs and source changes as not docs-only", () => {
    const classification = classifyChangedFiles([
      "docs-site/index.md",
      "packages/domain/src/index.ts",
    ]);

    assert.equal(classification.docsOnly, false);
    assert.equal(classification.hasDocsChanges, true);
    assert.equal(classification.snapshotReleaseRelevant, true);
  });

  it("classifies dependency-only changes as snapshot-release irrelevant", () => {
    const classification = classifyChangedFiles([
      "package.json",
      "packages/api/package.json",
      "pnpm-lock.yaml",
    ]);

    assert.equal(classification.docsOnly, false);
    assert.equal(classification.hasDocsChanges, false);
    assert.equal(classification.snapshotReleaseRelevant, false);
  });

  it("does not classify an empty diff as docs-only", () => {
    assert.deepEqual(classifyChangedFiles([]), {
      changedFiles: [],
      changedFileCount: 0,
      docsOnly: false,
      hasDocsChanges: false,
      snapshotReleaseRelevant: false,
    });
  });
});
