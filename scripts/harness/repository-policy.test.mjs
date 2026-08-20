import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

function githubActionsRunCommands(workflow) {
  const document = loadYaml(workflow);
  if (document == null || typeof document !== "object") return [];

  const jobs = document.jobs;
  if (jobs == null || typeof jobs !== "object") return [];

  const commands = [];
  for (const job of Object.values(jobs)) {
    if (job == null || typeof job !== "object" || !Array.isArray(job.steps)) {
      continue;
    }
    for (const step of job.steps) {
      if (
        step != null &&
        typeof step === "object" &&
        typeof step.run === "string"
      ) {
        commands.push(step.run);
      }
    }
  }
  return commands;
}

const shellParser = new Parser();
shellParser.setLanguage(Bash);

const shellAssignment = /^[A-Za-z_][A-Za-z0-9_]*=.*/;

const commandWrappers = new Set([
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

const wrapperOptionsWithArguments = {
  env: new Set(["-C", "-S", "-u", "--chdir", "--split-string", "--unset"]),
  exec: new Set(["-a"]),
  ionice: new Set([
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
  nice: new Set(["-n", "--adjustment"]),
  stdbuf: new Set(["-e", "-i", "-o"]),
  sudo: new Set([
    "-C",
    "-D",
    "-g",
    "-h",
    "-p",
    "-R",
    "-T",
    "-u",
    "--chdir",
    "--chroot",
    "--command-timeout",
    "--group",
    "--host",
    "--prompt",
    "--user",
  ]),
  time: new Set(["-f", "-o", "--format", "--output"]),
  timeout: new Set(["-k", "-s", "--kill-after", "--signal"]),
  xargs: new Set([
    "-a",
    "-d",
    "-E",
    "-I",
    "-L",
    "-n",
    "-P",
    "-s",
    "--arg-file",
    "--delimiter",
    "--eof",
    "--max-args",
    "--max-chars",
    "--max-lines",
    "--max-procs",
    "--replace",
  ]),
};

const npmOptionsWithArguments = new Set([
  "-C",
  "--cache",
  "--prefix",
  "--registry",
  "--userconfig",
]);

function staticShellWord(node) {
  if (node == null) return null;
  if (["number", "word", "string_content"].includes(node.type)) {
    return node.text.replaceAll(/\\(.)/g, "$1");
  }
  if (node.type === "raw_string") return node.text.slice(1, -1);
  if (["command_name", "concatenation", "string"].includes(node.type)) {
    const parts = node.namedChildren.map(staticShellWord);
    return parts.every((part) => part != null) ? parts.join("") : null;
  }
  return null;
}

function consumeWrapperArguments(args, wrapper) {
  let index = 0;
  let optionsEnded = false;

  while (index < args.length) {
    const token = args[index];
    if (!optionsEnded && token === "--") {
      optionsEnded = true;
      index += 1;
      continue;
    }
    if (wrapper === "env" && shellAssignment.test(token)) {
      index += 1;
      continue;
    }
    if (optionsEnded || !token.startsWith("-") || token === "-") break;
    if (wrapper === "command" && ["-V", "-v"].includes(token)) return null;
    if (wrapperOptionsWithArguments[wrapper]?.has(token)) {
      if (index + 1 >= args.length) return null;
      index += 2;
      continue;
    }
    index += 1;
  }

  if (wrapper === "timeout") {
    const duration = args[index];
    if (
      duration == null ||
      !/^(?:\d+(?:\.\d+)?[smhd]?|\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\})$/.test(
        duration,
      )
    ) {
      return null;
    }
    index += 1;
  }

  return index;
}

function npmInvocationIsGlobalInstall(args) {
  let command = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (npmOptionsWithArguments.has(arg)) {
      index += 1;
      continue;
    }
    if (!arg.startsWith("-")) {
      command = arg;
      break;
    }
  }
  if (command !== "install" && command !== "i") return false;

  return args.some(
    (arg, index) =>
      arg === "-g" ||
      arg === "--global" ||
      /^--global=(?:true|1)$/i.test(arg) ||
      /^--location=global$/i.test(arg) ||
      (arg === "--location" && args[index + 1]?.toLowerCase() === "global"),
  );
}

function commandNodeContainsGlobalNpmInstall(node) {
  const nameNode = node.childForFieldName("name");
  let name = staticShellWord(nameNode);
  let args = node.namedChildren
    .filter(
      (child) =>
        child.type !== "command_name" && child.type !== "variable_assignment",
    )
    .map(staticShellWord);
  if (name == null || args.some((arg) => arg == null)) return false;

  while (commandWrappers.has(path.posix.basename(name))) {
    const wrapper = path.posix.basename(name);
    const commandIndex = consumeWrapperArguments(args, wrapper);
    if (commandIndex == null || commandIndex >= args.length) return false;
    name = args[commandIndex];
    args = args.slice(commandIndex + 1);
  }

  return (
    path.posix.basename(name) === "npm" && npmInvocationIsGlobalInstall(args)
  );
}

function shellCommandContainsGlobalNpmInstall(command) {
  const tree = shellParser.parse(command.replaceAll(/\\\r?\n/g, " "));
  const visit = (node) => {
    if (node.type === "command" && commandNodeContainsGlobalNpmInstall(node)) {
      return true;
    }
    return node.namedChildren.some(visit);
  };
  return visit(tree.rootNode);
}

function containsGlobalNpmInstall(workflow) {
  return githubActionsRunCommands(workflow).some(
    shellCommandContainsGlobalNpmInstall,
  );
}

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
  return [
    ...new Set(
      [...lockfile.matchAll(/^  nanoid@(3\.\d+\.\d+)(?:\([^\n]*\))?:$/gm)].map(
        ([, version]) => version,
      ),
    ),
  ];
}

function workflowWithRunScalar(runScalar) {
  return `jobs:\n  check:\n    steps:\n      - name: Check\n        ${runScalar.replaceAll("\n", "\n        ")}\n`;
}

test("detects global npm installs in parsed GitHub Actions run scalars", () => {
  for (const runScalar of [
    "run: npm install -g npm@12",
    'run: "npm install -g npm@12"',
    'run: "npm install -g npm@12" # trailing comment',
    "run: 'npm install -g npm@12'",
    "run: if npm install -g npm@12; then echo installed; fi",
    "run: npm install --silent -g npm@12",
    "run: npm i --global npm@12",
    "run: npm --global install npm@12",
    "run: npm install --global=true npm@12",
    "run: npm install --location=global npm@12",
    "run: npm i --location global npm@12",
    "run: echo ready && npm --silent i --location=GLOBAL npm@12",
    "run: sudo npm install -g npm@12",
    "run: sudo -n -u root env NODE_ENV=production npm install -g npm@12",
    "run: env -i FOO=bar npm i --global npm@12",
    "run: env --unset HOME -- command -p npm install --location global npm@12",
    "run: exec env FOO=bar npm --global install npm@12",
    "run: time -p sudo --preserve-env=HOME npm install -g npm@12",
    "run: /usr/bin/time -f '%E' /usr/bin/env -u HOME npm install -g npm@12",
    "run: if ! sudo env FOO=bar command exec npm install -g npm@12; then exit 1; fi",
    "run: nice -n 5 npm install -g npm@12",
    "run: timeout --signal TERM 30s npm install -g npm@12",
    "run: nohup npm install -g npm@12",
    "run: xargs -I {} npm install -g npm@12",
    "run: setsid --wait npm install -g npm@12",
    "run: stdbuf -o L npm install -g npm@12",
    "run: ionice -c 2 -n 7 npm install -g npm@12",
    "run: nohup nice timeout 30 env FOO=bar npm install -g npm@12",
    "run: /usr/bin/npm install -g npm@12",
    'run: n"pm" install -g npm@12',
    "run: $(npm install -g npm@12)",
    'run: "`npm i -g npm@12`"',
    "run: (npm install -g npm@12)",
    "run: |\n  { npm install -g npm@12; }",
    "run: |\n  echo ready\n  npm install -g npm@12",
    "run: |2-\n  npm install -g npm@12",
    "run: |-2\n  npm install -g npm@12",
    "run: >-\n  if npm install -g npm@12; then\n  echo installed; fi",
    "run: >-\n  echo ready\n    npm install -g npm@12",
  ]) {
    const workflow = workflowWithRunScalar(runScalar);
    assert.equal(containsGlobalNpmInstall(workflow), true, runScalar);
  }

  for (const runScalar of [
    "run: pnpm install --frozen-lockfile",
    "run: npm install",
    "run: npm install --global=false package",
    "run: npm install --location=project package",
    "run: npm run build -- -g i",
    "run: npm install # -g npm@12",
    'run: "echo npm install -g" # trailing comment',
    "run: 'printf npm install -g'",
    "run: echo sudo env npm install -g npm@12",
    "run: printf '%s' 'sudo npm install -g npm@12'",
    "run: command -v npm install -g npm@12",
    "run: sudo -u npm install -g npm@12",
    "run: env -u npm install -g npm@12",
    "run: time echo npm install -g npm@12",
    "run: timeout echo npm install -g npm@12",
    "run: timeout 30 echo npm install -g npm@12",
    "run: xargs -I npm install -g npm@12",
    "run: ionice -p npm install -g npm@12",
    "run: grep npm install -g commands.txt",
    "run: false && echo npm install -g npm@12",
    "run: |\n  cat <<'EOF'\n  npm install -g npm@12\n  EOF",
    "run: |2-\n  echo 'npm install -g npm@12'\n  pnpm install",
    "run: >-\n  echo ready\n    printf 'npm install -g npm@12'",
  ]) {
    const workflow = workflowWithRunScalar(runScalar);
    assert.equal(containsGlobalNpmInstall(workflow), false, runScalar);
  }
});

test("scans only jobs.*.steps[].run string values", () => {
  const workflow = `
run: npm install -g npm@12
jobs:
  ignored:
    run: npm install -g npm@12
    steps:
      - uses: actions/checkout@immutable
      - run: pnpm install --frozen-lockfile
  reusable:
    uses: owner/repo/.github/workflows/reusable.yml@immutable
`;
  assert.equal(containsGlobalNpmInstall(workflow), false);
});

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
    resolvedNanoid3Versions(
      "  nanoid@3.3.18:\n  nanoid@3.3.19:\n  nanoid@5.1.6:\n  nanoid@3.3.18:\n",
    ),
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
  const [docsLinkWorkflow, packageJson, lockfile] = await Promise.all([
    text(".github/workflows/docs-link-check.yml"),
    text("package.json").then((contents) => JSON.parse(contents)),
    text("pnpm-lock.yaml"),
  ]);

  assert.equal(
    containsGlobalNpmInstall(docsLinkWorkflow),
    false,
    "published-docs workflow must not install npm packages globally",
  );

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
