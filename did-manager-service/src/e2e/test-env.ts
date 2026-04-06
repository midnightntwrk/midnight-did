import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const managerDir = path.resolve(currentDir, '../..');
const rootDir = path.resolve(managerDir, '..');
const apiDir = path.resolve(rootDir, 'api');
const managerEntry = path.resolve(managerDir, 'dist/index.js');
const composeArgs = ['compose', '-f', 'standalone.yml'];

const fundedSeed = '0000000000000000000000000000000000000000000000000000000000000001';

type PortName = 'node' | 'indexer' | 'proof-server';

export type ManagerE2EEnv = {
  baseUrl: string;
  dataDir: string;
  fundedSeed: string;
  stop: () => Promise<void>;
};

type ManagerProcessOptions = {
  dataDir?: string;
  env?: Record<string, string>;
};

const getFreePort = async (): Promise<number> =>
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate free port')));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });

const dockerCompose = async (...args: string[]): Promise<string> => {
  const { stdout, stderr } = await execFileAsync('docker', [...composeArgs, ...args], {
    cwd: apiDir,
    env: process.env,
  });
  return `${stdout}${stderr}`.trim();
};

const removeStandaloneContainers = async (): Promise<void> => {
  const containerNames = ['did-node', 'did-indexer', 'did-proof-server'];
  await execFileAsync(
    'docker',
    ['rm', '-f', ...containerNames],
    {
      cwd: rootDir,
      env: process.env,
    },
  ).catch(() => undefined);
};

const resolveDockerPort = async (containerName: string, containerPort: string): Promise<number> => {
  const deadline = Date.now() + 30_000;
  let lastOutput = '';

  while (Date.now() < deadline) {
    try {
      const { stdout } = await execFileAsync('docker', ['port', containerName, containerPort], {
        cwd: rootDir,
        env: process.env,
      });
      lastOutput = stdout;
      const line = stdout
        .trim()
        .split('\n')
        .find((entry) => entry.trim().length > 0);
      if (line === undefined) {
        await delay(1_000);
        continue;
      }
      const match = line.match(/:(\d+)\s*$/);
      if (match === null) {
        throw new Error(`Unexpected docker port output for ${containerName}:${containerPort}: ${line}`);
      }
      return Number(match[1]);
    } catch {
      await delay(1_000);
    }
  }

  throw new Error(`No mapped port found for ${containerName}:${containerPort}. Last output: ${lastOutput}`);
};

const resolveStandalonePorts = async (): Promise<Record<PortName, number>> => ({
  node: await resolveDockerPort('did-node', '9944/tcp'),
  indexer: await resolveDockerPort('did-indexer', '8088/tcp'),
  'proof-server': await resolveDockerPort('did-proof-server', '6300/tcp'),
});

const waitForManager = async (baseUrl: string, managerLogs: () => string): Promise<void> => {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // keep polling while the process starts
    }
    await delay(1_000);
  }
  throw new Error(`did-manager-service failed to start.\n${managerLogs()}`);
};

const waitForHttp = async (
  url: string,
  predicate: (response: Response) => boolean,
  label: string,
  timeoutMs = 90_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url);
      if (predicate(response)) return;
    } catch {
      // keep polling while service starts
    }
    await delay(1_000);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
};

const stopProcess = async (child: ChildProcess | null): Promise<void> => {
  if (child === null || child.exitCode !== null) return;

  await new Promise<void>((resolve) => {
    let finished = false;
    const finalize = (): void => {
      if (finished) return;
      finished = true;
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolve();
    };
    const timeout = globalThis.setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      finalize();
    }, 10_000);

    child.once('exit', () => {
      globalThis.clearTimeout(timeout);
      finalize();
    });

    child.kill('SIGINT');
  });
};

const startManagerProcess = async ({ dataDir, env = {} }: ManagerProcessOptions): Promise<ManagerE2EEnv> => {
  const managerPort = await getFreePort();
  const resolvedDataDir = dataDir ?? await mkdtemp(path.join(os.tmpdir(), 'did-manager-e2e-'));
  const removeDataDirOnStop = dataDir === undefined;

  let stdoutLog = '';
  let stderrLog = '';
  const child = spawn(
    process.execPath,
    ['--experimental-specifier-resolution=node', managerEntry],
    {
      cwd: managerDir,
      env: {
        ...process.env,
        DID_MANAGER_HOST: '127.0.0.1',
        DID_MANAGER_PORT: String(managerPort),
        DID_MANAGER_DATA_DIR: resolvedDataDir,
        DID_MANAGER_SETUP: 'standalone',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stdout.on('data', (chunk: Uint8Array | string) => {
    stdoutLog += chunk.toString();
  });
  child.stderr.on('data', (chunk: Uint8Array | string) => {
    stderrLog += chunk.toString();
  });

  const managerLogs = (): string => `STDOUT:\n${stdoutLog}\nSTDERR:\n${stderrLog}`;
  const baseUrl = `http://127.0.0.1:${managerPort}`;

  try {
    await waitForManager(baseUrl, managerLogs);
  } catch (error) {
    await stopProcess(child);
    if (removeDataDirOnStop) {
      await rm(resolvedDataDir, { recursive: true, force: true }).catch(() => undefined);
    }
    throw error;
  }

  return {
    baseUrl,
    dataDir: resolvedDataDir,
    fundedSeed,
    stop: async () => {
      await stopProcess(child);
      if (removeDataDirOnStop) {
        await rm(resolvedDataDir, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
};

export const startManagerE2EEnv = async (): Promise<ManagerE2EEnv> => {
  await removeStandaloneContainers();
  await dockerCompose('down', '--volumes', '--remove-orphans');
  await dockerCompose('up', '-d');

  const standalonePorts = await resolveStandalonePorts();
  await waitForHttp(`http://127.0.0.1:${standalonePorts.node}/health`, (response) => response.ok, 'standalone node');
  await waitForHttp(
    `http://127.0.0.1:${standalonePorts.indexer}/api/v3/graphql`,
    (response) => response.status < 500,
    'standalone indexer',
  );
  await waitForHttp(
    `http://127.0.0.1:${standalonePorts['proof-server']}/version`,
    (response) => response.ok,
    'proof server',
  );
  const manager = await startManagerProcess({
    env: {
      DID_MANAGER_STANDALONE_NODE: `http://127.0.0.1:${standalonePorts.node}`,
      DID_MANAGER_STANDALONE_INDEXER: `http://127.0.0.1:${standalonePorts.indexer}/api/v3/graphql`,
      DID_MANAGER_STANDALONE_INDEXER_WS: `ws://127.0.0.1:${standalonePorts.indexer}/api/v3/graphql/ws`,
      DID_MANAGER_STANDALONE_PROOF_SERVER: `http://127.0.0.1:${standalonePorts['proof-server']}`,
    },
  });

  return {
    ...manager,
    stop: async () => {
      await manager.stop();
      await dockerCompose('down', '--volumes', '--remove-orphans').catch(() => undefined);
    },
  };
};

export const startManagerPreprodFundingEnv = async (dataDir?: string): Promise<ManagerE2EEnv> =>
  await startManagerProcess({
    dataDir,
    env: {
      DID_MANAGER_SETUP: 'preprod',
      DID_MANAGER_PREPROD_PROOF_SERVER: 'http://127.0.0.1:6300',
    },
  });
