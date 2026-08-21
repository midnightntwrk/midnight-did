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

function mergedEnv(...environments) {
  return Object.assign(
    {},
    ...environments.filter(
      (environment) => environment != null && typeof environment === "object",
    ),
  );
}

function githubActionsRunCommands(workflow) {
  const document = loadYaml(workflow);
  if (document == null || typeof document !== "object") return [];

  const commands = [];
  const collectSteps = (steps, ...environments) => {
    if (!Array.isArray(steps)) return;
    for (const step of steps) {
      if (
        step != null &&
        typeof step === "object" &&
        typeof step.run === "string"
      ) {
        commands.push({
          run: step.run,
          env: mergedEnv(...environments, step.env),
        });
      }
    }
  };

  if (document.jobs != null && typeof document.jobs === "object") {
    for (const job of Object.values(document.jobs)) {
      if (job != null && typeof job === "object") {
        collectSteps(job.steps, document.env, job.env);
      }
    }
  }
  if (
    document.runs != null &&
    typeof document.runs === "object" &&
    document.runs.using === "composite"
  ) {
    collectSteps(document.runs.steps, document.env);
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
  "npx",
  "setsid",
  "stdbuf",
  "sudo",
  "time",
  "timeout",
  "xargs",
]);

const shellInterpreters = new Set([
  "bash",
  "dash",
  "ksh",
  "powershell",
  "pwsh",
  "sh",
  "zsh",
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
  npx: new Set(["-c", "-p", "--call", "--package"]),
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

const wrapperShortOptionsWithArguments = {
  env: new Set(["C", "S", "u"]),
  exec: new Set(["a"]),
  ionice: new Set(["c", "n", "p", "P", "u"]),
  nice: new Set(["n"]),
  npx: new Set(["c", "p"]),
  stdbuf: new Set(["e", "i", "o"]),
  sudo: new Set(["C", "D", "g", "h", "p", "R", "T", "u"]),
  time: new Set(["f", "o"]),
  timeout: new Set(["k", "s"]),
  xargs: new Set(["a", "d", "E", "I", "L", "n", "P", "s"]),
};

const npmInstallCommands = new Set([
  "add",
  "i",
  "in",
  "ins",
  "inst",
  "insta",
  "instal",
  "install",
  "isnt",
  "isnta",
  "isntal",
  "isntall",
  "up",
  "update",
  "udpate",
  "upgrade",
]);

const npmOptionsWithArguments = new Set([
  "-C",
  "--cache",
  "--location",
  "--prefix",
  "--registry",
  "--userconfig",
]);

const npmExecOptionsWithArguments = new Set([
  ...npmOptionsWithArguments,
  "-p",
  "-w",
  "--package",
  "--workspace",
]);

function staticShellWord(node) {
  if (node == null) return null;
  if (
    ["number", "string_content", "variable_name", "word"].includes(node.type)
  ) {
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
    if (/^-[^-]/.test(token)) {
      const argumentOptions = wrapperShortOptionsWithArguments[wrapper];
      const optionBody = token.slice(1);
      const optionCharacters = [...optionBody];
      const argumentIndex = optionCharacters.findIndex((option) =>
        argumentOptions?.has(option),
      );
      const trailingOptions = optionCharacters.slice(argumentIndex + 1);
      const consumesSeparateArguments =
        argumentIndex !== -1 &&
        (trailingOptions.length === 0 ||
          trailingOptions.every((option) => argumentOptions?.has(option)));
      if (consumesSeparateArguments) {
        const argumentCount = optionCharacters.filter((option) =>
          argumentOptions?.has(option),
        ).length;
        if (index + argumentCount >= args.length) return null;
        index += 1 + argumentCount;
        continue;
      }
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

function staticShellAssignment(node) {
  const name = staticShellWord(node.childForFieldName("name"));
  const value = staticShellWord(node.childForFieldName("value"));
  return name == null || value == null ? null : `${name}=${value}`;
}

function assignmentEnablesGlobalInstall(assignment) {
  return /^npm_config_(?:global|location)=(?:1|global|true)$/i.test(assignment);
}

function wrapperCommandString(args, wrapper, stringOptions) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") return null;
    if (wrapper === "env" && shellAssignment.test(arg)) continue;
    if (stringOptions.includes(arg)) return args[index + 1] ?? null;
    for (const option of stringOptions) {
      if (arg.startsWith(`${option}=`)) {
        return arg.slice(option.length + 1);
      }
    }
    const optionsWithArguments =
      wrapper === "npm-exec"
        ? npmExecOptionsWithArguments
        : wrapperOptionsWithArguments[wrapper];
    if (optionsWithArguments?.has(arg)) {
      index += 1;
      continue;
    }
    if (!arg.startsWith("-") || arg === "-") return null;
  }
  return null;
}

function npmCommandIndex(args, optionsWithArguments = npmOptionsWithArguments) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (optionsWithArguments.has(arg)) {
      index += 1;
      continue;
    }
    if (!arg.startsWith("-")) return index;
  }
  return -1;
}

function npmArgsEnableGlobal(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--location") {
      if (args[index + 1]?.toLowerCase() === "global") return true;
      index += 1;
      continue;
    }
    if (npmOptionsWithArguments.has(arg)) {
      index += 1;
      continue;
    }
    if (
      arg === "-g" ||
      arg === "--global" ||
      /^--global=(?:true|1)$/i.test(arg) ||
      /^--location=global$/i.test(arg)
    ) {
      return true;
    }
  }
  return false;
}

