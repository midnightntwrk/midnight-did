import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  markdownAnchors,
  routeForMarkdownFile,
  slugify,
  validateAccessRequiredLinks,
  validateContentRules,
  validateReleaseDocExamples,
  validateLinks,
} from "./docs-validate.mjs";
import {
  generateNetworkEndpointsMarkdown,
  parseNetworkProfiles,
} from "../docs-site/scripts/sync-network-endpoints.mjs";

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

test("parseNetworkProfiles extracts the canonical API profile matrix", () => {
  const profiles = parseNetworkProfiles(`
    export const MIDNIGHT_NETWORK_PROFILES = {
      standalone: {
        name: "standalone",
        networkId: "undeployed",
        endpoints: {
          indexer: "http://127.0.0.1:8088/api/v4/graphql",
          indexerWS: "ws://127.0.0.1:8088/api/v4/graphql/ws",
          node: "http://127.0.0.1:9944",
          proofServer: "http://127.0.0.1:6300",
        },
      },
      "testnet-local": {
        name: "testnet-local",
        networkId: "testnet",
        endpoints: {
          indexer: "http://127.0.0.1:8088/api/v4/graphql",
          indexerWS: "ws://127.0.0.1:8088/api/v4/graphql/ws",
          node: "http://127.0.0.1:9944",
          proofServer: "http://127.0.0.1:6300",
        },
      },
      "testnet-remote": {
        name: "testnet-remote",
        networkId: "testnet",
        endpoints: {
          indexer: "https://indexer.testnet-02.midnight.network/api/v4/graphql",
          indexerWS: "wss://indexer.testnet-02.midnight.network/api/v4/graphql/ws",
          node: "https://rpc.testnet-02.midnight.network",
          proofServer: "http://127.0.0.1:6300",
        },
      },
      preprod: {
        name: "preprod",
        networkId: "preprod",
        endpoints: {
          indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
          indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
          node: "https://rpc.preprod.midnight.network",
          proofServer: "http://127.0.0.1:6300",
        },
      },
      mainnet: {
        name: "mainnet",
        networkId: "mainnet",
        endpoints: {
          indexer: "https://indexer.mainnet.midnight.network/api/v4/graphql",
          indexerWS: "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws",
          node: "https://rpc.mainnet.midnight.network",
          proofServer: "http://127.0.0.1:6300",
        },
      },
    } as const satisfies Record<string, MidnightNetworkProfile>;
  `);

  assert.equal(
    profiles.standalone.endpoints.indexer,
    "http://127.0.0.1:8088/api/v4/graphql",
  );
  const generatedMarkdown = generateNetworkEndpointsMarkdown(profiles);
  assert.match(generatedMarkdown, /ProfileConfig\("mainnet"\)/u);
  assert.match(
    generatedMarkdown,
    /All shipped profiles currently use indexer GraphQL `v4`/u,
  );
  assert.doesNotMatch(generatedMarkdown, /GraphQL `v3`/u);
});

test("network endpoint docs generated from real profiles stay on GraphQL v4", async () => {
  const source = await readFile(
    resolve("packages/api/src/config-profiles.ts"),
    "utf8",
  );
  const profiles = parseNetworkProfiles(source);
  const generatedMarkdown = generateNetworkEndpointsMarkdown(profiles);

  for (const profile of Object.values(profiles)) {
    assert.match(profile.endpoints.indexer, /\/api\/v4\/graphql$/u);
    assert.match(profile.endpoints.indexerWS, /\/api\/v4\/graphql\/ws$/u);
  }

  assert.match(
    generatedMarkdown,
    /All shipped profiles currently use indexer GraphQL `v4`/u,
  );
  assert.doesNotMatch(generatedMarkdown, /GraphQL `v3`/u);
});

