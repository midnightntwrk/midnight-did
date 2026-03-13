import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import pino, { type Logger } from 'pino';

export const buildLogger = async (logFilePath: string): Promise<Logger> => {
  await mkdir(path.dirname(logFilePath), { recursive: true });

  return pino({
    name: 'did-manager-service',
    level: process.env.DID_MANAGER_DEBUG === 'true' ? 'debug' : 'info',
  }, pino.multistream([
    { stream: process.stdout },
    { stream: pino.destination(logFilePath) },
  ]));
};