function npmInvocationIsGlobalInstall(args, globalFromEnvironment) {
  const optionsEnd = args.indexOf("--");
  const effectiveArgs = optionsEnd === -1 ? args : args.slice(0, optionsEnd);
  const commandIndex = npmCommandIndex(effectiveArgs);
  const command = effectiveArgs[commandIndex];
  if (!npmInstallCommands.has(command)) return false;
  return globalFromEnvironment || npmArgsEnableGlobal(effectiveArgs);
}

function partialNpmInvocationIsGlobalInstall(node, globalFromEnvironment) {
  const name = staticShellWord(node.childForFieldName("name"));
  if (name == null || path.posix.basename(name) !== "npm") return false;

  const args = node.namedChildren
    .filter(
      (child) =>
        child.type !== "command_name" && child.type !== "variable_assignment",
    )
    .map(staticShellWord);
  const optionsEnd = args.indexOf("--");
  const effectiveArgs = optionsEnd === -1 ? args : args.slice(0, optionsEnd);
  return (
    effectiveArgs.some((arg) => npmInstallCommands.has(arg)) &&
    (globalFromEnvironment || npmArgsEnableGlobal(effectiveArgs))
  );
}

function staticCommandWords(node) {
  const name = staticShellWord(node.childForFieldName("name"));
  const args = node.namedChildren
    .filter(
      (child) =>
        child.type !== "command_name" && child.type !== "variable_assignment",
    )
    .map(staticShellWord);
  return name == null || args.some((arg) => arg == null)
    ? null
    : { name, args };
}

function npmCommandSetsPersistentGlobal(node) {
  const words = staticCommandWords(node);
  if (words == null || path.posix.basename(words.name) !== "npm") return false;

  const commandIndex = npmCommandIndex(words.args);
  const command = words.args[commandIndex];
  const configArgs = words.args
    .slice(commandIndex + 1)
    .filter((arg) => arg !== "--");
  const setArgs = ["c", "config"].includes(command)
    ? configArgs[0] === "set"
      ? configArgs.slice(1)
      : []
    : command === "set"
      ? configArgs
      : [];

  for (let index = 0; index < setArgs.length; index += 1) {
    const inline = /^([^=]+)=(.*)$/.exec(setArgs[index]);
    const key = inline?.[1] ?? setArgs[index];
    const value = inline?.[2] ?? setArgs[index + 1];
    if (assignmentEnablesGlobalInstall(`npm_config_${key}=${value}`)) {
      return true;
    }
    if (inline == null) index += 1;
  }
  return false;
}

