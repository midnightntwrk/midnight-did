import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { load as loadYaml } from "js-yaml";
import Parser from "tree-sitter";
import Bash from "tree-sitter-bash";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function text(relative) {
  return readFile(path.join(root, relative), "utf8");
}

async function filesBelow(directory, include) {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true,
  });
  const files = await Promise.all(
    entries.map((entry) => {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) return filesBelow(relative, include);
      return entry.isFile() && include(entry.name) ? [relative] : [];
    }),
  );
  return files.flat();
}

async function automationYamlTexts() {
  const [workflows, actions] = await Promise.all([
    filesBelow(".github/workflows", (name) => /\.(?:yaml|yml)$/.test(name)),
    filesBelow(".github/actions", (name) =>
      /^action\.(?:yaml|yml)$/.test(name),
    ),
  ]);
  return Promise.all([...workflows, ...actions].map(text));
}

function githubActionsRunCommands(workflow) {
  const document = loadYaml(workflow);
  if (document == null || typeof document !== "object") return [];

  const commands = [];
  const collectSteps = (steps) => {
    if (!Array.isArray(steps)) return;
    for (const step of steps) {
      if (
        step != null &&
        typeof step === "object" &&
        typeof step.run === "string"
      ) {
        commands.push(step.run);
      }
    }
  };

  if (document.jobs != null && typeof document.jobs === "object") {
    for (const job of Object.values(document.jobs)) {
      if (job != null && typeof job === "object") collectSteps(job.steps);
    }
  }
  if (
    document.runs != null &&
    typeof document.runs === "object" &&
    document.runs.using === "composite"
  ) {
    collectSteps(document.runs.steps);
  }
  return commands;
}

const shellParser = new Parser();
shellParser.setLanguage(Bash);

function decodeAnsiCString(source) {
  if (!source.startsWith("$'") || !source.endsWith("'")) return null;
  const body = source.slice(2, -1);
  let decoded = "";
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character !== "\\") {
      decoded += character;
      continue;
    }
    const escape = body[++index];
    if (escape == null) return null;
    const simple = {
      "'": "'",
      '"': '"',
      "?": "?",
      "\\": "\\",
      a: "\u0007",
      b: "\b",
      e: "\u001b",
      E: "\u001b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\v",
    };
    if (Object.hasOwn(simple, escape)) {
      decoded += simple[escape];
      continue;
    }
    if (/[0-7]/.test(escape)) {
      const digits = body.slice(index).match(/^[0-7]{1,3}/)?.[0];
      const value = Number.parseInt(digits, 8) & 0xff;
      if (value === 0) return null;
      decoded += String.fromCodePoint(value);
      index += digits.length - 1;
      continue;
    }
    if (["x", "u", "U"].includes(escape)) {
      const maximum = escape === "x" ? 2 : escape === "u" ? 4 : 8;
      const digits = body
        .slice(index + 1)
        .match(new RegExp(`^[0-9A-Fa-f]{1,${maximum}}`))?.[0];
      if (digits == null) return null;
      const value = Number.parseInt(digits, 16);
      if (value === 0 || value > 0x10ffff) return null;
      decoded += String.fromCodePoint(value);
      index += digits.length;
      continue;
    }
    return null;
  }
  return decoded;
}

function staticShellWord(node) {
  if (node == null) return null;
  if (
    ["number", "string_content", "variable_name", "word"].includes(node.type)
  ) {
    return node.text.replaceAll(/\\(.)/gs, "$1");
  }
  if (node.type === "raw_string") return node.text.slice(1, -1);
  if (node.type === "ansi_c_string") return decodeAnsiCString(node.text);
  if (node.type === "command_substitution") {
    const command = node.namedChildren.find(
      (child) => child.type === "command",
    );
    const words = command == null ? null : staticCommandWords(command);
    if (words == null) return null;
    const executable = executableName(words.name);
    if (executable === "echo" && words.args.every((arg) => arg != null)) {
      return words.args.join(" ");
    }
    if (executable === "printf" && words.args.length === 1)
      return words.args[0];
    return null;
  }
  if (["command_name", "concatenation", "string"].includes(node.type)) {
    const parts = node.namedChildren.map(staticShellWord);
    return parts.every((part) => part != null) ? parts.join("") : null;
  }
  return null;
}

