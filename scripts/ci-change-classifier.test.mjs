#!/usr/bin/env node
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyChangedFiles,
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
  });

  it("does not classify an empty diff as docs-only", () => {
    assert.deepEqual(classifyChangedFiles([]), {
      changedFiles: [],
      changedFileCount: 0,
      docsOnly: false,
      hasDocsChanges: false,
    });
  });
});
