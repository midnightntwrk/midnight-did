import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const wrapper = fileURLToPath(new URL("./run-linkinator.mjs", import.meta.url));
const fixture = (t, source) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "did-linkinator-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const binDir = path.join(root, "node_modules", ".bin");
  const packageDir = path.join(root, "node_modules", "linkinator");
  mkdirSync(binDir, { recursive: true });
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "linkinator",
      type: "module",
      bin: { linkinator: "cli.js" },
    }),
  );
  const cli = path.join(packageDir, "cli.js");
  writeFileSync(cli, source);
  const shim = path.join(binDir, "linkinator");
  writeFileSync(
    shim,
    "#!/bin/sh\n# pnpm shim must not be imported as JavaScript\nexit 99\n",
  );
  chmodSync(shim, 0o755);
  return { cli, env: { ...process.env, PATH: binDir } };
};
const invoke = (script, env, args = []) =>
  spawnSync(process.execPath, [script, ...args], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });

test("referenced deadline lets unreferenced queue work settle instead of exit 13", (t) => {
  const { cli, env } = fixture(
    t,
    `
    await new Promise(resolve => setTimeout(resolve, 20).unref());
    console.log(JSON.stringify({ passed: true, links: [{ state: 'OK' }] }));
  `,
  );
  const original = invoke(cli, env);
  assert.equal(original.status, 13);
  assert.equal(original.stdout, "");
  const bounded = invoke(wrapper, env);
  assert.equal(bounded.status, 0, bounded.stderr);
  assert.deepEqual(JSON.parse(bounded.stdout), {
    passed: true,
    links: [{ state: "OK" }],
  });
});

test("preserves arguments, complete broken-link results and nonzero exit", (t) => {
  const { env } = fixture(
    t,
    `
    console.log(JSON.stringify({ args: process.argv.slice(2), passed: false, links: [{ state: 'BROKEN', status: 404 }] }));
    process.exitCode = 1;
  `,
  );
  const result = invoke(wrapper, env, [
    "https://example.test/",
    "--format",
    "json",
  ]);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    args: ["https://example.test/", "--format", "json"],
    passed: false,
    links: [{ state: "BROKEN", status: 404 }],
  });
});

test("does not swallow checker exceptions", (t) => {
  const { env } = fixture(t, "throw new Error('checker fixture failure');\n");
  const result = invoke(wrapper, env);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /checker fixture failure/u);
});

test("genuine unresolved work fails closed at the deadline", () => {
  const code = `import { runWithDeadline } from ${JSON.stringify(new URL("./run-linkinator.mjs", import.meta.url).href)};
    await runWithDeadline(() => new Promise(() => {}), 25);`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    {
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.equal(result.status, 124, result.stderr);
  assert.match(result.stderr, /crawl incomplete/u);
  assert.equal(result.stdout, "");
});

test("missing dlx executable fails without claiming a crawl", (t) => {
  const { env } = fixture(t, "");
  const result = invoke(wrapper, { ...env, PATH: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /linkinator executable not found/u);
  assert.equal(result.stdout, "");
});
