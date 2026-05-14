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
    allowedIndexerHttpUrls: config.allowedIndexerHttpUrls,
    allowedIndexerWsUrls: config.allowedIndexerWsUrls,
    expectedNetwork: config.expectedNetwork ?? undefined,
    debug: config.debug,
    logger: createResolverLogger(
      logger.child({ component: "resolver-service" }),
    ),
  });
  const app = await createApp(service, {
    logger: logger.child({ component: "http-api" }),
  });
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
