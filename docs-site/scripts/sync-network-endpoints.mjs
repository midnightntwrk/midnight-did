import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..", "..");
const docsRoot = resolve(repoRoot, "docs-site");
const profilesSourcePath = resolve(
  repoRoot,
  "packages/api/src/config-profiles.ts",
);
const outputPath = resolve(docsRoot, "guide/network-endpoints.md");

const profileOrder = [
  "standalone",
  "testnet-local",
  "testnet-remote",
  "preprod",
  "mainnet",
];

const apiClassByProfile = {
  standalone: '`StandaloneConfig` or `ProfileConfig("standalone")`',
  "testnet-local": '`TestnetLocalConfig` or `ProfileConfig("testnet-local")`',
  "testnet-remote":
    '`TestnetRemoteConfig` or `ProfileConfig("testnet-remote")`',
  preprod: '`PreprodConfig` or `ProfileConfig("preprod")`',
  mainnet: '`MainnetConfig` or `ProfileConfig("mainnet")`',
};

const didNetworkSegmentByProfile = {
  standalone: "`undeployed`",
  "testnet-local": "`testnet`",
  "testnet-remote": "`testnet`",
  preprod: "`preprod`",
  mainnet: "`mainnet`",
};

const extractObjectLiteral = (source, exportName) => {
  const declaration = `export const ${exportName} =`;
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex === -1) {
    throw new Error(`Cannot find ${declaration} in config profile source`);
  }

  const start = source.indexOf("{", declarationIndex);
  if (start === -1) {
    throw new Error(`Cannot find object literal for ${exportName}`);
  }

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Cannot find end of object literal for ${exportName}`);
};

const parseNetworkProfiles = (source) => {
  const objectLiteral = extractObjectLiteral(source, "MIDNIGHT_NETWORK_PROFILES");
  const profiles = Function(`"use strict"; return (${objectLiteral});`)();

  for (const name of profileOrder) {
    const profile = profiles[name];
    if (!profile) throw new Error(`Missing network profile "${name}"`);
    if (profile.name !== name) {
      throw new Error(`Profile "${name}" has mismatched name "${profile.name}"`);
    }
    for (const field of ["indexer", "indexerWS", "node", "proofServer"]) {
      if (typeof profile.endpoints?.[field] !== "string") {
        throw new Error(`Profile "${name}" is missing endpoint "${field}"`);
      }
    }
  }

  return profiles;
};

const markdownCell = (value) => String(value).replaceAll("|", "\\|");
const codeCell = (value) => `\`${markdownCell(value)}\``;

const endpointRows = (profiles) =>
  profileOrder
    .map((name) => {
      const profile = profiles[name];
      return [
        codeCell(name),
        apiClassByProfile[name],
        didNetworkSegmentByProfile[name],
        codeCell(profile.networkId),
        codeCell(profile.endpoints.indexer),
        codeCell(profile.endpoints.indexerWS),
        codeCell(profile.endpoints.node),
        codeCell(profile.endpoints.proofServer),
      ].join(" | ");
    })
    .map((row) => `| ${row} |`)
    .join("\n");

const standalone = (profiles) => profiles.standalone.endpoints;

const standaloneSummary = (profiles) => {
  const endpoints = standalone(profiles);
  return `Standalone and local testnet use the current standalone indexer path \`${new URL(endpoints.indexer).pathname}\` and the local ports \`${new URL(endpoints.indexer).port}\`, \`${new URL(endpoints.node).port}\`, and \`${new URL(endpoints.proofServer).port}\`.`;
};

const generateNetworkEndpointsMarkdown = (profiles) => `# Network Endpoints

The API package owns the canonical endpoint profiles in
\`packages/api/src/config-profiles.ts\`. This page is generated from that source
so docs, examples, and stale-endpoint validation use the same defaults.

## Profile Matrix

| Runtime profile | API class | DID network segment | Runtime network id | Indexer HTTP GraphQL | Indexer WS | Node RPC | Proof server |
| --- | --- | --- | --- | --- | --- | --- | --- |
${endpointRows(profiles)}

${standaloneSummary(profiles)}

## Environment Overrides

Runtime examples and smoke tests should use these variable names when overriding
the selected profile:

| Environment variable | Overrides | Standalone default |
| --- | --- | --- |
| \`INDEXER_URL\` | Indexer HTTP GraphQL endpoint | \`${standalone(profiles).indexer}\` |
| \`INDEXER_WS_URL\` | Indexer WebSocket GraphQL endpoint | \`${standalone(profiles).indexerWS}\` |
| \`NODE_RPC_URL\` | Midnight node RPC endpoint | \`${standalone(profiles).node}\` |
| \`PROOF_SERVER_URL\` | Proof server endpoint | \`${standalone(profiles).proofServer}\` |

If only \`INDEXER_URL\` is supplied, examples that derive a WebSocket URL append
\`/ws\` to the same GraphQL path. Keep \`INDEXER_WS_URL\` explicit in long-lived
services so HTTP and WebSocket routing can evolve independently.

## Ownership

\`ProfileConfig\` resolves the endpoint profile and applies the Midnight runtime
network id before wallet or contract operations start. The named classes are
thin profile-specific wrappers:

| API surface | Owns |
| --- | --- |
| \`MIDNIGHT_NETWORK_PROFILES\` | profile names, DID/runtime network ids, and default endpoint URLs |
| \`ProfileConfig\` | data-driven profile selection and endpoint overrides |
| \`StandaloneConfig\` | standalone local defaults for \`did:midnight:undeployed\` |
| \`TestnetLocalConfig\` | local services configured as the \`testnet\` runtime network |
| \`TestnetRemoteConfig\` | public testnet indexer and RPC with a local proof server |
| \`PreprodConfig\` | public preprod indexer and RPC with a local proof server |
| \`MainnetConfig\` | public mainnet indexer and RPC with a local proof server, plus optional endpoint overrides |

The proof server default is local for every shipped profile. Controller-gated
DID updates pass wallet-local authorization signatures to the proof server
rather than the controller secret. Applications should still treat remote
proving as transaction-authoring infrastructure and submit a fresh current-
version authorization for each intended mutation.

## GraphQL Versions

All shipped profiles currently use indexer GraphQL \`v4\`. Do not copy an
endpoint between profiles just because the host name looks similar; the API
version is part of the supported profile.

Historical examples can contain a legacy v1 GraphQL path or old standalone
ports. Those values are stale for this repository's current standalone
configuration and should be replaced with this page's profile defaults.

## Preview

The DID method recognizes the \`preview\` network segment, but the API package
does not currently ship a \`preview\` endpoint profile. Do not infer preview
indexer, WebSocket, RPC, or proof-server URLs from other environments; add a
profile to \`MIDNIGHT_NETWORK_PROFILES\` when a canonical preview deployment is
available.
`;

const writeNetworkEndpointsPage = async ({
  sourcePath = profilesSourcePath,
  targetPath = outputPath,
} = {}) => {
  const source = await readFile(sourcePath, "utf8");
  const profiles = parseNetworkProfiles(source);
  const content = generateNetworkEndpointsMarkdown(profiles);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, "utf8");
  return { content, profiles, targetPath };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeNetworkEndpointsPage();
}

export {
  generateNetworkEndpointsMarkdown,
  parseNetworkProfiles,
  writeNetworkEndpointsPage,
};
