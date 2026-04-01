import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname, "..");
const docsRoot = resolve(repoRoot, "docs-site");
const outputRoot = resolve(docsRoot, "api", "reference");

const packages = [
  {
    slug: "domain",
    displayName: "@midnight-ntwrk/midnight-did-domain",
    entryPoint: resolve(repoRoot, "domain", "src", "index.ts"),
    tsconfig: resolve(repoRoot, "domain", "tsconfig.build.json"),
  },
  {
    slug: "did",
    displayName: "@midnight-ntwrk/midnight-did",
    entryPoint: resolve(repoRoot, "did", "src", "index.ts"),
    tsconfig: resolve(repoRoot, "did", "tsconfig.build.json"),
  },
  {
    slug: "api",
    displayName: "@midnight-ntwrk/midnight-did-api",
    entryPoint: resolve(repoRoot, "api", "src", "index.ts"),
    tsconfig: resolve(repoRoot, "api", "tsconfig.build.json"),
  },
  {
    slug: "secret-storage",
    displayName: "@midnight-ntwrk/midnight-did-secret-storage",
    entryPoint: resolve(repoRoot, "secret-storage", "src", "index.ts"),
    tsconfig: resolve(repoRoot, "secret-storage", "tsconfig.build.json"),
  },
];

const rewriteReadmeLinks = async (rootDir) => {
  for (const entry of readdirSync(rootDir)) {
    const target = join(rootDir, entry);
    if (statSync(target).isDirectory()) {
      await rewriteReadmeLinks(target);
      continue;
    }

    if (!target.endsWith(".md")) continue;

    const content = await readFile(target, "utf8");
    const next = content
      .replaceAll("../README.md", "../index.md")
      .replaceAll("./README.md", "./index.md")
      .replaceAll("/README.md", "/index.md");

    if (next !== content) {
      await writeFile(target, next, "utf8");
    }
  }
};

mkdirSync(outputRoot, { recursive: true });

const buildWorkspaces = ["contract", "domain", "did", "secret-storage", "api"];

for (const workspace of buildWorkspaces) {
  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build", "-w", workspace],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    },
  );
}

for (const entry of readdirSync(outputRoot)) {
  const target = join(outputRoot, entry);
  if (statSync(target).isDirectory()) {
    rmSync(target, { recursive: true, force: true });
  }
}

for (const pkg of packages) {
  const outDir = resolve(outputRoot, pkg.slug);
  mkdirSync(outDir, { recursive: true });

  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "typedoc",
      "--plugin",
      "typedoc-plugin-markdown",
      "--tsconfig",
      pkg.tsconfig,
      "--entryPoints",
      pkg.entryPoint,
      "--out",
      outDir,
      "--readme",
      "none",
      "--hideGenerator",
      "--disableSources",
      "--excludeExternals",
      "--exclude",
      "**/*.test.ts",
      "--exclude",
      "**/test/**",
    ],
    {
      cwd: docsRoot,
      stdio: "inherit",
      env: process.env,
    },
  );

  const readmePath = join(outDir, "README.md");
  const indexPath = join(outDir, "index.md");
  if (existsSync(readmePath)) {
    renameSync(readmePath, indexPath);
  }

  if (existsSync(indexPath)) {
    const content = `# ${pkg.displayName}\n\nGenerated API reference.\n\n`;
    const current = await readFile(indexPath, "utf8");
    await writeFile(indexPath, `${content}${current}`, "utf8");
  }

  await rewriteReadmeLinks(outDir);
}
