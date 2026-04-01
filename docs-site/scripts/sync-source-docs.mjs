import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname, "..");
const docsRoot = resolve(repoRoot, "docs-site");
const outputRoot = resolve(docsRoot, "source");

const docs = [
  { source: "README.md", slug: "repository-overview", title: "Repository Overview Source" },
  { source: "contract/README.md", slug: "contract-readme", title: "Contract README Source" },
  { source: "api/README.md", slug: "api-readme", title: "API README Source" },
  { source: "domain/README.md", slug: "domain-readme", title: "Domain README Source" },
  { source: "did/README.md", slug: "did-readme", title: "DID README Source" },
  { source: "secret-storage/README.md", slug: "secret-storage-readme", title: "Secret Storage README Source" },
  { source: "did-resolver-service/README.md", slug: "did-resolver-service-readme", title: "Resolver Service README Source" },
  { source: "did-manager-service/README.md", slug: "did-manager-service-readme", title: "Manager Service README Source" },
  { source: "w3c-spec/midnight-method.md", slug: "spec-midnight-method", title: "Midnight DID Method Source" },
  { source: "w3c-spec/midnight-did-traits.md", slug: "spec-midnight-did-traits", title: "Midnight DID Traits Source" },
];

const routeMap = Object.fromEntries(
  docs.map((doc) => [doc.source, `/source/${doc.slug}`]),
);

const toPosix = (value) => value.replaceAll("\\", "/");

const resolveRepoPath = (fromSource, target) => {
  if (target.startsWith("/")) return target.slice(1);
  const resolved = resolve(repoRoot, relative(repoRoot, resolve(join(repoRoot, fromSource), "..")), target);
  return toPosix(relative(repoRoot, resolved));
};

const rewriteLinks = (content, fromSource) =>
  content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, target) => {
    if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
      return `[${label}](${target})`;
    }

    const [rawPath, rawAnchor] = target.split("#");
    const repoPath = rawPath ? resolveRepoPath(fromSource, rawPath) : fromSource;
    const mapped = routeMap[repoPath];
    if (mapped) {
      const anchor = rawAnchor ? `#${rawAnchor}` : "";
      return `[${label}](${mapped}${anchor})`;
    }

    return `\`${label}\``;
  });

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const indexContent = [
  "# Source Documents",
  "",
  "These pages are generated from repository markdown files so the docs site stays navigable without forcing a jump to GitHub.",
  "",
  "## Pages",
  "",
  ...docs.map((doc) => `- [${doc.title}](/source/${doc.slug})`),
  "",
].join("\n");

writeFileSync(join(outputRoot, "index.md"), indexContent, "utf8");

for (const doc of docs) {
  const sourcePath = resolve(repoRoot, doc.source);
  const raw = await readFile(sourcePath, "utf8");
  const content = rewriteLinks(raw, doc.source);
  const note = [
    "> [!NOTE]",
    `> This page is generated from \`${doc.source}\` in the repository.`,
    "> Edit the source file instead of this generated page.",
    "",
  ].join("\n");

  writeFileSync(join(outputRoot, `${doc.slug}.md`), `${note}${content}\n`, "utf8");
}