function commandParts(node) {
  const name = staticShellWord(node.childForFieldName("name"));
  const args = node.namedChildren
    .filter(
      (child) =>
        child.type !== "command_name" &&
        child.type !== "variable_assignment" &&
        !child.type.endsWith("_redirect"),
    )
    .map((child) => ({ value: staticShellWord(child), source: child.text }));
  return { name, args };
}

function staticCommandWords(node) {
  const { name, args } = commandParts(node);
  return name == null || args.some(({ value }) => value == null)
    ? null
    : { name, args: args.map(({ value }) => value) };
}

function executableName(name) {
  return path.posix.basename(name).toLowerCase();
}

function isForbiddenExecutable(name) {
  return /^(?:npm|npx)(?:\.cmd|\.exe)?$/i.test(executableName(name));
}

const genericWrappers = new Set([
  "command",
  "env",
  "exec",
  "ionice",
  "nice",
  "nohup",
  "setsid",
  "stdbuf",
  "sudo",
  "time",
  "timeout",
  "xargs",
]);

const wrapperOperandOptions = new Map([
  ["env", new Set(["-C", "-u", "--chdir", "--unset"])],
  ["exec", new Set(["-a"])],
  [
    "ionice",
    new Set([
      "-c",
      "-n",
      "-p",
      "-P",
      "-u",
      "--class",
      "--classdata",
      "--pid",
      "--pgid",
      "--uid",
    ]),
  ],
  ["nice", new Set(["-n", "--adjustment"])],
  ["stdbuf", new Set(["-e", "-i", "-o"])],
  [
    "sudo",
    new Set([
      "-C",
      "-D",
      "-g",
      "-h",
      "-p",
      "-R",
      "-T",
      "-u",
      "--chdir",
      "--group",
      "--host",
      "--prompt",
      "--user",
    ]),
  ],
  ["time", new Set(["-f", "-o", "--format", "--output"])],
  ["timeout", new Set(["-k", "-s", "--kill-after", "--signal"])],
  ["xargs", new Set(["-a", "-d", "-E", "-I", "-L", "-n", "-P", "-s"])],
]);

function staticCommandString(args, index) {
  const command = args[index];
  return command?.value == null ? null : command.value;
}

function wrappedCommandIndex(args, wrapper) {
  let index = 0;
  while (index < args.length) {
    const token = args[index];
    if (wrapper === "env" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(token.source)) {
      index += 1;
      continue;
    }
    if (token.value == null) return null;
    if (token.value === "--") return index + 1;
    if (!token.value.startsWith("-") || token.value === "-") break;
    if (wrapper === "command" && ["-v", "-V"].includes(token.value)) {
      return args.length;
    }
    const [option] = token.value.split("=", 1);
    if (
      wrapperOperandOptions.get(wrapper)?.has(option) &&
      !token.value.includes("=")
    ) {
      if (args[index + 1]?.value == null) return null;
      index += 2;
    } else {
      index += 1;
    }
  }
  if (wrapper === "timeout") {
    if (args[index]?.value == null) return null;
    index += 1;
  }
  return index;
}

