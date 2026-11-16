import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createTraversalFixture,
  relativeHashCases,
  runRelativeHashCanary,
  traversalCases,
  traversalResults,
} from "./security-compatibility-fixtures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(join(root, "package.json"));
const docsRequire = createRequire(join(root, "docs-site/package.json"));
const typedocPackage = docsRequire.resolve("typedoc/package.json");
const typedocRequire = createRequire(typedocPackage);
const typedoc = await import(
  pathToFileURL(join(dirname(typedocPackage), "dist/node-utils.js"))
);
const tcRequire = createRequire(require.resolve("testcontainers"));
const archiver = tcRequire("archiver");
const archiverRequire = createRequire(tcRequire.resolve("archiver"));
const utils = archiverRequire("archiver-utils");
const utilsRequire = createRequire(archiverRequire.resolve("archiver-utils"));
const glob = utilsRequire("glob");
const version = (req, name) =>
  JSON.parse(readFileSync(req.resolve(`${name}/package.json`), "utf8")).version;

test("coordinated parent versions and unchanged legacy matcher lines", () => {
  const scripts = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ).scripts;
  assert.match(
    scripts["ci:core"],
    /pnpm run test:security-parent-compatibility/u,
  );
  assert.match(scripts.verify, /\.\/run\.sh core --strict/u);
  assert.equal(version(utilsRequire, "glob"), "14.0.2");
  assert.equal(
    version(createRequire(utilsRequire.resolve("glob")), "minimatch"),
    "11.0.1",
  );
  assert.equal(version(typedocRequire, "minimatch"), "11.0.1");
  const parserRequire = createRequire(
    require.resolve("@typescript-eslint/parser"),
  );
  const estreeRequire = createRequire(
    parserRequire.resolve("@typescript-eslint/typescript-estree"),
  );
  assert.equal(version(estreeRequire, "minimatch"), "11.0.1");
  const { load } = require("js-yaml");
  const lock = load(readFileSync(join(root, "pnpm-lock.yaml"), "utf8"));
  const matcherKeys = Object.keys(lock.packages).filter((k) =>
    k.startsWith("minimatch@"),
  );
  assert.deepEqual(
    matcherKeys.sort(),
    ["minimatch@11.0.1", "minimatch@3.1.5", "minimatch@5.1.9"].sort(),
  );
  assert.ok(!lock.packages["glob@10.5.0"]);
});

