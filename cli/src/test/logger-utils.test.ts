import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createLogger } from '../logger-utils';

const readFileEventually = async (filePath: string, timeoutMs = 1500): Promise<string> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  return fs.readFile(filePath, 'utf8');
};

describe('cli logger-utils', () => {
  it('redacts common secret fields from structured logs', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'midnight-did-cli-'));
    const logPath = path.join(dir, 'redaction.log');
    const logger = await createLogger(logPath);

    logger.info(
      {
        seed: 'raw-wallet-seed',
        nested: {
          privateKey: 'raw-private-key',
          body: {
            config: {
              seed: 'deep-wallet-seed',
            },
          },
        },
        password: 'raw-password',
      },
      'secret-redaction-check',
    );
    (logger as { flush?: () => void }).flush?.();

    const contents = await readFileEventually(logPath);
    expect(contents).toContain('secret-redaction-check');
    expect(contents).toContain('[Redacted]');
    expect(contents).not.toContain('raw-wallet-seed');
    expect(contents).not.toContain('raw-private-key');
    expect(contents).not.toContain('deep-wallet-seed');
    expect(contents).not.toContain('raw-password');
  });
});