function commandPartsAreForbidden(name, args) {
  if (name == null) return true;
  const executable = executableName(name);
  if (isForbiddenExecutable(executable)) return true;

  if (executable === "eval") {
    if (args.length === 0 || args.some(({ value }) => value == null))
      return true;
    return shellCommandIsForbidden(args.map(({ value }) => value).join(" "));
  }

  if (["bash", "dash", "ksh", "sh", "zsh"].includes(executable)) {
    for (let index = 0; index < args.length; index += 1) {
      const option = args[index].value;
      if (option != null && /^-[^-]*c[^-]*$/.test(option)) {
        const command = staticCommandString(args, index + 1);
        return command == null || shellCommandIsForbidden(command);
      }
    }
    return false;
  }

  if (
    ["powershell", "powershell.exe", "pwsh", "pwsh.exe"].includes(executable)
  ) {
    for (let index = 0; index < args.length; index += 1) {
      const option = args[index].value;
      if (
        option != null &&
        /^-(?:c|co|com|comm|comma|comman|command)$/i.test(option)
      ) {
        const command = staticCommandString(args, index + 1);
        return command == null || shellCommandIsForbidden(command);
      }
    }
    return false;
  }

  if (executable === "env") {
    for (let index = 0; index < args.length; index += 1) {
      const token = args[index];
      if (["-S", "--split-string"].includes(token.value)) {
        const command = staticCommandString(args, index + 1);
        return command == null || shellCommandIsForbidden(command);
      }
      if (token.value?.startsWith("--split-string=")) {
        return shellCommandIsForbidden(
          token.value.slice("--split-string=".length),
        );
      }
    }
  }

  if (executable === "corepack") {
    const index = wrappedCommandIndex(args, executable);
    if (index == null || args[index]?.value == null) return true;
    const manager = args[index].value;
    return (
      isForbiddenExecutable(manager) ||
      (executableName(manager) === "pnpm" &&
        commandPartsAreForbidden(manager, args.slice(index + 1)))
    );
  }

  if (executable === "pnpm") {
    const execIndex = args.findIndex(({ value }) =>
      ["exec", "x"].includes(value),
    );
    if (execIndex !== -1) {
      let nestedIndex = execIndex + 1;
      if (args[nestedIndex]?.value === "--") nestedIndex += 1;
      const nested = args[nestedIndex]?.value;
      return (
        nested == null ||
        commandPartsAreForbidden(nested, args.slice(nestedIndex + 1))
      );
    }
    return false;
  }

  if (executable === "direnv" && args[0]?.value === "exec") {
    const nested = args[2]?.value;
    return nested == null || commandPartsAreForbidden(nested, args.slice(3));
  }

  if (genericWrappers.has(executable)) {
    if (executable === "command" && ["-v", "-V"].includes(args[0]?.value)) {
      return false;
    }
    const index = wrappedCommandIndex(args, executable);
    if (index == null || index >= args.length || args[index].value == null)
      return true;
    return commandPartsAreForbidden(args[index].value, args.slice(index + 1));
  }

  // Once the executable is statically safe, its arguments may remain dynamic.
  return false;
}

function isCatalogArgumentDispatcher(node) {
  if (node.text !== '"$@"') return false;
  for (let parent = node.parent; parent != null; parent = parent.parent) {
    if (parent.type === "function_definition") {
      return (
        staticShellWord(parent.childForFieldName("name")) ===
        "run_common_run_step"
      );
    }
  }
  return false;
}

function shellCommandIsForbidden(command) {
  const normalized = command.replaceAll(/\\\r?\n/g, "");
  const tree = shellParser.parse(normalized);
  if (tree.rootNode.hasError) return true;
  const visit = (node) => {
    if (node.type === "command") {
      const { name, args } = commandParts(node);
      if (
        !isCatalogArgumentDispatcher(node) &&
        commandPartsAreForbidden(name, args)
      ) {
        return true;
      }
    }
    if (node.type === "redirected_statement") {
      const command = node.namedChildren.find(
        (child) => child.type === "command",
      );
      if (command != null) {
        const { name, args } = commandParts(command);
        const executable = name == null ? null : executableName(name);
        if (["bash", "dash", "ksh", "sh", "zsh"].includes(executable)) {
          for (const redirect of node.namedChildren.filter((child) =>
            ["heredoc_redirect", "herestring_redirect"].includes(child.type),
          )) {
            const body = redirect.namedChildren.at(-1);
            const script =
              body == null ? null : (staticShellWord(body) ?? body.text);
            if (script == null || shellCommandIsForbidden(script)) return true;
          }
        }
      }
    }
    return node.namedChildren.some(visit);
  };
  return visit(tree.rootNode);
}

function repositoryPath(value) {
  return /^\.\/[A-Za-z0-9_./-]+$/.test(value ?? "") ? value.slice(2) : null;
}