function redirectedStatementEnablesGlobalNpm(node) {
  const redirectsToNpmrc = node.namedChildren.some(
    (child) =>
      child.type === "file_redirect" &&
      /(?:^|[\s/])\.npmrc["']?\s*$/.test(child.text),
  );
  if (!redirectsToNpmrc) return false;

  const content = node.namedChildren
    .flatMap((child) =>
      child.type === "command"
        ? (staticCommandWords(child)?.args ?? [])
        : child.type === "heredoc_redirect"
          ? child.namedChildren
              .filter((part) => part.type === "heredoc_body")
              .map((part) => part.text)
          : [],
    )
    .join("\n");
  return /(?:^|\s)(?:global\s*=\s*(?:1|true)|location\s*=\s*global)(?:\s|$)/i.test(
    content.replaceAll(/\\n/g, "\n"),
  );
}

function syntaxTreeEnablesPersistentGlobalNpm(rootNode) {
  const visit = (node) => {
    if (
      node.type === "declaration_command" &&
      node.namedChildren
        .filter((child) => child.type === "variable_assignment")
        .map(staticShellAssignment)
        .some(assignmentEnablesGlobalInstall)
    ) {
      return true;
    }
    if (node.type === "command" && npmCommandSetsPersistentGlobal(node)) {
      return true;
    }
    if (
      node.type === "redirected_statement" &&
      redirectedStatementEnablesGlobalNpm(node)
    ) {
      return true;
    }
    return node.namedChildren.some(visit);
  };
  return visit(rootNode);
}

function effectiveWrappedExecutable(words) {
  let name = words.name;
  let args = words.args;
  while (commandWrappers.has(path.posix.basename(name))) {
    const wrapper = path.posix.basename(name);
    const commandIndex = consumeWrapperArguments(args, wrapper);
    if (commandIndex == null || commandIndex >= args.length) return null;
    name = args[commandIndex];
    args = args.slice(commandIndex + 1);
  }
  return path.posix.basename(name);
}

function commandWordsContainGlobalNpmInstall(
  initialName,
  initialArgs,
  assignments = [],
  inheritedGlobal = false,
) {
  let name = initialName;
  let args = initialArgs;
  const globalFromEnvironment =
    inheritedGlobal ||
    [...assignments, ...args].some(assignmentEnablesGlobalInstall);

  while (commandWrappers.has(path.posix.basename(name))) {
    const wrapper = path.posix.basename(name);
    if (["env", "npx"].includes(wrapper)) {
      const stringOptions =
        wrapper === "env" ? ["-S", "--split-string"] : ["-c", "--call"];
      const commandString = wrapperCommandString(args, wrapper, stringOptions);
      if (commandString != null) {
        return shellCommandContainsGlobalNpmInstall(
          commandString,
          globalFromEnvironment,
        );
      }
    }
    const commandIndex = consumeWrapperArguments(args, wrapper);
    if (commandIndex == null || commandIndex >= args.length) return false;
    name = args[commandIndex];
    args = args.slice(commandIndex + 1);
  }

  const executable = path.posix.basename(name);
  if (executable === "eval") {
    return shellCommandContainsGlobalNpmInstall(
      args.join(" "),
      globalFromEnvironment,
    );
  }
  if (shellInterpreters.has(executable)) {
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      const isCommandOption =
        arg === "-c" ||
        ["-command", "--command"].includes(arg.toLowerCase()) ||
        (/^-[^-]+$/.test(arg) && arg.includes("c"));
      if (
        isCommandOption &&
        args[index + 1] != null &&
        shellCommandContainsGlobalNpmInstall(
          args[index + 1],
          globalFromEnvironment,
        )
      ) {
        return true;
      }
    }
    return false;
  }

  if (executable !== "npm") return false;
  if (npmInvocationIsGlobalInstall(args, globalFromEnvironment)) return true;

  const optionsEnd = args.indexOf("--");
  const commandIndex = npmCommandIndex(
    optionsEnd === -1 ? args : args.slice(0, optionsEnd),
  );
  if (["exec", "x"].includes(args[commandIndex])) {
    const execArgs = args.slice(commandIndex + 1);
    const execOptionsEnd = execArgs.indexOf("--");
    const stringOptionArgs =
      execOptionsEnd === -1 ? execArgs : execArgs.slice(0, execOptionsEnd);
    const commandString = wrapperCommandString(stringOptionArgs, "npm-exec", [
      "-c",
      "--call",
    ]);
    if (commandString != null) {
      return shellCommandContainsGlobalNpmInstall(
        commandString,
        globalFromEnvironment,
      );
    }

    const nestedOffset = npmCommandIndex(execArgs, npmExecOptionsWithArguments);
    const nestedCommandIndex =
      optionsEnd === -1
        ? nestedOffset === -1
          ? args.length
          : commandIndex + 1 + nestedOffset
        : optionsEnd + 1;
    if (nestedCommandIndex < args.length) {
      return commandWordsContainGlobalNpmInstall(
        args[nestedCommandIndex],
        args.slice(nestedCommandIndex + 1),
        assignments,
        globalFromEnvironment,
      );
    }
  }
  return false;
}

