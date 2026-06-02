#!/usr/bin/env node
import { stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `command` is intentionally one executable path. Add a separate args field
// before introducing commands that need arguments.
export const laneTargets = [
  {
    name: "core",
    label: "Core pipeline",
    command: "./run-core.sh",
    description: "DID core package lint, build, and unit-test lane.",
    supportsLight: true,
    supportsStrict: true,
    supportsMetrics: true,
  },
  {
    name: "api",
    label: "API pipeline",
    command: "./run-api.sh",
    description: "DID API package build and API tests.",
    supportsLight: true,
    supportsStrict: true,
    supportsMetrics: true,
  },
  {
    name: "docs",
    label: "Docs pipeline",
    command: "./run-docs.sh",
    description: "DID documentation site build lane.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: true,
  },
];

export const laneTargetByName = new Map(laneTargets.map((target) => [target.name, target]));
export const fullPipelineOrder = ["core", "api"];
export const pipelineSteps = fullPipelineOrder.map((name) => {
  const laneTarget = laneTargetByName.get(name);
  if (!laneTarget) {
    throw new Error(`Missing full pipeline lane target: ${name}`);
  }
  return laneTarget;
});

export const targets = [
  {
    name: "full",
    description: "Run the full DID repository validation pipeline. This is the default target.",
    supportsLight: true,
    supportsStrict: true,
    supportsMetrics: true,
  },
  ...laneTargets.map(({ name, description, supportsLight, supportsStrict, supportsMetrics }) => ({
    name,
    description,
    supportsLight,
    supportsStrict,
    supportsMetrics,
  })),
  {
    name: "clean-artifacts",
    description: "Remove generated build/test artifacts without deleting dependencies or local secrets.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: false,
  },
  {
    name: "artifact-status",
    description: "Print managed Compact artifact readiness and source manifest JSON.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: false,
  },
  {
    name: "check-managed-artifacts",
    description: "Fail if managed Compact artifacts are missing, stale, or miscataloged.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: false,
  },
  {
    name: "integration-report",
    description: "Print a DID package and sibling VC integration readiness report.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: false,
  },
  {
    name: "integration-report-schema",
    description: "Print the machine-readable DID integration report schema contract.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: false,
  },
  {
    name: "check-integration",
    description: "Fail if sibling VC references cannot be satisfied by this DID checkout/vendor set.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: false,
  },
  {
    name: "targets",
    description: "Print this runner target catalog.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: false,
  },
  {
    name: "help",
    description: "Print runner usage and target details.",
    supportsLight: false,
    supportsStrict: false,
    supportsMetrics: false,
  },
];

export const targetNames = new Set(targets.map((target) => target.name));
export const targetByName = new Map(targets.map((target) => [target.name, target]));

export const stepsForTarget = (targetName = "full") => {
  if (targetName === "full") {
    return pipelineSteps;
  }

  const laneTarget = laneTargetByName.get(targetName);
  if (!laneTarget) {
    throw new Error(`Unknown executable target: ${targetName}`);
  }

  return [laneTarget];
};

const printRows = (rows) => {
  const width = Math.max(...rows.map(([name]) => name.length));
  for (const [name, description] of rows) {
    stdout.write(`  ${name.padEnd(width)}  ${description}\n`);
  }
};

export const printTargets = () => {
  stdout.write("Targets:\n");
  printRows(targets.map((target) => [target.name, target.description]));
  stdout.write("\nPipeline steps for target 'full':\n");
  printRows(pipelineSteps.map((step) => [step.command, `${step.label}: ${step.description}`]));
  stdout.write("\nSingle-lane target commands:\n");
  printRows(laneTargets.map((target) => [target.name, target.command]));
};

export const printLightTargets = () => {
  stdout.write(`${targets.filter((target) => target.supportsLight).map((target) => target.name).join(", ")}\n`);
};

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const [command, value] = process.argv.slice(2);

if (isDirectExecution) {
  switch (command) {
    case "--json":
      stdout.write(`${JSON.stringify({ targets, pipelineSteps }, null, 2)}\n`);
      break;
    case "--names":
      stdout.write(`${targets.map((target) => target.name).join("\n")}\n`);
      break;
    case "--has-target":
      process.exit(targetNames.has(value) ? 0 : 1);
      break;
    case "--supports-light":
      process.exit(targetByName.get(value)?.supportsLight ? 0 : 1);
      break;
    case "--supports-strict":
      process.exit(targetByName.get(value)?.supportsStrict ? 0 : 1);
      break;
    case "--light-targets":
      printLightTargets();
      break;
    case "--step-labels":
      stdout.write(`${stepsForTarget(value).map((step) => step.label).join("\n")}\n`);
      break;
    case "--step-commands":
      stdout.write(`${stepsForTarget(value).map((step) => step.command).join("\n")}\n`);
      break;
    case "--targets":
    case "--help":
    case undefined:
      printTargets();
      break;
    default:
      console.error(`Unknown run target catalog command: ${command}`);
      process.exit(1);
  }
}
