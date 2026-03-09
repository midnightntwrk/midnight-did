import pino, { type Logger } from "pino";

import type { ResolverLogger } from "./service.js";

export const buildLogger = (debug: boolean): Logger =>
  pino({
    name: "did-resolver-service",
    level: debug ? "debug" : "info",
  });

export const createResolverLogger = (logger: Logger): ResolverLogger => ({
  error: (message, context) => {
    if (context === undefined) {
      logger.error(message);
      return;
    }
    logger.error(context, message);
  },
});