function commandNodeContainsGlobalNpmInstall(node, inheritedGlobal) {
  const words = staticCommandWords(node);
  const assignments = node.namedChildren
    .filter((child) => child.type === "variable_assignment")
    .map(staticShellAssignment)
    .filter((assignment) => assignment != null);
  const globalFromEnvironment =
    inheritedGlobal || assignments.some(assignmentEnablesGlobalInstall);
  if (words == null) {
    return partialNpmInvocationIsGlobalInstall(node, globalFromEnvironment);
  }
  return commandWordsContainGlobalNpmInstall(
    words.name,
    words.args,
    assignments,
    inheritedGlobal,
  );
}

function shellCommandContainsGlobalNpmInstall(
  command,
  inheritedGlobal = false,
) {
  const tree = shellParser.parse(command.replaceAll(/\\\r?\n/g, " "));
  const enablesPersistentGlobal = syntaxTreeEnablesPersistentGlobalNpm(
    tree.rootNode,
  );
  if (enablesPersistentGlobal) return true;
  const persistentGlobal = inheritedGlobal;
  const visit = (node) => {
    if (
      node.type === "command" &&
      commandNodeContainsGlobalNpmInstall(node, persistentGlobal)
    ) {
      return true;
    }
    if (node.type === "redirected_statement") {
      const commandNode = node.namedChildren.find(
        (child) => child.type === "command",
      );
      const words =
        commandNode == null ? null : staticCommandWords(commandNode);
      if (
        words != null &&
        shellInterpreters.has(effectiveWrappedExecutable(words))
      ) {
        for (const redirect of node.namedChildren.filter(
          (child) => child.type === "heredoc_redirect",
        )) {
          for (const body of redirect.namedChildren.filter(
            (child) => child.type === "heredoc_body",
          )) {
            if (
              shellCommandContainsGlobalNpmInstall(body.text, persistentGlobal)
            ) {
              return true;
            }
          }
        }
      }
    }
    return node.namedChildren.some(visit);
  };
  return visit(tree.rootNode);
}

function githubEnvEnablesGlobalInstall(environment) {
  return Object.entries(environment).some(([name, value]) =>
    assignmentEnablesGlobalInstall(`${name}=${String(value)}`),
  );
}

