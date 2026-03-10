import { spawnSync } from "node:child_process";

import type { StartedDockerComposeEnvironment } from "testcontainers";

export const waitForMappedPort = async (
  env: StartedDockerComposeEnvironment,
  options: {
    cwd: string;
    composeFile: string;
    projectName: string;
    serviceName: string;
    internalPort: number;
    timeoutMs?: number;
  },
): Promise<number> => {
  const {
    cwd,
    composeFile,
    projectName,
    serviceName,
    internalPort,
    timeoutMs = 30_000,
  } = options;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const port = spawnSync(
        "docker",
        [
          "compose",
          "-p",
          projectName,
          "-f",
          composeFile,
          "port",
          serviceName,
          String(internalPort),
        ],
        {
          cwd,
          encoding: "utf8",
        },
      );
      if (port.status === 0 && port.stdout) {
        const raw = port.stdout.trim().split("\n")[0] ?? "";
        const mapped = Number(raw.split(":").at(-1));
        if (Number.isInteger(mapped) && mapped > 0) return mapped;
      }
    } catch {
      // Fall back to testcontainers API.
    }

    try {
      return env.getContainer(serviceName).getMappedPort(internalPort);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(
    `Cannot get mapped port for service '${serviceName}' (${internalPort})`,
  );
};

export const cleanupComposeProject = (options: {
  cwd: string;
  composeFile: string;
  projectName: string;
}): void => {
  const { cwd, composeFile, projectName } = options;
  if (!projectName) return;
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-p",
      projectName,
      "-f",
      composeFile,
      "down",
      "--volumes",
      "--remove-orphans",
    ],
    {
      cwd,
      encoding: "utf8",
      timeout: 30_000,
      killSignal: "SIGKILL",
    },
  );
  if (result.status !== 0) {
    console.warn("[resolver-e2e] best-effort compose cleanup failed", {
      projectName,
      composeFile,
      status: result.status,
      error: result.error?.message,
      stderr: result.stderr,
      stdout: result.stdout,
    });
  }
};