for (const scenario of traversalCases) {
  test(`patched TypeDoc traversal: ${scenario.name}`, () => {
    const fixture = createTraversalFixture();
    try {
      assert.deepEqual(
        traversalResults(typedoc, fixture)[scenario.name],
        [...scenario.expected].sort(),
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}

for (const scenario of relativeHashCases) {
  test(`patched TypeDoc relative hash directory: ${scenario.name}`, () => {
    const result = runRelativeHashCanary(
      pathToFileURL(join(dirname(typedocPackage), "dist/node-utils.js")).href,
    );
    assert.deepEqual(result[scenario.name], scenario.expected);
    assert.deepEqual(result.comment, [], "ordinary #comment must not traverse");
  });
}

test(
  "real TypeDoc CLI expands entry globs and excludes test/hidden inputs",
  { timeout: 30_000 },
  () => {
    const fixture = createTraversalFixture();
    try {
      writeFileSync(
        join(fixture, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            skipLibCheck: true,
          },
          include: ["src/**/*.ts"],
        }),
      );
      const output = join(fixture, "docs.json");
      const result = spawnSync(
        process.execPath,
        [
          join(dirname(typedocPackage), "bin/typedoc"),
          "--entryPointStrategy",
          "expand",
          "--entryPoints",
          `${fixture}/src/**/*.ts`,
          "--exclude",
          "**/*.test.ts",
          "--tsconfig",
          join(fixture, "tsconfig.json"),
          "--json",
          output,
        ],
        { cwd: fixture, encoding: "utf8", timeout: 25_000 },
      );
      assert.equal(result.status, 0, result.stderr + result.stdout);
      const names = [];
      const visit = (node) => {
        names.push(node.name);
        for (const child of node.children ?? []) visit(child);
      };
      visit(JSON.parse(readFileSync(output, "utf8")));
      for (const name of ["alpha", "beta", "gamma"])
        assert.ok(names.includes(name), `missing documented export ${name}`);
      for (const name of ["testValue", "hidden", "vendor"])
        assert.ok(
          !names.includes(name),
          `unexpected documented export ${name}`,
        );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);

test("archiver-utils expansion/filter/mapping and real archiver entries remain exact", async () => {
  const fixture = createTraversalFixture();
  try {
    const patterns = ["src/**/*.ts", "!**/*.test.ts"];
    const expected = ["src/a.ts", "src/b.ts", "src/nested/c.ts"];
    assert.deepEqual(
      utils.file.expand({ cwd: fixture, filter: "isFile" }, patterns).sort(),
      expected,
    );
    assert.deepEqual(
      utils.file.expand(
        { cwd: fixture, filter: (name) => name.endsWith("a.ts") },
        patterns,
      ),
      ["src/a.ts"],
    );
    const mapping = utils.file.expandMapping(patterns, "out", {
      cwd: fixture,
      flatten: true,
      ext: ".js",
    });
    assert.deepEqual(
      mapping
        .map((m) => ({
          src: m.src.map((p) => p.slice(fixture.length + 1)),
          dest: m.dest,
        }))
        .sort((a, b) => a.dest.localeCompare(b.dest)),
      [
        { src: ["src/a.ts"], dest: "out/a.js" },
        { src: ["src/b.ts"], dest: "out/b.js" },
        { src: ["src/nested/c.ts"], dest: "out/c.js" },
      ],
    );
    const archive = archiver("tar");
    const chunks = [];
    const completed = new Promise((resolve, reject) => {
      archive.on("data", (c) => chunks.push(c));
      archive.once("end", resolve);
      archive.once("error", reject);
    });
    archive.glob("src/**/*.ts", { cwd: fixture, ignore: ["**/*.test.ts"] });
    await archive.finalize();
    await completed;
    const listing = spawnSync("tar", ["-tf", "-"], {
      input: Buffer.concat(chunks),
      encoding: "utf8",
    });
    assert.equal(listing.status, 0, listing.stderr);
    assert.deepEqual(listing.stdout.trim().split("\n").sort(), expected);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("glob pre-abort and mid-traversal cancellation stop further directory reads", async () => {
  for (const preAbort of [true, false]) {
    const fixture = createTraversalFixture();
    try {
      const controller = new AbortController();
      const reason = new Error("security compatibility cancellation");
      let reads = 0;
      const beforeRead = () => {
        reads++;
        controller.abort(reason);
      };
      const io = {
        ...fs,
        readdir: (...args) => {
          beforeRead();
          return fs.readdir(...args);
        },
        promises: {
          ...fs.promises,
          readdir: (...args) => {
            beforeRead();
            return fs.promises.readdir(...args);
          },
        },
      };
      if (preAbort) controller.abort(reason);
      await assert.rejects(
        glob.glob("**", { cwd: fixture, signal: controller.signal, fs: io }),
        /security compatibility cancellation/u,
      );
      const readsAtAbort = reads;
      await delay(30);
      assert.equal(
        reads,
        readsAtAbort,
        "directory traversal continued after cancellation",
      );
      assert.equal(reads, preAbort ? 0 : 1);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});

test("typescript project-service allowDefaultProject matches only the allowed file", () => {
  const fixture = createTraversalFixture();
  try {
    const parser = require("@typescript-eslint/parser");
    const code = "export const value: number = 42;\n";
    writeFileSync(join(fixture, "loose.ts"), code);
    writeFileSync(join(fixture, "outside.ts"), code);
    writeFileSync(
      join(fixture, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, target: "ES2022", skipLibCheck: true },
        include: ["src/a.ts"],
      }),
    );
    const options = {
      tsconfigRootDir: fixture,
      projectService: {
        allowDefaultProject: ["loose.ts"],
        defaultProject: "tsconfig.json",
      },
      sourceType: "module",
    };
    const result = parser.parseForESLint(code, {
      ...options,
      filePath: join(fixture, "loose.ts"),
    });
    assert.equal(result.ast.body[0].type, "ExportNamedDeclaration");
    assert.ok(
      result.services.program
        .getSourceFile(join(fixture, "loose.ts"))
        .getText()
        .includes("value: number"),
    );
    assert.throws(
      () =>
        parser.parseForESLint(code, {
          ...options,
          filePath: join(fixture, "outside.ts"),
        }),
      /not found by the project service/u,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