function containsGlobalNpmInstall(workflow) {
  return githubActionsRunCommands(workflow).some(({ run, env }) =>
    shellCommandContainsGlobalNpmInstall(
      run,
      githubEnvEnablesGlobalInstall(env),
    ),
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
    "run: npm install $PACKAGE npm@12 -g",
    "run: npm i --location global npm@12",
    "run: echo ready && npm --silent i --location=GLOBAL npm@12",
    "run: sudo npm install -g npm@12",
    "run: sudo -n -u root env NODE_ENV=production npm install -g npm@12",
    "run: sudo -Enu root npm install -g npm@12",
    "run: sudo -gu group root npm install -g npm@12",
    "run: sudo -up root prompt npm install -g npm@12",
    "run: sudo -uh root host npm install -g npm@12",
    "run: env -i FOO=bar npm i --global npm@12",
    "run: env -S 'npm install -g npm@12'",
    "run: env --split-string 'npm install -g npm@12'",
    "run: env --split-string='npm install -g npm@12'",
    "run: env npm_config_global='true' -S 'npm install npm@12'",
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
    "run: npx npm install -g npm@12",
    "run: |\n  npx -c 'npm install -g npm@12'",
    "run: npm exec -- npm install -g npm@12",
    "run: npm exec npm install -g npm@12",
    "run: npm exec --prefix ./tmp npm install -g npm@12",
    "run: npm exec --package npm@12 npm install -g npm@12",
    "run: npm exec --package npm@12 -c 'npm install -g npm@12'",
    "run: npm exec -c 'npm install -g npm@12'",
    "run: npm x --call 'npm install -g npm@12'",
    "run: npm exec --call='npm install -g npm@12'",
    "run: npm_config_global='true' npm exec -c 'npm install npm@12'",
    "run: npm_config_location='global' npm x --call='npm install npm@12'",
    "run: npm_config_global=true npm exec -- npm install npm@12",
    "run: npm_config_global=true npm install npm@12",
    'run: npm_config_global="true" npm install npm@12',
    "run: npm_config_global='true' npm install npm@12",
    'run: npm_config_location="global" npm install npm@12',
    "run: env npm_config_location=global npm install npm@12",
    "run: env npm_config_location='global' npm install npm@12",
    "run: npm --location global install npm@12",
    "run: npm add -g npm@12",
    "run: npm update -g npm@12",
    "run: npm up --global npm@12",
    "run: npm upgrade --location=global npm@12",
    "run: npm isntall --global npm@12",
    'run: |\n  eval "npm install -g npm@12"',
    'run: |\n  sudo eval "npm install -g npm@12"',
    'run: |\n  env FOO=bar eval "npm install -g npm@12"',
    'run: n"pm" install -g npm@12',
    "run: $(npm install -g npm@12)",
    'run: "`npm i -g npm@12`"',
    "run: |\n  bash -c 'npm install -g npm@12'",
    "run: |\n  npm_config_global='true' bash -c 'npm install npm@12'",
    "run: |\n  env npm_config_location='global' sh -c 'npm install npm@12'",
    "run: |\n  export npm_config_global='true'\n  npm install npm@12",
    "run: |\n  export npm_config_location=global\n  bash -c 'npm install npm@12'",
    "run: npm config set global true",
    "run: npm set location=global",
    "run: |\n  npm config set global true\n  npm install npm@12",
    "run: npm config set foo=bar global=true",
    "run: npm config -- set foo bar location global",
    "run: |\n  npm set location=global\n  npm update npm@12",
    "run: echo 'global=true' >> .npmrc",
    "run: |\n  printf 'global=true\\n' >> ~/.npmrc\n  npm install npm@12",
    "run: |\n  cat >> ~/.npmrc <<'NPMRC'\n  location=global\n  NPMRC\n  npm install npm@12",
    "run: |\n  bash <<'SCRIPT'\n  npm install -g npm@12\n  SCRIPT",
    "run: |\n  env bash <<'SCRIPT'\n  npm install -g npm@12\n  SCRIPT",
    "run: |\n  sh <<'SCRIPT'\n  npm_config_global='true' npm install npm@12\n  SCRIPT",
    "run: |\n  sh -c 'sudo npm install -g npm@12'",
    "run: |\n  sh -c 'echo safe' -c 'npm install -g npm@12'",
    "run: |\n  pwsh -Command 'Write-Output safe' -Command 'npm install -g npm@12'",
    "run: |\n  pwsh -Command 'npm install -g npm@12'",
    "run: (npm install -g npm@12)",
    "run: |\n  { npm install -g npm@12; }",
    "run: |\n  echo ready\n  npm install -g npm@12",
    "run: |2-\n  npm install -g npm@12",
    "run: |-2\n  npm install -g npm@12",
    "run: >-\n  if npm install -g npm@12; then\n  echo installed; fi",
    "run: >-\n  echo ready\n    npm install -g npm@12",
    // Intentionally fail closed on syntactically present commands, even when
    // shell control flow makes them unreachable.
    "run: false && npm install -g npm@12",
  ]) {
    const workflow = workflowWithRunScalar(runScalar);
    assert.equal(containsGlobalNpmInstall(workflow), true, runScalar);
  }

  for (const runScalar of [
    "run: pnpm install --frozen-lockfile",
    "run: npm install",
    "run: npm install --global=false package",
    "run: npm install --location=project package",
    "run: npm install --registry -g package",
    "run: npm update package",
    "run: npm up --global=false package",
    'run: npm_config_global="false" npm install package',
    "run: npm_config_global='0' npm install package",
    'run: npm_config_location="project" npm install package',
    "run: npm exec -c 'npm install package'",
    "run: npm x --call 'npm install package'",
    "run: npm exec --call='npm install package'",
    "run: npm_config_global='false' npm exec -c 'npm install package'",
    "run: npm exec --prefix -c 'npm install -g npm@12'",
    "run: npm exec --package -c 'npm install -g npm@12'",
    "run: npx --package -c 'npm install -g npm@12'",
    "run: env -S 'npm install package'",
    "run: env --unset -S 'npm install -g npm@12'",
    "run: env --split-string 'pnpm install --frozen-lockfile'",
    "run: env npm_config_location='project' -S 'npm install package'",
    "run: npm_config_global='false' bash -c 'npm install package'",
    "run: |\n  export npm_config_global='false'\n  npm install package",
    "run: |\n  export npm_config_location=project\n  npm install package",
    "run: npm config set foo=bar global=false",
    "run: npm config -- set foo bar location project",
    "run: |\n  npm config set global false\n  npm install package",
    "run: |\n  npm set location=project\n  npm install package",
    "run: |\n  printf 'global=false\\n' >> ~/.npmrc\n  npm install package",
    "run: |\n  cat >> ~/.npmrc <<'NPMRC'\n  location=project\n  NPMRC\n  npm install package",
    "run: |\n  cat <<'SCRIPT'\n  npm install -g npm@12\n  SCRIPT",
    "run: |\n  bash <<'SCRIPT'\n  npm install package\n  SCRIPT",
    "run: npm run build -- -g i",
    "run: npm install -- -g npm@12",
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

test("scans workflow and composite-action run steps with inherited env", () => {
  const workflow = `
env:
  npm_config_global: "true"
jobs:
  workflow-env:
    steps:
      - run: npm install package
  job-env:
    env:
      npm_config_global: "false"
      npm_config_location: global
    steps:
      - run: npm install package
  step-env:
    env:
      npm_config_global: "false"
    steps:
      - run: npm install package
        env:
          npm_config_global: "true"
`;
  assert.equal(containsGlobalNpmInstall(workflow), true);

  const overriddenWorkflow = `
env:
  npm_config_global: "true"
jobs:
  safe:
    env:
      npm_config_global: "false"
    steps:
      - run: npm install package
`;
  assert.equal(containsGlobalNpmInstall(overriddenWorkflow), false);

  const composite = `
name: Composite
runs:
  using: composite
  steps:
    - shell: bash
      run: npm install package
      env:
        npm_config_location: global
`;
  assert.equal(containsGlobalNpmInstall(composite), true);
});

test("scans only supported workflow and composite-action run steps", () => {
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

  const nonCompositeAction = `
name: JavaScript action
runs:
  using: node24
  main: npm install -g npm@12
`;
  assert.equal(containsGlobalNpmInstall(nonCompositeAction), false);
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
      containsGlobalNpmInstall(workflow),
      false,
      "repository workflows must not install npm packages globally",
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
