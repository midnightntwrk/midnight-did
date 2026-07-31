import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname, "..");
const docsRoot = resolve(repoRoot, "docs-site");
const githubBlobBase =
  "https://github.com/midnightntwrk/midnight-did/blob/main/";

const specs = [
  {
    source: "w3c-spec/midnight-method.md",
    output: "spec/midnight-method.md",
    route: "/spec/midnight-method",
    demoteHeadingsAfterTitle: true,
    lead: [
      "> Implementation guides: [Quickstart](/guide/quickstart), [Key Model](/guide/key-model), and [Compact Contract Surface](/compact/).",
      "",
    ].join("\n"),
  },
  {
    source: "w3c-spec/midnight-did-traits.md",
    output: "spec/midnight-did-traits.md",
    route: "/spec/midnight-did-traits",
  },
];

const routeMap = Object.fromEntries(
  specs.map((spec) => [spec.source, spec.route]),
);
const toPosix = (value) => value.replaceAll("\\", "/");

const resolveRepoPath = (fromSource, target) => {
  if (target.startsWith("/")) return target.slice(1);

  const fromDirectory = dirname(resolve(repoRoot, fromSource));
  return toPosix(relative(repoRoot, resolve(fromDirectory, target)));
};

const shouldPreserveLink = (target) =>
  target.startsWith("http://") ||
  target.startsWith("https://") ||
  target.startsWith("#") ||
  target.startsWith("mailto:");

const rewriteLinks = (content, fromSource) =>
  content.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label, target) => {
    if (shouldPreserveLink(target)) return `[${label}](${target})`;

    const [rawPath, rawAnchor] = target.split("#");
    const repoPath = rawPath ? resolveRepoPath(fromSource, rawPath) : fromSource;
    const mapped = routeMap[repoPath];
    const anchor = rawAnchor ? `#${rawAnchor}` : "";

    if (mapped) return `[${label}](${mapped}${anchor})`;

    return `[${label}](${githubBlobBase}${repoPath}${anchor})`;
  });

const demoteHeadingsAfterTitle = (content) => {
  let titleSeen = false;

  return content.replace(/^(#{1,5}) (?=.+$)/gmu, (_match, hashes) => {
    if (!titleSeen && hashes === "#") {
      titleSeen = true;
      return "# ";
    }

    return `${hashes}# `;
  });
};

const trimTrailingWhitespace = (content) => content.replace(/[ \t]+$/gmu, "");
const preserveHardBreaks = (content) =>
  content.replace(/ {2,}$/gmu, "<br>");
const insertLeadAfterTitle = (content, lead) => {
  if (!lead) return content;

  return content.replace(/^(# .+\n)/u, `$1\n${lead}\n`);
};

for (const spec of specs) {
  const sourcePath = resolve(repoRoot, spec.source);
  const outputPath = resolve(docsRoot, spec.output);
  const raw = await readFile(sourcePath, "utf8");
  const linkedContent = rewriteLinks(raw, spec.source);
  const normalizedContent = spec.demoteHeadingsAfterTitle
    ? demoteHeadingsAfterTitle(linkedContent)
    : linkedContent;
  const content = insertLeadAfterTitle(normalizedContent, spec.lead);
  const cleanContent = trimTrailingWhitespace(preserveHardBreaks(content));

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${cleanContent.trimEnd()}\n`, "utf8");
}
