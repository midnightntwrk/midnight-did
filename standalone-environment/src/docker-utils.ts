import type { StartedDockerComposeEnvironment } from "testcontainers";

/**
 * Check whether a container runtime (Docker/Podman) is available.
 * Returns false if testcontainers cannot connect to a runtime.
 */
export const containerRuntimeAvailable = async (): Promise<boolean> => {
  try {
    const { getContainerRuntimeClient } = await import(
      // @ts-expect-error — testcontainers internal path, no public type
      "testcontainers/build/container-runtime/clients/client.js"
    );
    await getContainerRuntimeClient();
    return true;
  } catch {
    return false;
  }
};

/**
 * Map a container's first exposed port to a localhost URL.
 */
export const mapContainerPort = (
  env: StartedDockerComposeEnvironment,
  url: string,
  containerName: string,
): string => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);
  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, "");
};

/**
 * Race a promise against a timeout. Throws on timeout.
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> =>
  await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
