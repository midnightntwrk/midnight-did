#!/usr/bin/env node
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyChangedFiles,
  isCodeImpactingPath,
  isDocsOnlyPath,
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

  it("does not treat maintenance-only changes as code-impacting", () => {
    assert.equal(isCodeImpactingPath("CODEOWNERS"), false);
    assert.equal(isCodeImpactingPath(".github/workflows/ci.yml"), false);
    assert.equal(isCodeImpactingPath(".github/dependabot.yml"), false);
    assert.equal(isCodeImpactingPath("renovate.json"), false);
  });

  it("treats build and package inputs as code-impacting", () => {
    assert.equal(isCodeImpactingPath("package.json"), true);
    assert.equal(isCodeImpactingPath("pnpm-lock.yaml"), true);
    assert.equal(isCodeImpactingPath("flake.nix"), true);
    assert.equal(isCodeImpactingPath("run.sh"), true);
    assert.equal(isCodeImpactingPath("scripts/check-workspace-manifests.mjs"), true);
    assert.equal(isCodeImpactingPath("packages/api/package.json"), true);
    assert.equal(isCodeImpactingPath("packages/api/src/index.ts"), true);
    assert.equal(isCodeImpactingPath("packages/contract/src/did.compact"), true);
  });

  it("does not treat package markdown or docs-site code as rebuild-relevant source", () => {
    assert.equal(isCodeImpactingPath("packages/api/README.md"), false);
    assert.equal(isCodeImpactingPath("docs-site/.vitepress/config.ts"), false);
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
        codeChanged: false,
        docsOnly: true,
        hasDocsChanges: true,
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
    assert.equal(classification.codeChanged, true);
  });

  it("classifies maintenance-only changes as non-code", () => {
    assert.deepEqual(
      classifyChangedFiles([
        ".github/workflows/ci.yml",
        "CODEOWNERS",
        "renovate.json",
      ]),
      {
        changedFiles: [
          ".github/workflows/ci.yml",
          "CODEOWNERS",
          "renovate.json",
        ],
        changedFileCount: 3,
        codeChanged: false,
        docsOnly: false,
        hasDocsChanges: false,
      },
    );
  });

  it("does not classify an empty diff as docs-only", () => {
    assert.deepEqual(classifyChangedFiles([]), {
      changedFiles: [],
      changedFileCount: 0,
      codeChanged: false,
      docsOnly: false,
      hasDocsChanges: false,
    });
  });
});