function runnerReferences(source, kind) {
  if (kind === "catalog") {
    return [
      ...new Set(
        [
          ...source.matchAll(
            /\bcommand\s*:\s*["'](\.\/[A-Za-z0-9_./-]+\.sh)["']/g,
          ),
        ].map(([, candidate]) => repositoryPath(candidate)),
      ),
    ];
  }

  const tree = shellParser.parse(source.replaceAll(/\\\r?\n/g, ""));
  const references = [];
  const visit = (node) => {
    if (node.type === "command") {
      const { name, args } = commandParts(node);
      const executable = name == null ? null : executableName(name);
      if ([".", "source"].includes(executable)) {
        const sourced = repositoryPath(args[0]?.value);
        if (sourced?.endsWith(".sh"))
          references.push({ path: sourced, kind: "shell" });
      }
      if (executable === "node") {
        const catalog = args
          .map(({ value }) => repositoryPath(value))
          .find((candidate) => candidate === "scripts/run-target-catalog.mjs");
        if (catalog != null)
          references.push({ path: catalog, kind: "catalog" });
      }
    }
    node.namedChildren.forEach(visit);
  };
  visit(tree.rootNode);
  return references;
}

function workflowRunnerSeeds(command) {
  const tree = shellParser.parse(command.replaceAll(/\\\r?\n/g, ""));
  const seeds = [];
  const visit = (node) => {
    if (node.type === "command") {
      const { name, args } = commandParts(node);
      const candidates = [name, ...args.map(({ value }) => value)];
      if (
        candidates.some((candidate) => repositoryPath(candidate) === "run.sh")
      ) {
        seeds.push({ path: "run.sh", kind: "shell" });
      }
    }
    node.namedChildren.forEach(visit);
  };
  visit(tree.rootNode);
  return seeds;
}

async function automationDocumentIsForbidden(document, readRunner = text) {
  const commands = githubActionsRunCommands(document);
  if (commands.some(shellCommandIsForbidden)) return true;

  const queue = commands.flatMap(workflowRunnerSeeds);
  const visited = new Set();
  while (queue.length > 0) {
    const surface = queue.shift();
    if (visited.has(surface.path)) continue;
    visited.add(surface.path);
    const source = await readRunner(surface.path);
    if (surface.kind === "shell" && shellCommandIsForbidden(source))
      return true;
    const references = runnerReferences(source, surface.kind);
    if (surface.kind === "catalog") {
      queue.push(
        ...references.map((runner) => ({ path: runner, kind: "shell" })),
      );
    } else {
      queue.push(...references);
    }
  }
  return false;
}

function workflowWithCommand(command) {
  return `jobs:\n  check:\n    steps:\n      - run: ${JSON.stringify(command)}\n`;
}

const forbiddenCommandCorpus = [
  "npm install package",
  "npx tool",
  "sudo env FOO=bar npm test",
  "sudo -n -u root npm test",
  "ionice -c 2 npm test",
  "direnv exec . npm test",
  "corepack npm install",
  "corepack pnpm exec npm test",
  "pnpm exec npm test",
  "pnpm exec -- npm test",
  "pnpm x npx tool",
  "eval 'npm test'",
  "bash -lc 'npm test'",
  "pwsh -Command 'npx tool'",
  "powershell -Command 'npm test'",
  "env -S 'npm test'",
  "env --split-string=$'n\\x70m tool'",
  "n\\pm test",
  "n\\" + "\n" + "pm test",
  "$'n\\x70m' test",
  "$(printf npm) test",
  '"$PACKAGE_MANAGER" test',
  'eval "$COMMAND"',
  'bash -c "$COMMAND"',
  'sudo "$COMMAND" test',
  "false && npm test",
];

const allowedCommandCorpus = [
  "pnpm install --frozen-lockfile",
  "pnpm run build",
  'echo "npm and npx are not used"',
  "printf '%s\\n' 'npm install package'",
  "# npm install package",
  "cat <<'TEXT'\nnpm install package\nTEXT",
  'node ./scripts/tool.mjs "$DYNAMIC_ARGUMENT"',
  'env TOKEN="$DYNAMIC_TOKEN" pnpm run test',
  'pnpm run "$DYNAMIC_SCRIPT"',
  "command -v npm",
  "grep npm docs/package-manager.md",
];

test("enforces the pnpm-only workflow command corpus", async () => {
  for (const command of forbiddenCommandCorpus) {
    assert.equal(
      await automationDocumentIsForbidden(workflowWithCommand(command)),
      true,
      command,
    );
  }
  for (const command of allowedCommandCorpus) {
    assert.equal(
      await automationDocumentIsForbidden(workflowWithCommand(command)),
      false,
      command,
    );
  }
});

test("follows run.sh, sourced helpers, and data-driven target catalogs", async () => {
  const surfaces = new Map([
    ["run.sh", "source ./scripts/run-common.sh"],
    [
      "scripts/run-common.sh",
      "node ./scripts/run-target-catalog.mjs --step-commands",
    ],
    [
      "scripts/run-target-catalog.mjs",
      'export const lanes = [{ command: "./run-core.sh" }];',
    ],
    ["run-core.sh", "env npm test"],
  ]);
  const readRunner = async (relative) => {
    assert.ok(surfaces.has(relative), `unexpected runner surface: ${relative}`);
    return surfaces.get(relative);
  };
  assert.equal(
    await automationDocumentIsForbidden(
      workflowWithCommand("./run.sh core"),
      readRunner,
    ),
    true,
  );

  surfaces.set("run-core.sh", "pnpm run test");
  assert.equal(
    await automationDocumentIsForbidden(
      workflowWithCommand("./run.sh core"),
      readRunner,
    ),
    false,
  );
});

test("keeps direct reviewed release scripts outside recursive runner scanning", async () => {
  const publishScript = await text("scripts/publish-npm-packages.sh");
  assert.match(publishScript, /\bnpm\s+(?:access|dist-tag|view)\b/);
  assert.equal(
    await automationDocumentIsForbidden(
      workflowWithCommand("./scripts/publish-npm-packages.sh"),
      async () =>
        assert.fail("direct release scripts are the explicit audit boundary"),
    ),
    false,
  );
});

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function nanoid3OverrideFloor(range) {
  const trimmed = String(range ?? "").trim();
  const bounded = /^(?:\^|~)?(3\.\d+\.\d+)$/.exec(trimmed);
  if (bounded) return bounded[1];
  const explicit = /^>=\s*(3\.\d+\.\d+)\s+<\s*4(?:\.0\.0)?$/.exec(trimmed);
  return explicit?.[1] ?? null;
}

function resolvedNanoid3Versions(lockfile) {
  const document = loadYaml(lockfile);
  if (document == null || typeof document !== "object") return [];

  const packages = document.packages;
  if (packages == null || typeof packages !== "object") return [];

  return [
    ...new Set(
      Object.keys(packages).flatMap((packageKey) => {
        const match = /^nanoid@(3\.\d+\.\d+)(?:\(.*\))?$/.exec(packageKey);
        return match == null ? [] : [match[1]];
      }),
    ),
  ];
}

test("extracts compatible nanoid 3.x floors and compares versions semantically", () => {
  assert.equal(nanoid3OverrideFloor("^3.3.18"), "3.3.18");
  assert.equal(nanoid3OverrideFloor("~3.3.19"), "3.3.19");
  assert.equal(nanoid3OverrideFloor(">=3.3.18 <4"), "3.3.18");
  assert.equal(nanoid3OverrideFloor("^3.3.17"), "3.3.17");
  assert.equal(nanoid3OverrideFloor("*"), null);
  assert.ok(compareVersions("3.3.17", "3.3.18") < 0);
  assert.ok(compareVersions("3.3.19", "3.3.18") > 0);
  assert.ok(compareVersions("3.10.0", "3.3.18") > 0);
  assert.equal(compareVersions("3.3.18", "3.3.18"), 0);
  assert.deepEqual(
    resolvedNanoid3Versions(`
lockfileVersion: '9.0'
packages:
    "nanoid@3.3.18":
      resolution: {integrity: first}
    'nanoid@3.3.19(peer@1.0.0)': {resolution: {integrity: second}}
    nanoid@5.1.6: {}
snapshots: {nanoid@3.2.0: {}}
`),
    ["3.3.18", "3.3.19"],
  );
});

test("devloops policy keeps supported explicit routing, provenance, dynamic cost, and mandatory lenses", async () => {
  const config = await text(".devloops");
  assert.match(config, /strategy:\n  default: github-first/);
  assert.match(config, /inputSource:\n  default: tracker/);
  assert.match(config, /maxCopilotRounds: 0/);
  assert.match(config, /requireFanoutProvenance: true/);
  assert.match(config, /dynamicAngles: true/);
  assert.match(
    config,
    /blockCleanOnFindingSeverities:\n      - must-fix\n      - worth-fixing-now/g,
  );
  for (const lens of [
    "pr-description",
    "pr-checklist-matrix",
    "correctness",
    "coverage",
    "security",
    "midnight-did-surface",
  ]) {
    assert.match(config, new RegExp(`- ${lens}`));
  }
  assert.doesNotMatch(config, /external-review/);
  assert.match(config, /independent-review/);
  assert.match(config, /not Pat and not a substitute/);
});

test("code-scanning supply-chain remediations do not regress", async () => {
  const [workflows, packageJson, lockfile] = await Promise.all([
    automationYamlTexts(),
    text("package.json").then((contents) => JSON.parse(contents)),
    text("pnpm-lock.yaml"),
  ]);

  for (const workflow of workflows) {
    assert.equal(
      await automationDocumentIsForbidden(workflow),
      false,
      `workflow ${loadYaml(workflow)?.name ?? "document"} and delegated runner lanes must not invoke npm or npx`,
    );
  }

  const safeNanoid3Floor = "3.3.18";
  const overrideFloor = nanoid3OverrideFloor(
    packageJson.pnpm?.overrides?.nanoid,
  );
  assert.ok(
    overrideFloor != null &&
      compareVersions(overrideFloor, safeNanoid3Floor) >= 0,
    `root nanoid override must declare a compatible 3.x floor at or above ${safeNanoid3Floor}`,
  );

  const resolvedVersions = resolvedNanoid3Versions(lockfile);
  assert.ok(resolvedVersions.length > 0, "lockfile must resolve nanoid 3.x");
  for (const version of resolvedVersions) {
    assert.ok(
      compareVersions(version, safeNanoid3Floor) >= 0,
      `resolved nanoid ${version} is below the safe ${safeNanoid3Floor} floor`,
    );
  }
});

test("pnpm supply-chain policy stays strict with only reviewed exact-version exclusions", async () => {
  const workspace = await text("pnpm-workspace.yaml");
  assert.match(workspace, /^trustPolicy: no-downgrade$/m);

  const exclusions = workspace.match(
    /^trustPolicyExclude:\n((?: {2}.*(?:\n|$))*)/m,
  );
  assert.ok(exclusions, "trustPolicyExclude must remain explicit");
  assert.deepEqual(
    [...exclusions[1].matchAll(/^  - (\S+)$/gm)].map((match) => match[1]),
    ["tinyexec@1.2.2", "pino@9.14.0"],
  );
  assert.match(
    exclusions[1],
    /pino@9\.14\.0[\s\S]*already-locked[\s\S]*integrity matches npm[\s\S]*signed upstream tag commit 339f1d6c899fa584324e15c587fbd811664dd07c[\s\S]*lacks[\s\S]*trusted-publisher provenance used by pino@9\.13\.1/,
  );
});

test("branch, runtime, local-validation, and exact-head review invariants stay documented", async () => {
  const [agent, ignore, packageJson, policy] = await Promise.all([
    text("AGENT.md"),
    text(".gitignore"),
    text("package.json").then((contents) => JSON.parse(contents)),
    text(".github/review-policy.json").then((contents) => JSON.parse(contents)),
  ]);
  assert.match(agent, /origin\/develop.*normal feature integration base/);
  assert.match(agent, /main.*default.*release branch/);
  assert.match(agent, /existing PR.*actual base/i);
  assert.match(agent, /records only `requested`/);
  assert.match(agent, /audit-pr-feedback\.mjs/);
  assert.match(agent, /verify every commit in the PR range/);
  assert.match(agent, /GPG or SSH signature/);
  assert.match(agent, /Policy-listed dependency bots/);
  assert.match(packageJson.scripts.verify, /coverage:all/);
  for (const runtimePath of [
    "/.pi-subagents/",
    "/.pi/runner-coordination/",
    "/.pi/dev-loop-retrospective-checkpoint.json",
  ]) {
    assert.match(ignore, new RegExp(runtimePath.replaceAll("/", "\\/")));
  }
  assert.deepEqual(policy.audit.requiredReviewerLogins, ["patextreme"]);
  assert.deepEqual(policy.commitIntegrity.acceptedSignatureTypes, [
    "GpgSignature",
    "SshSignature",
  ]);
  assert.deepEqual(policy.commitIntegrity.dcoExemptBots, [
    {
      authorLogin: "dependabot[bot]",
      signatureSignerLogins: ["web-flow"],
    },
    {
      authorLogin: "renovate[bot]",
      signatureSignerLogins: ["web-flow"],
    },
  ]);
});
