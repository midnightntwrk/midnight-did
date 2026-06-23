#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");
const docsRoot = resolve(repoRoot, "docs-site");

const toPosix = (value) => value.split(sep).join("/");

const isSubpath = (parent, child) => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const walkFiles = async (root, predicate) => {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".vitepress"].includes(entry.name)) continue;
      files.push(...(await walkFiles(fullPath, predicate)));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files.sort();
};

const lineAt = (content, index) =>
  content.slice(0, index).split(/\r?\n/u).length;

const stripFenceBlocks = (content) =>
  content.replace(/^```[\s\S]*?^```/gmu, (block) =>
    "\n".repeat(block.split(/\n/u).length - 1),
  );

const stripInlineMarkdown = (value) =>
  value
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/<[^>]+>/gu, "")
    .replace(/[*_~]/gu, "")
    .trim();

const slugify = (heading) =>
  stripInlineMarkdown(heading)
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/giu, "")
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/gu, "")
    .replace(/\s+/gu, "-");

const routeForMarkdownFile = (filePath, root = docsRoot) => {
  const rel = toPosix(relative(root, filePath));
  if (rel === "index.md") return "/";
  if (rel.endsWith("/index.md")) return `/${rel.slice(0, -"index.md".length)}`;
  return `/${rel.slice(0, -".md".length)}`;
};

const addAnchor = (anchors, rawHeading) => {
  const baseSlug = slugify(rawHeading);
  if (!baseSlug) return;

  const count = anchors.counts.get(baseSlug) ?? 0;
  const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
  anchors.counts.set(baseSlug, count + 1);
  anchors.values.add(slug);
};

const markdownAnchors = (content) => {
  const anchors = { values: new Set(), counts: new Map() };
  const withoutFences = stripFenceBlocks(content);
  const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/gmu;

  for (const match of withoutFences.matchAll(headingPattern)) {
    addAnchor(anchors, match[2]);
  }

  return anchors.values;
};

const buildDocsIndex = async (root = docsRoot) => {
  const files = await walkFiles(root, (filePath) => extname(filePath) === ".md");
  const byFile = new Map();
  const byRoute = new Map();

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const route = routeForMarkdownFile(filePath, root);
    const entry = {
      filePath,
      content,
      anchors: markdownAnchors(content),
      route,
    };
    byFile.set(filePath, entry);
    byRoute.set(route, entry);
    if (route.endsWith("/") && route !== "/") {
      byRoute.set(route.slice(0, -1), entry);
    }
  }

  return { files, byFile, byRoute, root };
};

const decodeAnchor = (anchor) => {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
};

const splitTarget = (target) => {
  const withoutQuery = target.split("?")[0];
  const hashIndex = withoutQuery.indexOf("#");
  if (hashIndex === -1) return { path: withoutQuery, anchor: "" };
  return {
    path: withoutQuery.slice(0, hashIndex),
    anchor: decodeAnchor(withoutQuery.slice(hashIndex + 1)),
  };
};

const isExternalTarget = (target) =>
  /^(?:[a-z][a-z0-9+.-]*:)?\/\//iu.test(target) ||
  /^(?:mailto|tel|did):/iu.test(target);

const resolveRouteTarget = (sourceEntry, rawPath, index) => {
  let normalized = rawPath.replace(/\.html$/u, "");
  if (normalized === "") return sourceEntry;

  if (normalized.startsWith("/")) {
    if (index.byRoute.has(normalized)) return index.byRoute.get(normalized);
    if (!normalized.endsWith("/") && index.byRoute.has(`${normalized}/`)) {
      return index.byRoute.get(`${normalized}/`);
    }
    return undefined;
  }

  const sourceDir = dirname(sourceEntry.filePath);
  const fileCandidate = resolve(sourceDir, normalized);
  if (normalized.endsWith(".md")) {
    return index.byFile.get(fileCandidate);
  }

  const routeDir = sourceEntry.route.endsWith("/")
    ? sourceEntry.route
    : `${dirname(sourceEntry.route)}/`;
  const routeCandidate = `/${toPosix(resolve("/", routeDir, normalized)).replace(
    /^\/+/u,
    "",
  )}`;
  return (
    index.byRoute.get(routeCandidate) ??
    index.byRoute.get(`${routeCandidate}/`) ??
    index.byFile.get(resolve(fileCandidate, "index.md"))
  );
};

const assetExists = (sourceEntry, rawPath, root = docsRoot) => {
  if (!rawPath || rawPath.includes("#")) return false;
  const cleanPath = rawPath.startsWith("/")
    ? resolve(root, "public", rawPath.slice(1))
    : resolve(dirname(sourceEntry.filePath), rawPath);
  return isSubpath(root, cleanPath) && existsSync(cleanPath);
};

const extractLinks = (content) => {
  const withoutFences = stripFenceBlocks(content);
  const links = [];
  const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
  const htmlHrefPattern = /\bhref=["']([^"']+)["']/giu;

  for (const match of withoutFences.matchAll(markdownLinkPattern)) {
    links.push({ target: match[1], index: match.index });
  }

  for (const match of withoutFences.matchAll(htmlHrefPattern)) {
    links.push({ target: match[1], index: match.index });
  }

  return links.sort((a, b) => a.index - b.index);
};

const validateLinks = async (root = docsRoot) => {
  const index = await buildDocsIndex(root);
  const failures = [];

  for (const sourceEntry of index.byFile.values()) {
    for (const link of extractLinks(sourceEntry.content)) {
      const target = link.target.trim();
      if (!target || isExternalTarget(target)) continue;

      const { path: targetPath, anchor } = splitTarget(target);
      const targetEntry = resolveRouteTarget(sourceEntry, targetPath, index);

      if (!targetEntry) {
        if (assetExists(sourceEntry, targetPath, root)) continue;
        failures.push({
          filePath: sourceEntry.filePath,
          line: lineAt(sourceEntry.content, link.index),
          message: `broken local docs link '${target}'`,
        });
        continue;
      }

      if (anchor && !targetEntry.anchors.has(anchor)) {
        failures.push({
          filePath: sourceEntry.filePath,
          line: lineAt(sourceEntry.content, link.index),
          message: `broken anchor '${anchor}' in link '${target}'`,
        });
      }
    }
  }

  return failures;
};

const validateSpecDrift = () => {
  execFileSync("node", ["docs-site/scripts/sync-spec-docs.mjs"], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const diff = execFileSync("git", ["diff", "--", "docs-site/spec"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (diff.trim() === "") return [];

  return [
    {
      filePath: resolve(repoRoot, "docs-site/spec"),
      line: 1,
      message:
        "generated spec docs are out of sync with w3c-spec; run 'pnpm run docs:sync-spec' and commit the result",
    },
  ];
};

const printFailures = (failures) => {
  for (const failure of failures) {
    const relPath = toPosix(relative(repoRoot, failure.filePath));
    console.error(`- ${relPath}:${failure.line}: ${failure.message}`);
  }
};

const main = async () => {
  const failures = [
    ...validateSpecDrift(),
    ...(await validateLinks()),
  ];

  if (failures.length > 0) {
    console.error(`docs validation failed with ${failures.length} issue(s):`);
    printFailures(failures);
    process.exitCode = 1;
    return;
  }

  console.log("docs validation passed");
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export {
  buildDocsIndex,
  extractLinks,
  markdownAnchors,
  routeForMarkdownFile,
  slugify,
  splitTarget,
  validateLinks,
};
