#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadAndValidateBaseline } from "./external-conformance-lib.mjs";

const baseline = loadAndValidateBaseline(
  new URL("../../w3c-spec/conformance/external-suites.json", import.meta.url),
);
const readmePath = fileURLToPath(
  new URL("../../w3c-spec/conformance/README.md", import.meta.url),
);
const begin = "<!-- BEGIN EXTERNAL SUITE BASELINE -->";
const end = "<!-- END EXTERNAL SUITE BASELINE -->";
const tableRows = [
  ["Standard", "0.6 status", "Immutable baseline", "SHA-256"],
  ...baseline.standards.map(({ name, status, url, sha256 }) => [
    name,
    status,
    `[dated snapshot](${url})`,
    `\`${sha256}\``,
  ]),
];
const widths = tableRows[0].map((_, column) =>
  Math.max(...tableRows.map((row) => row[column].length)),
);
const tableLine = (row) =>
  `| ${row.map((cell, column) => cell.padEnd(widths[column])).join(" | ")} |`;
const table = [
  tableLine(tableRows[0]),
  tableLine(widths.map((width) => "-".repeat(width))),
  ...tableRows.slice(1).map(tableLine),
].join("\n");
const selectedSuiteSummary = baseline.selectedSuites
  .map((suite) => `\`${suite}\` (${baseline.expectedAssertions[suite]})`)
  .join(", ");
const section = `${begin}

## External DID Core suite evidence

The machine-readable source of truth is [\`external-suites.json\`](./external-suites.json). This section is rendered from that baseline; edit the JSON and rerun \`pnpm conformance:external:docs\` rather than editing this block.

${table}

The supplementary harness is [\`w3c/did-test-suite\`](${baseline.upstream.repository}) at commit \`${baseline.upstream.commit}\` (archive SHA-256 \`${baseline.upstream.archiveSha256}\`; complete extracted-tree SHA-256 \`${baseline.upstream.extractedTreeSha256}\`). It runs only these suites, with pinned expected assertion counts: ${selectedSuiteSummary}. They execute against a deterministic descriptor generated through the built public \`@midnight-ntwrk/midnight-did\` exports. \`did-consumption\` is labelled representation consumability because generation first round-trips the JSON-LD representation through \`parseMidnightDIDDocument\`; it is not broader semantic conformance.

Excluded scope: ${baseline.excludedSuites.join("; ")}.

Upstream licensing is **${baseline.upstream.license.status}**: root metadata says ${baseline.upstream.license.rootMetadata}, \`LICENSE.md\` applies the ${baseline.upstream.license.notice}, and child package metadata is ${baseline.upstream.license.childPackageMetadata}. [Maintainer approval is recorded](${baseline.upstream.license.approvalRecord}) for executing the unmodified checksum-verified snapshot and publishing exact-commit derived test results with this caveat. The CI-only harness creates a new unpredictable mode-0700 temporary root for every acquisition and execution, verifies the exact archive, complete source tree, all three lockfiles, license metadata, and explicit runtime-source digests, and installs only the two required child lockfiles with lifecycle scripts disabled. Trusted repository code generates the fixture first; only that fixture, the adapter/setup files, the selected suite allowlist, implementation data, matcher source, and lockfile-installed dependencies enter the isolated runtime. Before external code starts, that runtime is read-only. External code receives no repository-wide read, CI credentials, supplementary groups, privilege gain, or network and can write only a temporary raw-results directory. The trusted parent validates and normalizes those raw bytes before atomically publishing only canonical \`w3c-conformance-evidence.json\` and its \`.sha256\` checksum in the fixed \`test-results/w3c-conformance\` tree. The exact Node 24 patch used by the run is recorded in the canonical evidence. The complete download/install/runtime tree is made removable and deleted in \`finally\`; no cache or marker persists. The lane is Linux-only and uses trusted \`unshare\`/\`setpriv\`, restoring the original non-root UID/GID, clearing groups, and setting no-new-privileges with an in-namespace guard; unsupported platforms or isolation fail closed. The approval variable remains fail closed. It does not permit vendoring or modifying upstream source, registry submission, or package, tag, release, signing, or provenance integration.

Registry posture: **\`${baseline.registry.status}\`**. The decision whether to update the [existing IAMX-linked entry](${baseline.registry.existingEntry}) or record no update remains open until maintainers confirm ownership/contact continuity. Do not create a duplicate registration. Suite evidence is not registration, certification, W3C endorsement, or immutable release evidence.

${end}`;

const original = readFileSync(readmePath, "utf8");
const expression = new RegExp(`${begin}[\\s\\S]*?${end}`, "u");
const updated = expression.test(original)
  ? original.replace(expression, section)
  : original.replace(
      "\n## Pinned standards baselines",
      `\n${section}\n\n## Pinned standards baselines`,
    );
if (process.argv.includes("--check")) {
  if (updated !== original) {
    console.error(
      "w3c-spec/conformance/README.md is stale; run pnpm conformance:external:docs",
    );
    process.exit(1);
  }
} else {
  writeFileSync(readmePath, updated);
}
