import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

export const relativeHashCases = [
  {
    name: "single-negation",
    pattern: "!#dir/**/*.ts",
    expected: ["#dir/sub/b.js"],
  },
  {
    name: "double-negation",
    pattern: "!!#dir/**/*.ts",
    expected: ["#dir/sub/a.ts"],
  },
];

export function runRelativeHashCanary(moduleUrl) {
  const cwd = mkdtempSync(join(tmpdir(), "did-relative-hash-"));
  try {
    mkdirSync(join(cwd, "#dir/sub"), { recursive: true });
    writeFileSync(join(cwd, "#dir/sub/a.ts"), "export const a = 1;\n");
    writeFileSync(join(cwd, "#dir/sub/b.js"), "export const b = 2;\n");
    // The literal relative root and patterns are essential: absolute prefixes
    // conceal the comment-after-negation parser-order interaction. A child
    // owns its temporary cwd; the parent process never changes directory.
    const source = `
      const { glob } = await import(${JSON.stringify(moduleUrl)});
      const results = {};
      for (const c of ${JSON.stringify(relativeHashCases)}) {
        results[c.name] = glob(c.pattern, "#dir").sort();
      }
      results.comment = glob("#dir/**/*.ts", "#dir").sort();
      console.log(JSON.stringify(results));
    `;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", source],
      {
        cwd,
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    if (result.status !== 0)
      throw new Error(`Relative hash canary failed: ${result.stderr}`);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

export function createTraversalFixture() {
  const root = mkdtempSync(join(tmpdir(), "did-security-parents-"));
  const files = {
    "root.ts": "export const rootValue = 0;\n",
    "src/a.ts": "export const alpha = 1;\n",
    "src/b.ts": "export const beta = 2;\n",
    "src/b.test.ts": "export const testValue = 3;\n",
    "src/.hidden.ts": "export const hidden = 4;\n",
    "src/nested/c.ts": "export const gamma = 5;\n",
    "src/nested/d.js": "export const delta = 6;\n",
    "other/e.ts": "export const epsilon = 7;\n",
    ".hidden/secret.ts": "export const secret = 8;\n",
    "node_modules/pkg/mod.ts": "export const vendor = 9;\n",
    "C:/repo/src/windows.ts": "export const windows = 10;\n",
  };
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), content);
  }
  symlinkSync("src", join(root, "src-link"), "dir");
  symlinkSync("src/a.ts", join(root, "file-link.ts"), "file");
  return root;
}

const ts = ["src/a.ts", "src/b.test.ts", "src/b.ts", "src/nested/c.ts"];
// Explicit sets, established against TypeDoc 0.28.20 / minimatch 10.2.5 before
// migration. Do not regenerate these from the implementation under test.
export const traversalCases = [
  { name: "globstar", pattern: "/src/**/*.ts", expected: ts },
  {
    name: "braces",
    pattern: "/{src,other}/**/*.ts",
    expected: [...ts, "other/e.ts"],
  },
  {
    name: "extglob",
    pattern: "/{src,other}/**/!(*.test).ts",
    expected: ["src/a.ts", "src/b.ts", "src/nested/c.ts", "other/e.ts"],
  },
  {
    name: "explicit-dotfile",
    pattern: "/src/.*.ts",
    expected: ["src/.hidden.ts"],
  },
  {
    name: "explicit-dot-directory",
    pattern: "/.hidden/**/*.ts",
    expected: [".hidden/secret.ts"],
  },
  {
    name: "negation-retains-traversal-boundary",
    pattern: "/src/**/*.ts",
    negate: true,
    expected: ["root.ts", "src/.hidden.ts", "src/nested/d.js"],
  },
  {
    name: "double-negation",
    pattern: "/src/**/*.ts",
    prefix: "!!",
    expected: ts,
  },
  { name: "empty", literal: "", expected: [] },
  { name: "comment", pattern: "/src/**", prefix: "#", expected: [] },
  {
    name: "root-directory",
    pattern: "",
    options: { includeDirectories: true },
    expected: ["."],
  },
  // discoverFiles presents directory names WITHOUT a trailing slash. Preserve
  // the original matcher behavior: src/ and src/** do not include bare src.
  {
    name: "trailing-slash",
    pattern: "/src/",
    options: { includeDirectories: true },
    expected: [],
  },
  {
    name: "include-directories",
    pattern: "/src/**",
    options: { includeDirectories: true },
    expected: [...ts, "src/nested", "src/nested/d.js"],
  },
  {
    name: "no-follow-directory-symlink",
    pattern: "/{src,src-link}/**/*.ts",
    expected: ts,
  },
  {
    name: "follow-directory-symlink",
    pattern: "/{src,src-link}/**/*.ts",
    options: { followSymlinks: true },
    expected: [...ts, ...ts.map((p) => p.replace(/^src\//u, "src-link/"))],
  },
  { name: "no-follow-file-symlink", pattern: "/file-link.ts", expected: [] },
  {
    name: "follow-file-symlink",
    pattern: "/file-link.ts",
    options: { followSymlinks: true },
    expected: ["file-link.ts"],
  },
  {
    name: "implicit-node-modules-denied",
    pattern: "/**/*.ts",
    expected: ["root.ts", ...ts, "other/e.ts", "C:/repo/src/windows.ts"],
  },
  {
    name: "explicit-node-modules",
    pattern: "/node_modules/**/*.ts",
    expected: ["node_modules/pkg/mod.ts"],
  },
  {
    name: "normalized-windows-like",
    pattern: "/C:/repo/src/**/*.ts",
    expected: ["C:/repo/src/windows.ts"],
  },
  { name: "relative-normalized", relativePattern: "src/**/*.ts", expected: ts },
];

export function traversalResults(api, root) {
  return Object.fromEntries(
    traversalCases.map((c) => {
      const pattern =
        c.relativePattern !== undefined
          ? api.createGlobString(root, c.relativePattern)
          : (c.literal ??
            (c.negate ? "!" : (c.prefix ?? "")) + root + c.pattern);
      const paths = api
        .glob(pattern, root, c.options)
        .map((p) => relative(root, p).split("\\").join("/") || ".")
        .sort();
      return [c.name, paths];
    }),
  );
}
