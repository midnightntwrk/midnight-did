#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { spawn } from "node:child_process";
import { closeSync, openSync, writeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parsePositiveInteger(value, label) {
  if (!/^[1-9]\d*$/u.test(value ?? "")) {
    throw new Error(`${label} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a safe integer.`);
  }
  return parsed;
}

function parseArguments(argv) {
  const separator = argv.indexOf("--");
  if (separator < 0 || separator === argv.length - 1) {
    throw new Error("A command is required after --.");
  }
  const options = new Map();
  for (let index = 0; index < separator; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (value == null || !name.startsWith("--") || options.has(name)) {
      throw new Error("Malformed bounded-command options.");
    }
    options.set(name, value);
  }
  const allowed = new Set(["--timeout-ms", "--output-limit", "--output-file"]);
  if ([...options.keys()].some((name) => !allowed.has(name))) {
    throw new Error("Unsupported bounded-command option.");
  }
  const outputFile = options.get("--output-file");
  if (outputFile == null || outputFile.length === 0) {
    throw new Error("--output-file is required.");
  }
  return {
    command: argv[separator + 1],
    args: argv.slice(separator + 2),
    outputFile,
    outputLimit: parsePositiveInteger(
      options.get("--output-limit"),
      "--output-limit",
    ),
    timeoutMs: parsePositiveInteger(
      options.get("--timeout-ms"),
      "--timeout-ms",
    ),
  };
}

function terminate(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  try {
    if (process.platform !== "win32" && child.pid != null) {
      process.kill(-child.pid, "SIGKILL");
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // The process may have exited between inspection and termination.
  }
}

export async function runBoundedCommand({
  command,
  args,
  outputFile,
  outputLimit,
  timeoutMs,
  env = process.env,
  cwd = process.cwd(),
}) {
  const descriptor = openSync(outputFile, "w", 0o600);
  try {
    return await new Promise((resolve) => {
      let outputBytes = 0;
      let reason = null;
      let settled = false;
      const child = spawn(command, args, {
        cwd,
        detached: process.platform !== "win32",
        env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stop = (nextReason) => {
        if (reason != null) return;
        reason = nextReason;
        terminate(child);
      };
      const collect = (chunk) => {
        if (reason != null) return;
        outputBytes += chunk.length;
        if (outputBytes > outputLimit) {
          stop("output-limit");
          return;
        }
        writeSync(descriptor, chunk);
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
      child.on("error", () => stop("spawn-error"));
      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code, signal, reason });
      });
      const timer = setTimeout(() => stop("timeout"), timeoutMs);
      timer.unref();
    });
  } finally {
    closeSync(descriptor);
  }
}

const isDirectExecution =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await runBoundedCommand(options);
    if (result.reason === "timeout") process.exitCode = 124;
    else if (result.reason === "output-limit") process.exitCode = 74;
    else if (result.reason != null || result.signal != null)
      process.exitCode = 1;
    else process.exitCode = result.code ?? 1;
  } catch {
    process.exitCode = 2;
  }
}
