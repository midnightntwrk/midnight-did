import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  markdownAnchors,
  routeForMarkdownFile,
  slugify,
  validateLinks,
} from "./docs-validate.mjs";

test("slugify matches generated VitePress heading anchors used by docs", () => {
  assert.equal(slugify("3.4.4. publicKeyJwk"), "344-publickeyjwk");
  assert.equal(
    slugify("Trusted proof server model"),
    "trusted-proof-server-model",
  );
});

test("markdownAnchors adds duplicate heading suffixes", () => {
  assert.deepEqual(
    [...markdownAnchors("# Title\n\n## Repeat\n\n## Repeat\n")],
    ["title", "repeat", "repeat-1"],
  );
});

test("routeForMarkdownFile supports clean VitePress routes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "docs-validate-"));
  try {
    assert.equal(routeForMarkdownFile(resolve(root, "index.md"), root), "/");
    assert.equal(
      routeForMarkdownFile(resolve(root, "guide", "index.md"), root),
      "/guide/",
    );
    assert.equal(
      routeForMarkdownFile(resolve(root, "guide", "quickstart.md"), root),
      "/guide/quickstart",
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("validateLinks accepts local clean routes and reports missing anchors", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "docs-validate-"));
  try {
    await writeFile(
      resolve(root, "index.md"),
      "# Home\n\n[Guide](/guide/quickstart#install)\n",
    );
    await mkdir(resolve(root, "guide"), { recursive: true });
    await writeFile(
      resolve(root, "guide", "quickstart.md"),
      "# Quickstart\n\n## Install\n",
    );

    assert.deepEqual(await validateLinks(root), []);

    await writeFile(
      resolve(root, "index.md"),
      "# Home\n\n[Guide](/guide/quickstart#missing)\n",
    );
    const failures = await validateLinks(root);
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /broken anchor 'missing'/u);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("validateLinks accepts public and relative asset links", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "docs-validate-"));
  try {
    await mkdir(resolve(root, "public"), { recursive: true });
    await writeFile(resolve(root, "public", "logo.svg"), "<svg></svg>\n");

    await mkdir(resolve(root, "guide", "assets"), { recursive: true });
    await writeFile(resolve(root, "guide", "assets", "diagram.svg"), "<svg></svg>\n");
    await writeFile(
      resolve(root, "guide", "index.md"),
      "# Guide\n\n![Logo](/logo.svg)\n\n![Diagram](./assets/diagram.svg)\n",
    );

    assert.deepEqual(await validateLinks(root), []);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
