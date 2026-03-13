import path from 'node:path';

import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { buildLogger } from './logger.js';
import { DidManagerService } from './manager.js';

export const start = async (): Promise<void> => {
  const cfg = loadConfig();
  const logFilePath = process.env.DID_MANAGER_LOG_FILE?.trim()
    || path.join(path.dirname(cfg.sessionFilePath), 'did-manager-service.log');
  const logger = await buildLogger(logFilePath);
  const manager = new DidManagerService(cfg, logger);
  const app = await createApp(manager, logger);

  logger.info({ logFilePath, setupProfile: cfg.setupProfile }, 'Starting did-manager-service');

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down did-manager-service');
    await manager.lock().catch(() => undefined);
    await app.close().catch(() => undefined);
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: cfg.host, port: cfg.port });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
