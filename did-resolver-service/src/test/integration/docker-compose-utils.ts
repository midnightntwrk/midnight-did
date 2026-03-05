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
