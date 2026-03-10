import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { buildLogger, createResolverLogger } from "./logger.js";
import { ResolverService } from "./service.js";

export const start = async (): Promise<void> => {
  const config = loadConfig();
  const logger = buildLogger(config.debug);
  const service = new ResolverService({
    indexerHttpUrl: config.indexerHttpUrl,
    indexerWsUrl: config.indexerWsUrl,
    expectedNetwork: config.expectedNetwork ?? undefined,
    debug: config.debug,
    resolveTimeoutMs: config.resolveTimeoutMs,
    logger: createResolverLogger(
      logger.child({ component: "resolver-service" }),
    ),
  });
  const app = await createApp(service, {
    logger: logger.child({ component: "http-api" }),
    enableDocs: config.enableDocs,
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down resolver service");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Failed to shutdown cleanly");
      process.exit(1);
    }
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({
    host: config.host,
    port: config.port,
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