test("validateContentRules reports stale endpoints and spec labels", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "docs-validate-"));
  try {
    await mkdir(resolve(root, "docs-site"), { recursive: true });
    await mkdir(resolve(root, "w3c-spec"), { recursive: true });
    await mkdir(resolve(root, "packages", "api"), { recursive: true });
    await writeFile(resolve(root, "README.md"), "# Home\n");
    await writeFile(
      resolve(root, "docs-site", "index.md"),
      "# Home\n\nUse http://127.0.0.1:18088/api/v1/graphql\n\nGraphQL `v3`\n",
    );
    await writeFile(
      resolve(root, "w3c-spec", "midnight-method.md"),
      "# Midnight DID Specification Draft v0.2\n",
    );
    await writeFile(resolve(root, "packages", "api", "README.md"), "# API\n");

    const failures = await validateContentRules(root);
    assert.equal(failures.length, 4);
    assert.deepEqual(
      failures.map((failure) => failure.message).sort(),
      [
        "stale indexer GraphQL v3 prose; use /guide/network-endpoints profile defaults",
        "stale Midnight DID specification version label",
        "stale indexer GraphQL v1 endpoint; use /guide/network-endpoints profile defaults",
        "stale standalone endpoint port; use /guide/network-endpoints profile defaults",
      ].sort(),
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("validateContentRules catches retired controller-secret witness prose", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "docs-validate-"));
  try {
    await mkdir(resolve(root, "docs-site", "scripts"), { recursive: true });
    await mkdir(resolve(root, "w3c-spec"), { recursive: true });
    await writeFile(resolve(root, "docs-site", "index.md"), "# Home\n");
    await writeFile(
      resolve(root, "w3c-spec", "midnight-method.md"),
      "The secret key is provided as a witness to authorize updates.\n",
    );
    await writeFile(
      resolve(root, "docs-site", "scripts", "sync-network-endpoints.mjs"),
      "Treat the remote service as trusted with controller-secret witness material.\n",
    );

    const failures = await validateContentRules(root);
    assert.equal(failures.length, 2);
    assert.deepEqual(
      failures.map((failure) => failure.message),
      [
        "stale controller-secret authorization model; document wallet-local signatures instead",
        "stale controller-secret authorization model; document wallet-local signatures instead",
      ],
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("validateAccessRequiredLinks requires a caveat for private repo links", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "docs-validate-"));
  try {
    await writeFile(
      resolve(root, "index.md"),
      [
        "# Home",
        "",
        "[Resolver](https://github.com/midnightntwrk/midnight-did-resolver)",
      ].join("\n"),
    );

    const accessRequiredRepos = new Set(["midnight-did-resolver"]);
    const failures = await validateAccessRequiredLinks(root, accessRequiredRepos);
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /access-restricted GitHub link/u);

    await writeFile(
      resolve(root, "index.md"),
      [
        "# Home",
        "",
        "[Resolver](https://github.com/midnightntwrk/midnight-did-resolver)",
        "(organization access required).",
      ].join("\n"),
    );

    assert.deepEqual(
      await validateAccessRequiredLinks(root, accessRequiredRepos),
      [],
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("validateReleaseDocExamples rejects stale documented release trains", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "docs-validate-release-"));
  try {
    await writeFile(
      resolve(root, "package.json"),
      `${JSON.stringify({ version: "0.5.0" })}\n`,
    );
    await mkdir(resolve(root, "docs-site", "development"), { recursive: true });
    await writeFile(
      resolve(root, "README.md"),
      [
        "[![Latest Release](https://img.shields.io/badge/release-v0.4.0-blue)](https://example.test)",
        'export VERSION="0.4.0-snapshot.local"',
        'export ZK_ARCHIVE="artifacts/zk/midnight-did-zk-artifacts-${VERSION}.tar.gz"',
        'export VERSION="0.4.0-rc1"',
        "",
      ].join("\n"),
    );
    await writeFile(
      resolve(root, "docs-site", "development", "publishing.md"),
      [
        'export VERSION="0.4.0-snapshot.local"',
        'export ZK_ARCHIVE="artifacts/zk/midnight-did-zk-artifacts-${VERSION}.tar.gz"',
        'export VERSION="0.4.0-snapshot.<run>.<sha>"',
        'export OCI_REF="ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${VERSION}"',
        'export VERSION="0.4.0-rc1"',
        "",
      ].join("\n"),
    );

    const failures = await validateReleaseDocExamples(root);

    assert.ok(failures.length > 0);
    assert.ok(
      failures.some((failure) =>
        failure.message.includes("stale release train '0.4.0'"),
      ),
    );
    assert.ok(
      failures.some((failure) =>
        failure.message.includes("missing release doc example"),
      ),
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("validateReleaseDocExamples accepts an unreleased source baseline with the published badge", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "docs-validate-release-"));
  try {
    await writeFile(
      resolve(root, "package.json"),
      `${JSON.stringify({ version: "0.6.0" })}\n`,
    );
    await mkdir(resolve(root, "docs-site", "development"), { recursive: true });
    await writeFile(
      resolve(root, "README.md"),
      [
        "[![Latest Release](https://img.shields.io/badge/release-v0.5.0-blue)](https://example.test)",
        'export VERSION="0.6.0-snapshot.local"',
        'export ZK_ARCHIVE="artifacts/zk/midnight-did-zk-artifacts-${VERSION}.tar.gz"',
        'export VERSION="0.6.0-rc1"',
        "",
      ].join("\n"),
    );
    await writeFile(
      resolve(root, "docs-site", "development", "publishing.md"),
      [
        'export VERSION="0.6.0-snapshot.local"',
        'export ZK_ARCHIVE="artifacts/zk/midnight-did-zk-artifacts-${VERSION}.tar.gz"',
        'export VERSION="0.6.0-snapshot.<run>.<sha>"',
        'export OCI_REF="ghcr.io/midnightntwrk/midnight-did-zk-artifacts:${VERSION}"',
        'export VERSION="0.6.0-rc1"',
        "",
      ].join("\n"),
    );

    assert.deepEqual(await validateReleaseDocExamples(root), []);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
