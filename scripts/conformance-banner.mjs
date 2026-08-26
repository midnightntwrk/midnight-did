import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const readPackage = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const rootPackage = readPackage("../package.json");
const contractPackage = readPackage("../packages/contract/package.json");
const gitHead = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const pnpmVersion =
  process.env.npm_config_user_agent?.match(/\bpnpm\/([^\s]+)/)?.[1] ??
  execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();

const standards = [
  [
    "DID Core 1.0",
    "https://www.w3.org/TR/2022/REC-did-core-20220719/",
    "sha256:5e44345740d9bfaa852d3b66c57e98c9beb6c5bf6083b0126dd5daac377b9993",
  ],
  [
    "DID Core 1.1",
    "https://www.w3.org/TR/2026/CR-did-1.1-20260305/",
    "sha256:4a48022defe07d37d2decc3ec9027a932dc883b2ad164a5aeaf9256e530bd979",
  ],
  [
    "DID Resolution v1",
    "https://www.w3.org/TR/2026/CR-did-resolution-1.0-20260806/",
    "sha256:a4632a09600e0136022969114520dc3f8ee9af99ad80963e3ba1a368bea9af1a",
  ],
];

console.log("Conformance evidence runtime");
console.log(`  git HEAD: ${gitHead}`);
console.log(`  package: ${rootPackage.name}@${rootPackage.version}`);
console.log(`  contract: ${contractPackage.name}@${contractPackage.version}`);
console.log(`  Node: ${process.version}`);
console.log(`  pnpm: ${pnpmVersion}`);
console.log("  pinned standards:");
for (const [name, url, digest] of standards) {
  console.log(`    - ${name}: ${url} (${digest})`);
}
